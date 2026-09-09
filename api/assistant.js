import Groq from 'groq-sdk';
import { marinades } from '../data/marinades.js';
import {
  getProteinIntentById,
  productProteinScore,
  proteinGroupsForPrompt,
  resolveProteinIntent,
} from '../data/protein-compatibility.js';

const catalogById = new Map(marinades.map((product) => [product.id, product]));
const MAX_MESSAGE_LENGTH = 1500;
const MAX_HISTORY_MESSAGES = 4;
const MAX_HISTORY_CONTENT_LENGTH = 600;
const compactCatalog = marinades.map((product) => ({
  id: product.id,
  name: product.name,
  type: product.type,
  protein: product.meat,
  color: product.color,
  tastes: product.flavors,
  spicy: product.spiciness,
  sweet: product.sweetness,
}));

const responseSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    message: {
      type: 'string',
      description: 'Короткий вступ максимум з одного речення. Не містить і не повторює уточнювальне питання.',
    },
    needsClarification: { type: 'boolean' },
    question: {
      type: ['string', 'null'],
      description: 'Одне коротке уточнювальне питання або null, якщо уточнення не потрібне.',
    },
    productIds: { type: 'array', items: { type: 'string' } },
  },
  required: ['message', 'needsClarification', 'question', 'productIds'],
};

const systemInstruction = `# Роль

Ти — AI-консультант з підбору маринадів. Твоя задача — зрозуміти потребу клієнта та підібрати найбільш відповідні товари ВИКЛЮЧНО з наданого каталогу.

# Обов'язкові правила

- Завжди відповідай тільки українською мовою, незалежно від мови повідомлення користувача.
- Не вигадуй маринади, характеристики, кольори, смаки або ID, яких немає у каталозі.
- Повертай лише точні ID з поля id наданого каталогу.
- Враховуй сухий або рідкий тип, курку або свинину або рибу, жовтий або червоний або зелений колір, смак, солодкість, гостроту та інші наявні характеристики.
- Якщо інформації достатньо, одразу рекомендуй від одного до трьох найбільш відповідних товарів.
- Якщо інформації недостатньо, постав одне коротке уточнювальне запитання. Не запитуй одразу всі характеристики.
- За один раз став тільки ОДНЕ питання про один найважливіший параметр. Не поєднуй в одному питанні тип, колір, солодкість і гостроту.
- Якщо користувач вказав лише продукт, спочатку уточни тип: «Вам потрібен сухий чи рідкий маринад?» Наступний параметр запитуй лише в наступному повідомленні й тільки якщо це справді потрібно.
- Пам'ятай контекст попередніх повідомлень поточного чату.
- Якщо потрібне уточнення, встанови needsClarification у true, запиши запитання в question і поверни порожній productIds.
- Якщо рекомендуєш товари, встанови needsClarification у false, question у null і поверни від одного до трьох productIds.
- Поле message — лише короткий природний вступ, максимум одне коротке речення.
- Поле question — саме уточнювальне питання. Текст question не можна повністю або частково повторювати в message.
- Не використовуй повторювані канцелярські конструкції на кшталт «Будь ласка, уточніть... Будь ласка, уточніть...». Формулюй питання прямо й природно.
- Якщо точного виду продукту немає, не відмовляй одразу. Використай надану сервером сумісну категорію, збережи всі інші побажання та чітко поясни, що це найближчі сумісні варіанти, а не точний збіг.
- Для індички, качки, гуски або перепілки використовуй каталогову категорію chicken як найближчу для птиці.
- Для яловичини, телятини, баранини або ягнятини використовуй каталогову категорію pork як найближчу для червоного м'яса.
- Для конкретних видів риби використовуй каталогову категорію fish.
- Зберігай уже названі параметри запиту між репліками. Нове значення того самого параметра замінює попереднє: наприклад, «червоний» після «чорний» означає актуальний червоний колір, а тип і продукт зберігаються.
- Якщо користувач запитує, чому в рекомендованій картці вказано інший продукт, поясни попередню сумісну рекомендацію. Не сприймай назву продукту з такого питання як новий запит і не запускай новий підбір, якщо користувач прямо не просить інший варіант.
- У поясненні сумісності чітко розрізняй requestedProtein користувача, catalogProtein картки та matchType. Не називай сумісну рекомендацію точним збігом.

# Контрольовані групи сумісності

${JSON.stringify(proteinGroupsForPrompt)}

# Каталог

${JSON.stringify(compactCatalog)}

# Фінальна вимога

Увесь текст у message та question має бути тільки українською мовою. Поверни лише структуровану відповідь за заданою JSON Schema.`;

