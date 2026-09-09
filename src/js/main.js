import '../scss/main.scss';
import { renderCatalog } from './catalog.js';
import { initChat } from './chat.js';
import { initProductHighlight } from './product-highlight.js';

function renderHeader() {
  const header = document.querySelector('#site-header');
  const currentPage = document.body.dataset.page;
  const links = [
    ['home', './index.html', 'Головна'],
    ['catalog', './catalog.html', 'Каталог'],
    ['dry', './dry.html', 'Сухі маринади'],
    ['liquid', './liquid.html', 'Рідкі маринади'],
  ];

  header.innerHTML = `
    <header class="header">
      <div class="container header__inner">
        <a class="logo" href="./index.html">Маринад Ко.</a>
        <nav class="nav" aria-label="Головна навігація">
          ${links.map(([page, href, label]) => `<a class="nav__link${currentPage === page ? ' nav__link--active' : ''}" href="${href}">${label}</a>`).join('')}
          <button class="nav__link nav__link--button" type="button" data-chat-open>AI-помічник</button>
        </nav>
      </div>
    </header>`;
}

function renderChatShell() {
  document.querySelector('#chat-root').innerHTML = `
    <button class="chat-launcher" type="button" data-chat-open aria-controls="chat-panel" aria-expanded="false">
      <span aria-hidden="true">✦</span> AI-помічник з маринадів
    </button>
    <aside id="chat-panel" class="chat" aria-label="AI-помічник з підбору маринадів" aria-hidden="true">
      <header class="chat__header">
        <div><strong>AI-помічник з маринадів</strong><span>Підбір із каталогу</span></div>
        <button class="chat__close" type="button" data-chat-close aria-label="Закрити помічника">×</button>
      </header>
      <div class="chat__messages" data-chat-messages aria-live="polite">
        <div class="chat__message chat__message--assistant">Вітаю! Я допоможу підібрати маринад із нашого каталогу.<br><br>Розкажіть, що вам потрібно. Наприклад: «Шукаю жовтий маринад для курки, солодкий і трохи гострий».</div>
      </div>
      <p class="chat__status" data-chat-status role="status"></p>
      <form class="chat__form" data-chat-form>
        <label class="visually-hidden" for="chat-input">Опишіть, який маринад вам потрібен</label>
        <input id="chat-input" class="chat__input" name="message" type="text" maxlength="1000" autocomplete="off" placeholder="Опишіть, що вам потрібно…" required />
        <button class="button chat__send" type="submit">Надіслати</button>
      </form>
    </aside>`;
}

renderHeader();
renderChatShell();
renderCatalog();
initProductHighlight();
initChat();
