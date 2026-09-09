let highlightTimer;

export function highlightProduct(productId, updateHash = false) {
  const card = document.getElementById(productId);
  if (!card) return false;

  if (updateHash) history.pushState(null, '', `#${productId}`);
  window.clearTimeout(highlightTimer);
  document.querySelectorAll('.product-card--highlighted').forEach((item) => {
    item.classList.remove('product-card--highlighted');
  });

  card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  card.classList.add('product-card--highlighted');
  highlightTimer = window.setTimeout(() => {
    card.classList.remove('product-card--highlighted');
  }, 2800);
  return true;
}

export function initProductHighlight() {
  const highlightFromHash = () => {
    const productId = decodeURIComponent(window.location.hash.slice(1));
    if (productId) window.requestAnimationFrame(() => highlightProduct(productId));
  };

  highlightFromHash();
  window.addEventListener('hashchange', highlightFromHash);
}
