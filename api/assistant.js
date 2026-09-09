import Groq from 'groq-sdk';
import { marinades } from '../data/marinades.js';

const catalogById = new Map(marinades.map((product) => [product.id, product]));
const MAX_MESSAGE_LENGTH = 1500;
const MAX_HISTORY_MESSAGES = 6;

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

# Каталог

${JSON.stringify(marinades)}

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
    .map((item) => ({ role: item.role, content: item.content.slice(0, MAX_MESSAGE_LENGTH) }));
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

function toBrowserResponse(result, source = 'groq') {
  if (!result || typeof result.message !== 'string' || typeof result.needsClarification !== 'boolean') {
    throw new Error('Malformed structured response');
  }

  const question = typeof result.question === 'string' ? result.question.trim() : '';
  if (result.needsClarification && !question) throw new Error('Missing clarification question');
  const products = result.needsClarification ? [] : mapValidatedProducts(result.productIds);

  return {
    message: result.message.trim(),
    question: result.needsClarification ? question : null,
    products,
    source,
  };
}

function includesAny(text, fragments) {
  return fragments.some((fragment) => text.includes(fragment));
}

function analyzePreferences(text) {
  const normalized = text.toLocaleLowerCase('uk-UA').replace(/[’']/g, '');
  const match = (fragments) => includesAny(normalized, fragments);
  const preferences = {
    meat: match(['курк', 'куряч']) ? 'chicken' : match(['свинин', 'свиняч']) ? 'pork' : match(['риб']) ? 'fish' : null,
    type: match(['рідк']) ? 'liquid' : match(['сух']) ? 'dry' : null,
    color: match(['жовт', 'золот']) ? 'yellow' : match(['червон']) ? 'red' : match(['зелен']) ? 'green' : null,
    flavors: [],
    sweetness: null,
    spiciness: null,
  };

  const flavorWords = [
    ['часник', ['часник', 'часнич']],
    ['трави', ['трав', 'зелень']],
    ['перець', ['перц', 'перч']],
    ['карі', ['карі']],
    ['мед', ['мед']],
    ['паприка', ['паприк']],
    ['дим', ['дим', 'копчен']],
    ['гірчиця', ['гірч']],
    ['лимон', ['лимон']],
    ['кріп', ['кріп']],
    ['петрушка', ['петруш']],
    ['чилі', ['чилі']],
    ['цибуля', ['цибул']],
    ['імбир', ['імбир']],
    ['томат', ['томат']],
    ['барбекю', ['барбекю']],
  ];
  preferences.flavors = flavorWords.filter(([, words]) => match(words)).map(([flavor]) => flavor);

  if (match(['не солод'])) preferences.sweetness = 0;
  else if (match(['трохи солод', 'злегка солод'])) preferences.sweetness = 2;
  else if (match(['дуже солод', 'солодк', 'медов'])) preferences.sweetness = 4;

  if (match(['не дуже гостр', 'трохи гостр', 'злегка гостр'])) preferences.spiciness = 2;
  else if (match(['не гостр'])) preferences.spiciness = 0;
  else if (match(['дуже гостр'])) preferences.spiciness = 5;
  else if (match(['гостр'])) preferences.spiciness = 4;

  return preferences;
}

function localFallback(message, history) {
  const conversationText = [...history.filter((item) => item.role === 'user').map((item) => item.content), message].join(' ');
  const preferences = analyzePreferences(conversationText);
  const hasUsefulDetail = Boolean(
    preferences.type
    || preferences.color
    || preferences.flavors.length
    || preferences.sweetness !== null
    || preferences.spiciness !== null,
  );

  if (!preferences.meat) {
    return toBrowserResponse({
      message: 'Зараз використовую локальний підбір.',
      needsClarification: true,
      question: 'Для якого продукту потрібен маринад: курки, свинини чи риби?',
      productIds: [],
    }, 'fallback');
  }

  if (!hasUsefulDetail) {
    return toBrowserResponse({
      message: 'Зараз використовую локальний підбір.',
      needsClarification: true,
      question: 'Вам потрібен сухий чи рідкий маринад?',
      productIds: [],
    }, 'fallback');
  }

  let candidates = marinades.filter((product) => product.meat === preferences.meat);
  if (preferences.type && candidates.some((product) => product.type === preferences.type)) {
    candidates = candidates.filter((product) => product.type === preferences.type);
  }
  if (preferences.color && candidates.some((product) => product.color === preferences.color)) {
    candidates = candidates.filter((product) => product.color === preferences.color);
  }

  const scored = candidates
    .map((product, index) => {
      let score = product.meat === preferences.meat ? 20 : -20;
      if (preferences.type) score += product.type === preferences.type ? 10 : -10;
      if (preferences.color) score += product.color === preferences.color ? 12 : -12;
      const productFlavors = product.flavors.join(' ').toLocaleLowerCase('uk-UA');
      score += preferences.flavors.filter((flavor) => productFlavors.includes(flavor)).length * 5;
      if (preferences.sweetness !== null) score += 5 - Math.abs(product.sweetness - preferences.sweetness);
      if (preferences.spiciness !== null) score += 5 - Math.abs(product.spiciness - preferences.spiciness);
      return { id: product.id, score, index };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, 3);

  return toBrowserResponse({
    message: 'Groq тимчасово недоступний. Ось найближчі варіанти за локальним підбором:',
    needsClarification: false,
    question: null,
    productIds: scored.map(({ id }) => id),
  }, 'fallback');
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return sendJson(response, 405, { message: 'Метод запиту не підтримується.', products: [] });
  }

  const body = typeof request.body === 'string' ? parseBody(request.body) : request.body;
  const message = typeof body?.message === 'string' ? body.message.trim() : '';
  const history = safeHistory(body?.history);

  if (!message || message.length > MAX_MESSAGE_LENGTH) {
    return sendJson(response, 400, {
      message: 'Введіть запит довжиною від 1 до 1500 символів.',
      products: [],
    });
  }

  if (!process.env.GROQ_API_KEY) {
    return sendJson(response, 200, localFallback(message, history));
  }

  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const completion = await groq.chat.completions.create({
      model: 'openai/gpt-oss-20b',
      messages: [
        { role: 'system', content: systemInstruction },
        ...history,
        { role: 'user', content: message },
      ],
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
    const safeResult = toBrowserResponse(parsed);

    if (!safeResult.products.length && !parsed.needsClarification) {
      return sendJson(response, 200, localFallback(message, history));
    }

    return sendJson(response, 200, safeResult);
  } catch (error) {
    console.error('Groq assistant request failed:', error instanceof Error ? error.message : 'Unknown error');
    return sendJson(response, 200, localFallback(message, history));
  }
}

function parseBody(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export const __testables = { analyzePreferences, localFallback, mapValidatedProducts, toBrowserResponse };