function sendJson(response, status, payload) {
  response.status(status).setHeader('Content-Type', 'application/json');
  response.setHeader('Cache-Control', 'no-store');
  response.end(JSON.stringify(payload));
}

function safeHistory(history) {
  if (!Array.isArray(history)) return [];

  return history
    .slice(-MAX_HISTORY_MESSAGES)
    .filter((item) => item && ['user', 'assistant'].includes(item.role) && typeof item.content === 'string')
    .map((item) => ({ role: item.role, content: item.content.slice(0, MAX_HISTORY_CONTENT_LENGTH) }));
}

function mapValidatedProducts(productIds) {
  if (!Array.isArray(productIds)) return [];

  const seen = new Set();
  return productIds
    .filter((id) => {
      if (typeof id !== 'string' || !catalogById.has(id) || seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .slice(0, 3)
    .map((id) => {
      const product = catalogById.get(id);
      return {
        id: product.id,
        name: product.name,
        page: product.page,
        type: product.type,
        meat: product.meat,
        color: product.color,
        flavors: product.flavors,
        reason: product.description,
      };
    });
}

function createRecommendationContext(preferences, products) {
  const intent = preferences?.proteinIntent;
  if (!intent || !products.length) return null;

  return {
    requestedProtein: intent.protein,
    requestedProteinLabel: intent.proteinLabel,
    requestedProteinGenitive: intent.proteinGenitive,
    catalogProtein: products[0].meat,
    matchType: intent.isExactCatalogProtein ? 'exact' : 'compatible',
    proteinGroup: intent.proteinGroup,
    proteinGroupLabel: intent.proteinGroupLabel,
    compatibilityReason: intent.isExactCatalogProtein
      ? `Товар належить до запитаної категорії «${intent.proteinGroupLabel}».`
      : `У каталозі немає окремої категорії для ${intent.proteinGenitive}, тому використано сумісну категорію «${intent.proteinGroupLabel}».`,
    productIds: products.map((product) => product.id),
    parameters: {
      type: preferences.type,
      color: preferences.color,
      flavors: preferences.flavors,
      sweetness: preferences.sweetness,
      spiciness: preferences.spiciness,
    },
  };
}

function toBrowserResponse(result, source = 'groq', preferences = null) {
  if (!result || typeof result.message !== 'string' || typeof result.needsClarification !== 'boolean') {
    throw new Error('Malformed structured response');
  }

  const question = typeof result.question === 'string' ? result.question.trim() : '';
  if (result.needsClarification && !question) throw new Error('Missing clarification question');
  const rankedIds = preferences?.proteinIntent ? rankProducts(preferences).map(({ id }) => id) : null;
  const products = result.needsClarification
    ? []
    : mapValidatedProducts(rankedIds?.length ? rankedIds : result.productIds);
  const explanation = compatibilityExplanation(preferences?.proteinIntent);
  const message = explanation
    ? source === 'fallback' ? `${result.message.trim()} ${explanation}` : explanation
    : result.message.trim();

  return {
    message,
    question: result.needsClarification ? question : null,
    products,
    recommendationContext: result.needsClarification ? null : createRecommendationContext(preferences, products),
  };
}

function includesAny(text, fragments) {
  return fragments.some((fragment) => text.includes(fragment));
}

function analyzePreferences(text) {
  const normalized = text.toLocaleLowerCase('uk-UA').replace(/[’']/g, '');
  const match = (fragments) => includesAny(normalized, fragments);
  const proteinIntent = resolveProteinIntent(normalized);
  const preferences = {
    meat: proteinIntent?.catalogMeat || null,
    proteinIntent,
    type: match(['рідк', 'жидк']) ? 'liquid' : match(['сух', 'суход']) ? 'dry' : null,
    color: match(['жовт', 'золот', 'желт']) ? 'yellow' : match(['червон', 'красн']) ? 'red' : match(['зелен', 'зелён']) ? 'green' : null,
    unsupportedColor: match(['чорн', 'черн']) ? 'black' : null,
    flavors: [],
    sweetness: null,
    spiciness: null,
  };

  const flavorWords = [
    ['часник', ['часник', 'часнич', 'чеснок']],
    ['трави', ['трав', 'зелень']],
    ['перець', ['перц', 'перч']],
    ['карі', ['карі']],
    ['мед', ['мед']],
    ['паприка', ['паприк']],
    ['дим', ['дим', 'копчен', 'дым']],
    ['гірчиця', ['гірч', 'горчиц']],
    ['лимон', ['лимон']],
    ['кріп', ['кріп']],
    ['петрушка', ['петруш']],
    ['чилі', ['чилі']],
    ['цибуля', ['цибул', 'лук']],
    ['імбир', ['імбир', 'имбир']],
    ['томат', ['томат']],
    ['барбекю', ['барбекю']],
  ];
  preferences.flavors = flavorWords.filter(([, words]) => match(words)).map(([flavor]) => flavor);

  if (match(['не солод', 'не слад'])) preferences.sweetness = 0;
  else if (match(['трохи солод', 'злегка солод', 'немного слад'])) preferences.sweetness = 2;
  else if (match(['дуже солод', 'солодк', 'медов', 'сладк'])) preferences.sweetness = 4;

  if (match(['не дуже гостр', 'трохи гостр', 'злегка гостр', 'не очень остр', 'немного остр'])) preferences.spiciness = 2;
  else if (match(['не гостр', 'не остр'])) preferences.spiciness = 0;
  else if (match(['дуже гостр', 'очень остр'])) preferences.spiciness = 5;
  else if (match(['гостр', 'остр'])) preferences.spiciness = 4;

  return preferences;
}

function emptyPreferences() {
  return {
    meat: null,
    proteinIntent: null,
    type: null,
    color: null,
    unsupportedColor: null,
    flavors: [],
    sweetness: null,
    spiciness: null,
  };
}

function preferencesFromLastRecommendation(lastRecommendation) {
  if (!lastRecommendation) return emptyPreferences();
  const intent = getProteinIntentById(lastRecommendation.requestedProtein);
  if (!intent) return emptyPreferences();

  return {
    meat: intent.catalogMeat,
    proteinIntent: intent,
    type: lastRecommendation.parameters?.type || null,
    color: lastRecommendation.parameters?.color || null,
    unsupportedColor: null,
    flavors: [...(lastRecommendation.parameters?.flavors || [])],
    sweetness: lastRecommendation.parameters?.sweetness ?? null,
    spiciness: lastRecommendation.parameters?.spiciness ?? null,
  };
}

function historyAfterLastRecommendation(history, lastRecommendation) {
  if (!lastRecommendation) return history;
  for (let index = history.length - 1; index >= 0; index -= 1) {
    if (history[index].role === 'assistant' && history[index].content.includes('Рекомендовані productIds:')) {
      return history.slice(index + 1);
    }
  }
  return [];
}

function mergeConversationPreferences(history, message, lastRecommendation = null) {
  const preferences = preferencesFromLastRecommendation(lastRecommendation);
  const relevantHistory = historyAfterLastRecommendation(history, lastRecommendation);
  const userMessages = [
    ...relevantHistory
      .filter((item) => item.role === 'user' && !isQuestionAboutLastRecommendation(item.content, lastRecommendation))
      .map((item) => item.content),
    message,
  ];

  userMessages.forEach((content) => {
    const next = analyzePreferences(content);
    if (next.proteinIntent) {
      preferences.proteinIntent = next.proteinIntent;
      preferences.meat = next.meat;
    }
    if (next.type) preferences.type = next.type;
    if (next.color) {
      preferences.color = next.color;
      preferences.unsupportedColor = null;
    } else if (next.unsupportedColor) {
      preferences.color = null;
      preferences.unsupportedColor = next.unsupportedColor;
    }
    if (next.flavors.length) preferences.flavors = [...new Set([...preferences.flavors, ...next.flavors])];
    if (next.sweetness !== null) preferences.sweetness = next.sweetness;
    if (next.spiciness !== null) preferences.spiciness = next.spiciness;
  });

  return preferences;
}

function sanitizeLastRecommendation(value) {
  if (!value || typeof value !== 'object') return null;
  const intent = getProteinIntentById(value.requestedProtein);
  if (!intent || !['exact', 'compatible'].includes(value.matchType)) return null;

  const productIds = Array.isArray(value.productIds)
    ? value.productIds.filter((id) => typeof id === 'string' && catalogById.has(id)).slice(0, 3)
    : [];
  if (!productIds.length) return null;

  const catalogProtein = catalogById.get(productIds[0])?.meat;
  if (!catalogProtein || catalogProtein !== intent.catalogMeat) return null;

  return {
    requestedProtein: intent.protein,
    requestedProteinLabel: intent.proteinLabel,
    requestedProteinGenitive: intent.proteinGenitive,
    catalogProtein,
    matchType: intent.isExactCatalogProtein ? 'exact' : 'compatible',
    proteinGroup: intent.proteinGroup,
    proteinGroupLabel: intent.proteinGroupLabel,
    compatibilityReason: intent.isExactCatalogProtein
      ? `Товар належить до запитаної категорії «${intent.proteinGroupLabel}».`
      : `У каталозі немає окремої категорії для ${intent.proteinGenitive}, тому використано сумісну категорію «${intent.proteinGroupLabel}».`,
    productIds,
    parameters: value.parameters && typeof value.parameters === 'object' ? {
      type: ['dry', 'liquid'].includes(value.parameters.type) ? value.parameters.type : null,
      color: ['yellow', 'red', 'green'].includes(value.parameters.color) ? value.parameters.color : null,
      flavors: Array.isArray(value.parameters.flavors)
        ? value.parameters.flavors.filter((flavor) => typeof flavor === 'string').slice(0, 8)
        : [],
      sweetness: Number.isFinite(value.parameters.sweetness) ? value.parameters.sweetness : null,
      spiciness: Number.isFinite(value.parameters.spiciness) ? value.parameters.spiciness : null,
    } : { type: null, color: null, flavors: [], sweetness: null, spiciness: null },
  };
}

function isQuestionAboutLastRecommendation(text, lastRecommendation) {
  if (!lastRecommendation) return false;
  const normalized = text.toLocaleLowerCase('uk-UA').replace(/[’']/g, '');
  if (includesAny(normalized, ['покажи інший', 'покажіть інший', 'підбери інший', 'порадь інший', 'другой вариант', 'покажи другой'])) {
    return false;
  }

  return includesAny(normalized, [
    'тут вказано', 'тут написано', 'на картці', 'в карточке', 'но тут', 'але тут',
    'чому для', 'почему для', 'це ж для', 'это же для', 'але він для', 'но он для',
    'але це для', 'но это для', 'хіба це', 'разве это',
    'підійде', 'підходить', 'подойдет', 'почему вы рекомендовали', 'чому ви порадили',
  ]);
}

function isAlternativeRequest(text) {
  const normalized = text.toLocaleLowerCase('uk-UA').replace(/[’']/g, '');
  return includesAny(normalized, [
    'інший варіант', 'інший маринад', 'ще варіант', 'ще один',
    'другой вариант', 'другой маринад', 'есть другой', 'є інший',
  ]);
}

function explainLastRecommendation(lastRecommendation) {
  const intent = getProteinIntentById(lastRecommendation.requestedProtein);
  if (!intent) return '';
  if (lastRecommendation.matchType === 'exact') {
    return `Так, у картці вказана загальна категорія «${intent.proteinGroupLabel}». ${intent.proteinLabel} належить до неї, тому рекомендація відповідає вашому запиту.`;
  }
  if (intent.proteinGroup === 'poultry') {
    return `Так, у картці вказано «Курка». Я порадив цей маринад як сумісний варіант для ${intent.proteinGenitive}: обидва продукти належать до птиці, а окремої категорії для ${intent.proteinGenitive} в каталозі немає.`;
  }
  return `Так, у картці вказано «Свинина». Я порадив цей маринад як сумісний варіант для ${intent.proteinGenitive}: обидва продукти належать до червоного м’яса, а окремої категорії для ${intent.proteinGenitive} в каталозі немає.`;
}

function unsupportedColorResponse(preferences) {
  return {
    message: 'Чорних маринадів у каталозі немає.',
    question: 'Який колір оберете: червоний, жовтий чи зелений?',
    products: [],
    recommendationContext: null,
  };
}

function compatibilityExplanation(intent) {
  if (!intent || intent.isExactCatalogProtein) return '';

  if (intent.proteinGroup === 'poultry') {
    return `Окремих маринадів для ${intent.proteinGenitive} в каталозі немає, але це птиця, тому пропоную найближчі сумісні варіанти з маринадів для курки:`;
  }
  if (intent.proteinGroup === 'redMeat') {
    return `Окремих маринадів для ${intent.proteinGenitive} в каталозі немає, але для червоного м’яса пропоную найближчі сумісні варіанти з маринадів для свинини:`;
  }
  return `Окремих маринадів для ${intent.proteinGenitive} в каталозі немає, але це риба, тому пропоную найближчі сумісні варіанти з категорії рибних маринадів:`;
}

function rankProducts(preferences) {
  let candidates = marinades.filter((product) => productProteinScore(product, preferences.proteinIntent) > 0);
  if (!candidates.length) candidates = [...marinades];

  const excludedIds = new Set(preferences.excludedProductIds || []);
  if (excludedIds.size && candidates.some((product) => !excludedIds.has(product.id))) {
    candidates = candidates.filter((product) => !excludedIds.has(product.id));
  }

  if (preferences.type && candidates.some((product) => product.type === preferences.type)) {
    candidates = candidates.filter((product) => product.type === preferences.type);
  }
  if (preferences.color && candidates.some((product) => product.color === preferences.color)) {
    candidates = candidates.filter((product) => product.color === preferences.color);
  }

  return candidates
    .map((product, index) => {
      let score = productProteinScore(product, preferences.proteinIntent);
      if (preferences.type) score += product.type === preferences.type ? 32 : -32;
      if (preferences.color) score += product.color === preferences.color ? 26 : -26;
      const productFlavors = product.flavors.join(' ').toLocaleLowerCase('uk-UA');
      score += preferences.flavors.filter((flavor) => productFlavors.includes(flavor)).length * 7;
      if (preferences.spiciness !== null) score += 6 - Math.abs(product.spiciness - preferences.spiciness);
      if (preferences.sweetness !== null) score += 6 - Math.abs(product.sweetness - preferences.sweetness);
      return { id: product.id, score, index };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, 3);
}

function hasUsefulPreferences(preferences) {
  return Boolean(
    preferences.type
    || preferences.color
    || preferences.flavors.length
    || preferences.sweetness !== null
    || preferences.spiciness !== null,
  );
}

function buildCompatibilityContext(preferences, lastRecommendation = null) {
  const intent = preferences.proteinIntent;
  const conversationContext = {
    requestedProtein: intent?.protein || null,
    catalogProtein: intent?.catalogMeat || null,
    proteinGroup: intent?.proteinGroup || null,
    matchType: intent ? (intent.isExactCatalogProtein ? 'exact' : 'compatible') : null,
    preferences: {
      type: preferences.type,
      color: preferences.color,
      tastes: preferences.flavors,
      spicy: preferences.spiciness,
      sweet: preferences.sweetness,
    },
    lastRecommendation: lastRecommendation ? {
      productIds: lastRecommendation.productIds,
      requestedProtein: lastRecommendation.requestedProtein,
      catalogProtein: lastRecommendation.catalogProtein,
      matchType: lastRecommendation.matchType,
    } : null,
  };

  return `Структурований стан поточного діалогу: ${JSON.stringify(conversationContext)}. Використовуй цей стан як основне джерело вже визначених параметрів. ${intent && !intent.isExactCatalogProtein ? 'Рекомендація використовує сумісну категорію — чітко поясни це користувачу.' : ''}`;
}

function localFallback(message, history, preparedPreferences = null) {
  const preferences = preparedPreferences || mergeConversationPreferences(history, message);
  const hasUsefulDetail = hasUsefulPreferences(preferences);

  if (preferences.unsupportedColor) return unsupportedColorResponse(preferences);

  if (!preferences.meat) {
    return toBrowserResponse({
      message: 'Щоб точніше підібрати маринад, уточніть один момент.',
      needsClarification: true,
      question: 'Для якого продукту потрібен маринад: курки, свинини чи риби?',
      productIds: [],
    }, 'fallback');
  }

  if (!hasUsefulDetail) {
    return toBrowserResponse({
      message: 'Щоб точніше підібрати маринад, уточніть один момент.',
      needsClarification: true,
      question: 'Вам потрібен сухий чи рідкий маринад?',
      productIds: [],
    }, 'fallback');
  }

  const scored = rankProducts(preferences);

  return toBrowserResponse({
    message: 'За вашим запитом підійдуть такі маринади:',
    needsClarification: false,
    question: null,
    productIds: scored.map(({ id }) => id),
  }, 'fallback', preferences);
}

function readErrorHeader(headers, name) {
  if (!headers) return null;
  if (typeof headers.get === 'function') return headers.get(name);
  const key = Object.keys(headers).find((header) => header.toLocaleLowerCase('en-US') === name);
  const value = key ? headers[key] : null;
  return Array.isArray(value) ? value[0] : value || null;
}

function providerErrorDetails(error) {
  const status = Number.isInteger(error?.status) ? error.status : null;
  const rawMessage = error?.error?.message || error?.message || 'Unknown provider error';
  return {
    status,
    type: error?.constructor?.name || typeof error,
    message: String(rawMessage).replace(/\s+/g, ' ').slice(0, 300),
    is429: status === 429,
    is401: status === 401,
    is400Or422: status === 400 || status === 422,
    is5xx: status !== null && status >= 500 && status <= 599,
    retryAfter: readErrorHeader(error?.headers, 'retry-after'),
  };
}

function logProviderError(error) {
  console.error('[AI_PROVIDER_ERROR]', providerErrorDetails(error));
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return sendJson(response, 405, { message: 'Метод запиту не підтримується.', products: [] });
  }

  const body = typeof request.body === 'string' ? parseBody(request.body) : request.body;
  const message = typeof body?.message === 'string' ? body.message.trim() : '';
  const history = safeHistory(body?.history);
  const lastRecommendation = sanitizeLastRecommendation(body?.lastRecommendation);

  if (!message || message.length > MAX_MESSAGE_LENGTH) {
    return sendJson(response, 400, {
      message: 'Введіть запит довжиною від 1 до 1500 символів.',
      products: [],
    });
  }

  if (isQuestionAboutLastRecommendation(message, lastRecommendation)) {
    return sendJson(response, 200, {
      message: explainLastRecommendation(lastRecommendation),
      question: null,
      products: [],
      recommendationContext: lastRecommendation,
    });
  }

  const preferences = mergeConversationPreferences(history, message, lastRecommendation);
  if (isAlternativeRequest(message) && lastRecommendation) {
    preferences.excludedProductIds = lastRecommendation.productIds;
  }
  if (preferences.unsupportedColor) {
    return sendJson(response, 200, unsupportedColorResponse(preferences));
  }

  if (!process.env.GROQ_API_KEY) {
    return sendJson(response, 200, localFallback(message, history, preferences));
  }

  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY, maxRetries: 0 });
    const providerMessages = [
      { role: 'system', content: systemInstruction },
      { role: 'system', content: buildCompatibilityContext(preferences, lastRecommendation) },
      ...history,
      { role: 'user', content: message },
    ];
    if (process.env.NODE_ENV !== 'production') {
      console.info('[AI_REQUEST_DIAGNOSTICS]', {
        messagesCount: providerMessages.length,
        catalogProductsCount: compactCatalog.length,
      });
    }

    const completion = await groq.chat.completions.create({
      model: 'openai/gpt-oss-20b',
      messages: providerMessages,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'marinade_recommendation',
          strict: true,
          schema: responseSchema,
        },
      },
      reasoning_effort: 'low',
      temperature: 0.2,
      max_completion_tokens: 600,
    });

    const content = completion.choices[0]?.message?.content;
    const parsed = JSON.parse(content || '');
    if (parsed.needsClarification && preferences.proteinIntent && hasUsefulPreferences(preferences)) {
      const rankedIds = rankProducts(preferences).map(({ id }) => id);
      return sendJson(response, 200, toBrowserResponse({
        message: 'За вашим запитом підійдуть такі маринади:',
        needsClarification: false,
        question: null,
        productIds: rankedIds,
      }, 'groq', preferences));
    }

    const safeResult = toBrowserResponse(parsed, 'groq', preferences);

    if (!safeResult.products.length && !parsed.needsClarification) {
      return sendJson(response, 200, localFallback(message, history, preferences));
    }

    return sendJson(response, 200, safeResult);
  } catch (error) {
    logProviderError(error);
    return sendJson(response, 200, localFallback(message, history, preferences));
  }
}

function parseBody(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export const __testables = {
  analyzePreferences,
  buildCompatibilityContext,
  compatibilityExplanation,
  hasUsefulPreferences,
  localFallback,
  mapValidatedProducts,
  mergeConversationPreferences,
  rankProducts,
  sanitizeLastRecommendation,
  isQuestionAboutLastRecommendation,
  toBrowserResponse,
};
