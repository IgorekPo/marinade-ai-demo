import Groq from 'groq-sdk';
import { marinades } from '../data/marinades.js';
import {
  getProteinIntentById,
  productProteinScore,
  proteinGroupsForPrompt,
  resolveProteinIntent,
} from '../data/protein-compatibility.js';
import {
  getTasteIntent,
  productTasteMatch,
  resolveTasteIntent,
  tasteTaxonomyForPrompt,
} from '../data/taste-compatibility.js';

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
  tasteDirection: product.tasteDirection,
  tasteProfiles: product.tasteProfiles,
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
- Розрізняй загальний смаковий напрямок і конкретний смаковий профіль. «Фруктовий» означає всі товари напрямку fruit, а «вишневий» — насамперед профіль cherry.
- Використовуй тільки tasteDirection і tasteProfiles, які є в контрольованій taxonomy та компактному каталозі. Не вигадуй відсутні смаки.
- Порядок підбору: точний продукт + потрібний смак; сумісна білкова категорія + потрібний смак; інший продукт + потрібний смак із чесним поясненням; сумісний продукт + близький смак із чесним поясненням.
- Якщо товар має інший фактичний protein, не стверджуй, що він точно підходить до запитаного продукту. Назви фактичне призначення картки та поясни, що це альтернатива саме за смаковим профілем.
- Аналізуй сенс усього повідомлення, а не реагуй на окреме слово. Пріоритет намірів: конкретний запит про товар; питання про попередню рекомендацію; зміна параметрів; скарга з конкретним запитом; подяка з конкретним запитом; чиста скарга; чиста подяка; невимушена розмова.
- Якщо користувач лише дякує або завершує розмову, коротко й природно відповідай без пошуку та без productIds.
- Подяка не скасовує запит у тому самому повідомленні. Якщо разом із нею є новий параметр, питання або прохання показати інший варіант, виконай цей запит із збереженням контексту.
- На роздратування чи грубість відповідай спокійно, без суперечки, повчань, пасивної агресії та згадок про правила поведінки.
- Якщо негативне повідомлення містить конкретний запит, насамперед виконай його; для деескалації можна додати не більше одного короткого речення.
- Якщо користувач лише незадоволений і не дав конкретного запиту, постав одне найдоречніше уточнення на основі поточного контексту.
- Якщо скарга стосується попередньої рекомендації, поясни саме її та не запускай новий підбір.

# Контрольовані групи сумісності

${JSON.stringify(proteinGroupsForPrompt)}

# Контрольована taxonomy смаків

${JSON.stringify(tasteTaxonomyForPrompt)}

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
        reason: product.whySuitable || product.description,
      };
    });
}

function proteinMatchType(product, intent) {
  if (!intent) return 'different-protein';
  if (product.meat === intent.protein || (intent.isExactCatalogProtein && product.meat === intent.catalogMeat)) {
    return 'exact';
  }
  if (product.meat === intent.catalogMeat) return 'compatible';
  return 'different-protein';
}

function classifyProductMatch(product, preferences) {
  const proteinMatch = proteinMatchType(product, preferences.proteinIntent);
  const tasteMatch = productTasteMatch(product, preferences.tasteIntent);
  let matchLevel = 'OTHER';
  if (tasteMatch.exact && proteinMatch === 'exact') matchLevel = 'EXACT';
  else if (tasteMatch.exact && proteinMatch === 'compatible') matchLevel = 'COMPATIBLE';
  else if (tasteMatch.exact) matchLevel = 'TASTE_ALTERNATIVE';
  else if (tasteMatch.near && proteinMatch !== 'different-protein') matchLevel = 'NEAR_TASTE';
  return { proteinMatch, tasteMatch, matchLevel };
}

