import { marinades } from '../../data/marinades.js';

const labels = {
  type: { dry: 'Сухий', liquid: 'Рідкий' },
  meat: { chicken: 'Курка', pork: 'Свинина', fish: 'Риба' },
  color: { yellow: 'Жовтий', red: 'Червоний', green: 'Зелений' },
};

function scoreDots(score) {
  return `<span class="score" aria-label="${score} із 5">${'●'.repeat(score)}${'○'.repeat(5 - score)}</span>`;
}

function productCard(product) {
  const flavors = product.flavors
    .map((flavor) => `<li class="product-card__tag">${flavor}</li>`)
    .join('');

  return `
    <article id="${product.id}" class="product-card">
      <div class="product-card__swatch product-card__swatch--${product.color}" aria-label="Колір: ${labels.color[product.color].toLowerCase()}"></div>
      <div class="product-card__body">
        <h2 class="product-card__title">${product.name}</h2>
        <p class="product-card__meta">${labels.type[product.type]} · ${labels.meat[product.meat]} · ${labels.color[product.color]}</p>
        <ul class="product-card__tags" aria-label="Смаки">${flavors}</ul>
        <dl class="product-card__scores">
          <div><dt>Солодкість</dt><dd>${scoreDots(product.sweetness)}</dd></div>
          <div><dt>Гострота</dt><dd>${scoreDots(product.spiciness)}</dd></div>
        </dl>
        <p class="product-card__description">${product.description}</p>
      </div>
    </article>`;
}

export function renderCatalog() {
  const grid = document.querySelector('#product-grid');
  if (!grid) return;

  const type = grid.dataset.productType;
  grid.innerHTML = marinades.filter((product) => product.type === type).map(productCard).join('');
}
