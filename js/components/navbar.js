import { store } from '../state/store.js';

export function initNavbar({ onCurrencyChange, onOpenWatchlist }) {
  const currencySelect = document.getElementById('currency-select');
  const themeToggle = document.getElementById('theme-toggle');
  const watchlistBtn = document.getElementById('nav-watchlist-btn');
  const watchlistCount = document.getElementById('watchlist-count');
  const apiStatusEl = document.getElementById('api-status');
  const apiStatusText = document.getElementById('api-status-text');
  const navLinks = document.querySelectorAll('.nav-link[data-nav]');

  const state = store.getState();
  currencySelect.value = state.currency;

  currencySelect.addEventListener('change', (e) => {
    const nextCurrency = e.target.value;
    store.setCurrency(nextCurrency);
    onCurrencyChange?.(nextCurrency);
  });

  themeToggle.addEventListener('click', () => {
    store.toggleTheme();
  });

  watchlistBtn.addEventListener('click', () => {
    onOpenWatchlist?.();
    document.getElementById('markets-section')?.scrollIntoView({ behavior: 'smooth' });
  });

  navLinks.forEach((link) => {
    link.addEventListener('click', () => {
      navLinks.forEach((l) => l.classList.remove('is-active'));
      link.classList.add('is-active');
    });
  });

  function renderNavbar(s) {
    watchlistCount.textContent = String(s.watchlist.length);
    apiStatusEl.classList.remove('is-cached', 'is-error');
    if (s.apiStatus === 'cached') apiStatusEl.classList.add('is-cached');
    if (s.apiStatus === 'error') apiStatusEl.classList.add('is-error');
    apiStatusText.textContent = s.apiStatusLabel;
  }

  renderNavbar(state);
  store.subscribe(renderNavbar);
}
