import { marinades } from '../../data/marinades.js';
import { highlightProduct } from './product-highlight.js';

const catalogById = new Map(marinades.map((product) => [product.id, product]));
const CHAT_STORAGE_KEY = 'marinadeAiChatHistory';
const labels = {
  type: { dry: 'Сухий', liquid: 'Рідкий' },
  meat: { chicken: 'Курка', pork: 'Свинина', fish: 'Риба' },
  color: { yellow: 'Жовтий', red: 'Червоний', green: 'Зелений' },
};

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  element.className = className;
  if (text) element.textContent = text;
  return element;
}

function addMessage(container, text, role) {
  const message = createElement('div', `chat__message chat__message--${role}`, text);
  container.append(message);
  container.scrollTop = container.scrollHeight;
}

function normalizeForComparison(text) {
  return text
    .toLocaleLowerCase('uk-UA')
    .replace(/[^а-щьюяєіїґa-z0-9\s]/giu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isNearlyDuplicate(message, question) {
  const normalizedMessage = normalizeForComparison(message);
  const normalizedQuestion = normalizeForComparison(question);
  if (!normalizedMessage || !normalizedQuestion) return false;
  if (normalizedMessage.includes(normalizedQuestion) || normalizedQuestion.includes(normalizedMessage)) return true;

  const ignoredWords = new Set(['будь', 'ласка', 'щоб', 'вам', 'для', 'який', 'яка', 'яке', 'які', 'саме', 'і', 'чи', 'та']);
  const meaningfulWords = (text) => new Set(text.split(' ').filter((word) => word.length > 2 && !ignoredWords.has(word)));
  const messageWords = meaningfulWords(normalizedMessage);
  const questionWords = meaningfulWords(normalizedQuestion);
  if (!messageWords.size || !questionWords.size) return false;

  const overlap = [...questionWords].filter((word) => messageWords.has(word)).length;
  return overlap / Math.min(messageWords.size, questionWords.size) >= 0.75;
}

function composeAssistantText(message, question) {
  const cleanMessage = String(message || '').trim();
  const cleanQuestion = typeof question === 'string' ? question.trim() : '';
  if (!cleanQuestion) return cleanMessage;
  if (isNearlyDuplicate(cleanMessage, cleanQuestion)) return cleanQuestion;
  return `${cleanMessage} ${cleanQuestion}`.trim();
}

function recommendationCard(serverProduct, onNavigate) {
  const product = catalogById.get(serverProduct?.id);
  if (!product) return null;

  const card = createElement('article', 'recommendation');
  const title = createElement('h3', 'recommendation__title', product.name);
  const meta = createElement(
    'p',
    'recommendation__meta',
    `${labels.type[product.type]} · ${labels.meat[product.meat]} · ${labels.color[product.color]}`,
  );
  const flavors = createElement('p', 'recommendation__flavors', product.flavors.map(capitalize).join(' · '));
  const reasonLabel = createElement('strong', 'recommendation__reason-label', 'Чому підходить:');
  const reason = createElement('p', 'recommendation__reason', String(serverProduct.reason || product.description));
  const link = createElement('a', 'button button--small', 'Переглянути маринад');
  link.href = `./${product.page}#${product.id}`;

  link.addEventListener('click', (event) => {
    onNavigate?.();
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    if (currentPage === product.page && document.getElementById(product.id)) {
      event.preventDefault();
      highlightProduct(product.id, true);
    }
  });

  card.append(title, meta, flavors, reasonLabel, reason, link);
  return card;
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function emptyChatSession() {
  return { transcript: [], history: [], lastRecommendation: null };
}

function sanitizeLastRecommendation(value) {
  if (!value || typeof value !== 'object') return null;
  const productIds = Array.isArray(value.productIds)
    ? value.productIds.filter((id) => typeof id === 'string' && catalogById.has(id)).slice(0, 3)
    : [];
  if (!productIds.length || !['exact', 'compatible'].includes(value.matchType)) return null;

  return {
    requestedProtein: String(value.requestedProtein || '').slice(0, 50),
    requestedProteinLabel: String(value.requestedProteinLabel || '').slice(0, 100),
    requestedProteinGenitive: String(value.requestedProteinGenitive || '').slice(0, 100),
    catalogProtein: String(value.catalogProtein || '').slice(0, 50),
    matchType: value.matchType,
    proteinGroup: String(value.proteinGroup || '').slice(0, 50),
    proteinGroupLabel: String(value.proteinGroupLabel || '').slice(0, 100),
    compatibilityReason: String(value.compatibilityReason || '').slice(0, 500),
    productIds,
    parameters: {
      type: ['dry', 'liquid'].includes(value.parameters?.type) ? value.parameters.type : null,
      color: ['yellow', 'red', 'green'].includes(value.parameters?.color) ? value.parameters.color : null,
      flavors: Array.isArray(value.parameters?.flavors)
        ? value.parameters.flavors.filter((flavor) => typeof flavor === 'string').slice(0, 8)
        : [],
      sweetness: Number.isFinite(value.parameters?.sweetness) ? value.parameters.sweetness : null,
      spiciness: Number.isFinite(value.parameters?.spiciness) ? value.parameters.spiciness : null,
    },
  };
}

function sanitizeChatSession(value) {
  if (!value || !Array.isArray(value.transcript) || !Array.isArray(value.history)) return emptyChatSession();

  const transcript = value.transcript
    .filter((entry) => entry && ['user', 'assistant'].includes(entry.role) && typeof entry.text === 'string')
    .map((entry) => ({
      role: entry.role,
      text: entry.text.slice(0, 4000),
      productIds: Array.isArray(entry.productIds)
        ? entry.productIds.filter((id) => typeof id === 'string' && catalogById.has(id)).slice(0, 3)
        : [],
      recommendations: Array.isArray(entry.recommendations)
        ? entry.recommendations
          .filter((item) => item && typeof item.productId === 'string' && catalogById.has(item.productId))
          .slice(0, 3)
          .map((item) => ({ productId: item.productId, reason: String(item.reason || '').slice(0, 1000) }))
        : [],
    }));

  const history = value.history
    .filter((entry) => entry && ['user', 'assistant'].includes(entry.role) && typeof entry.content === 'string')
    .map((entry) => ({ role: entry.role, content: entry.content.slice(0, 1500) }));

  return { transcript, history, lastRecommendation: sanitizeLastRecommendation(value.lastRecommendation) };
}

function loadChatSession(storage) {
  try {
    const saved = storage.getItem(CHAT_STORAGE_KEY);
    return saved ? sanitizeChatSession(JSON.parse(saved)) : emptyChatSession();
  } catch {
    return emptyChatSession();
  }
}

function saveChatSession(storage, session) {
  try {
    storage.setItem(CHAT_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // The chat continues to work even if browser storage is unavailable.
  }
}

function initializeChatSession(storage, performanceApi) {
  try {
    const navigationEntry = performanceApi.getEntriesByType('navigation')[0];
    if (navigationEntry?.type === 'reload') storage.removeItem(CHAT_STORAGE_KEY);
  } catch {
    // Older browsers simply keep the current session until the tab is closed.
  }

  return loadChatSession(storage);
}

function restoreTranscript(container, transcript, onNavigate) {
  transcript.forEach((entry) => {
    addMessage(container, entry.text, entry.role);
    entry.recommendations.forEach((recommendation) => {
      const card = recommendationCard({ id: recommendation.productId, reason: recommendation.reason }, onNavigate);
      if (card) container.append(card);
    });
  });
  container.scrollTop = container.scrollHeight;
}

export function initChat() {
  const panel = document.querySelector('#chat-panel');
  const messages = document.querySelector('[data-chat-messages]');
  const form = document.querySelector('[data-chat-form]');
  const input = form.elements.message;
  const sendButton = form.querySelector('button[type="submit"]');
  const status = document.querySelector('[data-chat-status]');
  const openButtons = document.querySelectorAll('[data-chat-open]');
  const chatSession = initializeChatSession(window.sessionStorage, window.performance);
  const history = chatSession.history;

  const setOpen = (isOpen) => {
    panel.classList.toggle('chat--open', isOpen);
    panel.setAttribute('aria-hidden', String(!isOpen));
    openButtons.forEach((button) => button.setAttribute('aria-expanded', String(isOpen)));
    if (isOpen) input.focus();
  };

  openButtons.forEach((button) => button.addEventListener('click', () => setOpen(true)));
  document.querySelector('[data-chat-close]').addEventListener('click', () => setOpen(false));
  restoreTranscript(messages, chatSession.transcript, () => setOpen(false));

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const userMessage = input.value.trim();
    if (!userMessage || sendButton.disabled) return;

    addMessage(messages, userMessage, 'user');
    const requestHistory = history.slice(-6);
    history.push({ role: 'user', content: userMessage });
    chatSession.transcript.push({ role: 'user', text: userMessage, productIds: [], recommendations: [] });
    saveChatSession(window.sessionStorage, chatSession);
    input.value = '';
    input.disabled = true;
    sendButton.disabled = true;
    status.textContent = 'Шукаємо найкращий варіант…';

    try {
      const response = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          history: requestHistory,
          lastRecommendation: chatSession.lastRecommendation,
        }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok || !data || typeof data.message !== 'string' || !Array.isArray(data.products)) {
        throw new Error('Некоректна відповідь помічника');
      }

      const assistantText = composeAssistantText(data.message, data.question);
      addMessage(messages, assistantText, 'assistant');
      const validProducts = data.products
        .filter((product) => product && catalogById.has(product.id))
        .slice(0, 3);

      validProducts.forEach((product) => {
        const card = recommendationCard(product, () => setOpen(false));
        if (card) messages.append(card);
      });

      const productIds = validProducts.map((product) => product.id);
      const recommendationContext = sanitizeLastRecommendation(data.recommendationContext);
      if (recommendationContext) chatSession.lastRecommendation = recommendationContext;
      const assistantContext = productIds.length
        ? `${assistantText}\nРекомендовані productIds: ${productIds.join(', ')}`
        : assistantText;
      history.push({ role: 'assistant', content: assistantContext });
      chatSession.transcript.push({
        role: 'assistant',
        text: assistantText,
        productIds,
        recommendations: validProducts.map((product) => ({
          productId: product.id,
          reason: String(product.reason || ''),
        })),
      });
      saveChatSession(window.sessionStorage, chatSession);
      messages.scrollTop = messages.scrollHeight;
    } catch {
      const errorMessage = 'Не вдалося точно визначити ваш запит. Уточніть, будь ласка, для якого продукту та який тип маринаду вам потрібен.';
      addMessage(
        messages,
        errorMessage,
        'assistant',
      );
      chatSession.transcript.push({ role: 'assistant', text: errorMessage, productIds: [], recommendations: [] });
      saveChatSession(window.sessionStorage, chatSession);
    } finally {
      status.textContent = '';
      input.disabled = false;
      sendButton.disabled = false;
      input.focus();
    }
  });
}

export const __testables = {
  CHAT_STORAGE_KEY,
  emptyChatSession,
  sanitizeLastRecommendation,
  sanitizeChatSession,
  loadChatSession,
  saveChatSession,
  initializeChatSession,
  normalizeForComparison,
  isNearlyDuplicate,
  composeAssistantText,
};