function createRecommendationContext(preferences, products) {
  const intent = preferences?.proteinIntent;
  if (!intent || !products.length) return null;
  const catalogProduct = catalogById.get(products[0].id);
  const match = classifyProductMatch(catalogProduct, preferences);

  return {
    requestedProtein: intent.protein,
    requestedProteinLabel: intent.proteinLabel,
    requestedProteinGenitive: intent.proteinGenitive,
    catalogProtein: products[0].meat,
    matchType: match.proteinMatch,
    matchLevel: match.matchLevel,
    proteinGroup: intent.proteinGroup,
    proteinGroupLabel: intent.proteinGroupLabel,
    compatibilityReason: recommendationExplanation(preferences, products)
      || `Товар належить до запитаної категорії «${intent.proteinGroupLabel}».`,
    requestedTasteDirection: preferences.tasteIntent?.direction || null,
    requestedTasteProfile: preferences.tasteIntent?.profile || null,
    catalogTasteDirection: catalogProduct.tasteDirection,
    catalogTasteProfiles: catalogProduct.tasteProfiles,
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
  const explanation = recommendationExplanation(preferences, products);
  const message = explanation || result.message.trim();

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

function normalizeMessage(text) {
  return text.toLocaleLowerCase('uk-UA').replace(/ё/g, 'е').replace(/[’']/g, '').replace(/\s+/g, ' ').trim();
}

function analyzePreferences(text) {
  const normalized = normalizeMessage(text);
  const match = (fragments) => includesAny(normalized, fragments);
  const proteinIntent = resolveProteinIntent(normalized);
  const tasteIntent = resolveTasteIntent(normalized);
  const preferences = {
    meat: proteinIntent?.catalogMeat || null,
    proteinIntent,
    tasteIntent,
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
    tasteIntent: null,
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
    tasteIntent: getTasteIntent(
      lastRecommendation.requestedTasteDirection,
      lastRecommendation.requestedTasteProfile,
    ),
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
    if (next.tasteIntent) preferences.tasteIntent = next.tasteIntent;
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
  if (!intent) return null;

  const productIds = Array.isArray(value.productIds)
    ? value.productIds.filter((id) => typeof id === 'string' && catalogById.has(id)).slice(0, 3)
    : [];
  if (!productIds.length) return null;

  const catalogProduct = catalogById.get(productIds[0]);
  const parameters = value.parameters && typeof value.parameters === 'object' ? {
    type: ['dry', 'liquid'].includes(value.parameters.type) ? value.parameters.type : null,
    color: ['yellow', 'red', 'green'].includes(value.parameters.color) ? value.parameters.color : null,
    flavors: Array.isArray(value.parameters.flavors)
      ? value.parameters.flavors.filter((flavor) => typeof flavor === 'string').slice(0, 8)
      : [],
    sweetness: Number.isFinite(value.parameters.sweetness) ? value.parameters.sweetness : null,
    spiciness: Number.isFinite(value.parameters.spiciness) ? value.parameters.spiciness : null,
  } : { type: null, color: null, flavors: [], sweetness: null, spiciness: null };
  const tasteIntent = getTasteIntent(value.requestedTasteDirection, value.requestedTasteProfile);
  const match = classifyProductMatch(catalogProduct, { proteinIntent: intent, tasteIntent });

  return {
    requestedProtein: intent.protein,
    requestedProteinLabel: intent.proteinLabel,
    requestedProteinGenitive: intent.proteinGenitive,
    catalogProtein: catalogProduct.meat,
    matchType: match.proteinMatch,
    matchLevel: match.matchLevel,
    proteinGroup: intent.proteinGroup,
    proteinGroupLabel: intent.proteinGroupLabel,
    compatibilityReason: String(value.compatibilityReason || '').slice(0, 500),
    requestedTasteDirection: tasteIntent?.direction || null,
    requestedTasteProfile: tasteIntent?.profile || null,
    catalogTasteDirection: catalogProduct.tasteDirection,
    catalogTasteProfiles: catalogProduct.tasteProfiles,
    productIds,
    parameters,
  };
}

function isQuestionAboutLastRecommendation(text, lastRecommendation) {
  if (!lastRecommendation) return false;
  const normalized = normalizeMessage(text);
  if (includesAny(normalized, ['покажи інший', 'покажіть інший', 'підбери інший', 'порадь інший', 'другой вариант', 'покажи другой'])) {
    return false;
  }

  return includesAny(normalized, [
    'тут вказано', 'тут же вказано', 'тут написано', 'тут же написано', 'здесь указано', 'здесь написано',
    'на картці', 'в карточке', 'но тут', 'але тут', 'а тут',
    'чому для', 'почему для', 'це ж для', 'это же для', 'але він для', 'но он для',
    'але це для', 'но это для', 'хіба це', 'разве это',
    'підійде', 'підходить', 'подойдет', 'почему вы рекомендовали', 'чому ви порадили',
  ]);
}

function isAlternativeRequest(text) {
  const normalized = normalizeMessage(text);
  return includesAny(normalized, [
    'інший варіант', 'інший маринад', 'ще варіант', 'ще один',
    'другой вариант', 'другой маринад', 'есть другой', 'є інший',
  ]);
}

function analyzeConversationIntent(text, lastRecommendation = null) {
  const normalized = normalizeMessage(text);
  const currentPreferences = analyzePreferences(text);
  const hasGratitude = includesAny(normalized, [
    'дякую', 'спасибо', 'спасибі', 'благодар', 'мерсі', 'thanks',
  ]);
  const hasNegativeSentiment = includesAny(normalized, [
    'нічого не розумі', 'ничего не понима', 'що за маяч', 'что за бред', 'фігн', 'фигн',
    'хрінь', 'хрень', 'дурн', 'дурац', 'блін', 'блин', 'знущає', 'издевае',
    'не подобається', 'не нравится', 'знову не те', 'опять не то', 'не підійш', 'не подош',
  ]);
  const hasParameterRequest = Boolean(
    currentPreferences.proteinIntent
    || currentPreferences.tasteIntent
    || currentPreferences.type
    || currentPreferences.color
    || currentPreferences.unsupportedColor
    || currentPreferences.flavors.length
    || currentPreferences.sweetness !== null
    || currentPreferences.spiciness !== null,
  );
  const hasAlternative = isAlternativeRequest(text);
  const hasExplicitRequest = includesAny(normalized, [
    'потрібен', 'потрібна', 'потрібно', 'нужен', 'нужна', 'хочу', 'покажи', 'покажіть',
    'підбери', 'підберіть', 'порадь', 'посоветуй', 'є маринад', 'есть маринад',
    'а є', 'чи є', 'а есть', 'есть ли',
  ]);
  const hasRequest = hasParameterRequest || hasAlternative || hasExplicitRequest;
  const referencesLastRecommendation = isQuestionAboutLastRecommendation(text, lastRecommendation)
    && !hasExplicitRequest
    && !hasAlternative;

  let intent = 'small_talk';
  if (referencesLastRecommendation) intent = 'last_recommendation_question';
  else if (hasRequest && hasNegativeSentiment) intent = 'complaint_with_request';
  else if (hasRequest && hasGratitude) intent = 'gratitude_with_request';
  else if (hasRequest) intent = 'product_request';
  else if (hasNegativeSentiment) intent = 'pure_complaint';
  else if (hasGratitude) intent = 'pure_gratitude';

  return {
    intent,
    hasRequest,
    hasGratitude,
    hasNegativeSentiment,
    referencesLastRecommendation,
    currentPreferences,
  };
}

function gratitudeResponse(lastRecommendation = null) {
  return {
    message: 'Дякую! Якщо знадобиться допомога з підбором маринаду — звертайтеся.',
    question: null,
    products: [],
    recommendationContext: lastRecommendation,
  };
}

function complaintResponse(preferences, lastRecommendation = null) {
  let question = 'Що саме потрібно змінити у підборі?';
  if (!preferences.proteinIntent) question = 'Для якого продукту підбираємо маринад?';
  else if (!preferences.type) question = 'Вам потрібен сухий чи рідкий маринад?';
  else if (!preferences.tasteIntent) {
    question = 'Який смаковий напрямок вам ближчий: фруктовий, трав’яний, гострий, солодкий чи димний?';
  }

  return {
    message: 'Розумію, що попередня відповідь вам не підійшла. Спробуймо точніше.',
    question,
    products: [],
    recommendationContext: lastRecommendation,
  };
}

function explainLastRecommendation(lastRecommendation, comparisonIntent = null) {
  const intent = comparisonIntent || getProteinIntentById(lastRecommendation.requestedProtein);
  if (!intent) return '';
  const product = catalogById.get(lastRecommendation.productIds[0]);
  const matchType = comparisonIntent ? proteinMatchType(product, intent) : lastRecommendation.matchType;
  const tasteIntent = getTasteIntent(
    lastRecommendation.requestedTasteDirection,
    lastRecommendation.requestedTasteProfile,
  );
  const tasteSuffix = tasteIntent
    ? ` з потрібним вам ${tasteIntent.profile ? `смаком «${tasteIntent.profileLabel}»` : `смаковим напрямком «${tasteIntent.directionLabel}»`}`
    : '';
  if (matchType === 'exact') {
    return `Так, у картці вказана загальна категорія «${intent.proteinGroupLabel}». ${intent.proteinLabel} належить до неї, тому рекомендація відповідає вашому запиту.`;
  }
  if (matchType === 'different-protein') {
    const meatLabels = { chicken: 'курки', pork: 'свинини', fish: 'риби' };
    const taste = catalogById.get(lastRecommendation.productIds[0])?.flavors[0] || 'потрібним профілем';
    return `Так, ви праві. Це маринад для ${meatLabels[lastRecommendation.catalogProtein]}. Для ${intent.proteinGenitive} потрібного смакового варіанта в каталозі немає, тому я запропонував його лише як найближчу альтернативу за смаком «${taste}», а не як точний збіг за продуктом.`;
  }
  if (intent.proteinGroup === 'poultry') {
    return `Так, ви праві. У картці вказано «Курка», тому що це фактичне призначення товару. Окремого варіанта для ${intent.proteinGenitive} в каталозі немає, тому я запропонував його як найближчий сумісний для птиці${tasteSuffix}.`;
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

function requestedTasteText(tasteIntent) {
  if (!tasteIntent) return '';
  return tasteIntent.profile
    ? `зі смаком «${tasteIntent.profileLabel}»`
    : `смакового напрямку «${tasteIntent.directionLabel}»`;
}

function recommendationExplanation(preferences, products) {
  if (!preferences?.proteinIntent || !products.length) return '';
  if (!preferences.tasteIntent) return compatibilityExplanation(preferences.proteinIntent);

  const product = catalogById.get(products[0].id);
  const match = classifyProductMatch(product, preferences);
  const tasteText = requestedTasteText(preferences.tasteIntent);
  const productTaste = product.flavors[0];
  const meatLabels = { chicken: 'курки', pork: 'свинини', fish: 'риби' };

  if (match.matchLevel === 'EXACT') {
    return 'За вашим запитом можу запропонувати такі варіанти:';
  }
  if (match.matchLevel === 'COMPATIBLE') {
    return `Окремого маринаду ${tasteText} для ${preferences.proteinIntent.proteinGenitive} в каталозі немає, але цей продукт належить до групи «${preferences.proteinIntent.proteinGroupLabel}». Пропоную найближчий сумісний варіант для ${meatLabels[product.meat]} з потрібним смаковим профілем:`;
  }
  if (match.matchLevel === 'TASTE_ALTERNATIVE') {
    return `Для ${preferences.proteinIntent.proteinGenitive} маринаду ${tasteText} в каталозі немає. Це маринад для ${meatLabels[product.meat]}, але він найближчий до вашого запиту саме за потрібним смаковим профілем:`;
  }
  if (match.matchLevel === 'NEAR_TASTE') {
    return `Точного варіанта ${tasteText} для ${preferences.proteinIntent.proteinGenitive} немає. Найближчий доступний смак — «${productTaste}», тому пропоную його як смакову альтернативу:`;
  }
  return '';
}

function rankProducts(preferences) {
  let candidates = preferences.tasteIntent
    ? [...marinades]
    : marinades.filter((product) => productProteinScore(product, preferences.proteinIntent) > 0);
  if (!candidates.length) candidates = [...marinades];

  const excludedIds = new Set(preferences.excludedProductIds || []);
  if (excludedIds.size && candidates.some((product) => !excludedIds.has(product.id))) {
    candidates = candidates.filter((product) => !excludedIds.has(product.id));
  }

  const levelScores = {
    EXACT: 500,
    COMPATIBLE: 400,
    TASTE_ALTERNATIVE: 300,
    NEAR_TASTE: 200,
    OTHER: 0,
  };
  const ranked = candidates
    .map((product, index) => {
      const match = classifyProductMatch(product, preferences);
      let score = productProteinScore(product, preferences.proteinIntent);
      if (preferences.tasteIntent) score += levelScores[match.matchLevel];
      if (preferences.type) score += product.type === preferences.type ? 32 : -32;
      if (preferences.color) score += product.color === preferences.color ? 26 : -26;
      const productFlavors = product.flavors.join(' ').toLocaleLowerCase('uk-UA');
      score += preferences.flavors.filter((flavor) => productFlavors.includes(flavor)).length * 7;
      if (preferences.spiciness !== null) score += 6 - Math.abs(product.spiciness - preferences.spiciness);
      if (preferences.sweetness !== null) score += 6 - Math.abs(product.sweetness - preferences.sweetness);
      if (match.tasteMatch.exactProfile) score += 24;
      if (preferences.tasteIntent && product.tasteDirection === preferences.tasteIntent.direction) score += 40;
      return { id: product.id, score, index, matchLevel: match.matchLevel };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index);

  if (!preferences.tasteIntent || !ranked.length) return ranked.slice(0, 3);
  const bestLevel = ranked[0].matchLevel;
  return ranked.filter((product) => product.matchLevel === bestLevel).slice(0, 3);
}

function hasUsefulPreferences(preferences) {
  return Boolean(
    preferences.type
    || preferences.color
    || preferences.tasteIntent
    || preferences.flavors.length
    || preferences.sweetness !== null
    || preferences.spiciness !== null,
  );
}

function buildCompatibilityContext(preferences, lastRecommendation = null, conversationIntent = null) {
  const intent = preferences.proteinIntent;
  const conversationContext = {
    requestedProtein: intent?.protein || null,
    catalogProtein: intent?.catalogMeat || null,
    proteinGroup: intent?.proteinGroup || null,
    matchType: intent ? (intent.isExactCatalogProtein ? 'exact' : 'compatible') : null,
    requestedTasteDirection: preferences.tasteIntent?.direction || null,
    requestedTasteProfile: preferences.tasteIntent?.profile || null,
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
      matchLevel: lastRecommendation.matchLevel,
      requestedTasteDirection: lastRecommendation.requestedTasteDirection,
      requestedTasteProfile: lastRecommendation.requestedTasteProfile,
    } : null,
    conversationalIntent: conversationIntent ? {
      intent: conversationIntent.intent,
      hasRequest: conversationIntent.hasRequest,
      hasGratitude: conversationIntent.hasGratitude,
      hasNegativeSentiment: conversationIntent.hasNegativeSentiment,
      referencesLastRecommendation: conversationIntent.referencesLastRecommendation,
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

  const conversationIntent = analyzeConversationIntent(message, lastRecommendation);

  if (conversationIntent.referencesLastRecommendation) {
    const normalized = normalizeMessage(message);
    const comparisonIntent = includesAny(normalized, ['я просив', 'я просила', 'я просил'])
      ? null
      : conversationIntent.currentPreferences.proteinIntent;
    return sendJson(response, 200, {
      message: explainLastRecommendation(lastRecommendation, comparisonIntent),
      question: null,
      products: [],
      recommendationContext: lastRecommendation,
    });
  }

  const preferences = mergeConversationPreferences(history, message, lastRecommendation);
  if (conversationIntent.intent === 'pure_gratitude') {
    return sendJson(response, 200, gratitudeResponse(lastRecommendation));
  }
  if (conversationIntent.intent === 'pure_complaint') {
    return sendJson(response, 200, complaintResponse(preferences, lastRecommendation));
  }
  if (isAlternativeRequest(message) && lastRecommendation) {
    preferences.excludedProductIds = lastRecommendation.productIds;
  }
  if (preferences.unsupportedColor) {
    return sendJson(response, 200, unsupportedColorResponse(preferences));
  }
  if (!preferences.meat) {
    return sendJson(response, 200, localFallback(message, history, preferences));
  }

  if (!process.env.GROQ_API_KEY) {
    return sendJson(response, 200, localFallback(message, history, preferences));
  }

  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY, maxRetries: 0 });
    const providerMessages = [
      { role: 'system', content: systemInstruction },
      { role: 'system', content: buildCompatibilityContext(preferences, lastRecommendation, conversationIntent) },
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
  analyzeConversationIntent,
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
  complaintResponse,
  gratitudeResponse,
  toBrowserResponse,
};
