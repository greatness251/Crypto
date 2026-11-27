import { store } from '../state/store.js';
import { escapeHtml, formatCurrency, formatPercent } from '../utils/formatters.js';

export function initMarketGrid({ onSelectCoin, onRetry }) {
  const grid = document.getElementById('markets-grid');
  const tabButtons = document.querySelectorAll('[data-market-tab]');

  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      store.setState({ marketTab: btn.dataset.marketTab });
    });
  });

  grid.addEventListener('click', (e) => {
    const card = e.target.closest('.market-card[data-coin-id]');
    if (!card) return;
    onSelectCoin?.(card.dataset.coinId);
    document.getElementById('search-section')?.scrollIntoView({ behavior: 'smooth' });
  });

  function render() {
    const state = store.getState();

    tabButtons.forEach((btn) => {
      const active = btn.dataset.marketTab === state.marketTab;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-selected', String(active));
    });

    if (state.marketsLoading) {
      grid.innerHTML = Array.from({ length: 8 })
        .map(() => `<div class="skeleton" style="height:102px;border-radius:18px;"></div>`)
        .join('');
      return;
    }

    if (state.marketsError) {
      grid.innerHTML = `
        <div class="state-banner">
          <p style="margin:0;font-weight:600;color:var(--text-primary);">Unable to load market pulse</p>
          <p style="margin:6px 0 0;font-size:0.875rem;">${escapeHtml(state.marketsError)}</p>
          <button type="button" class="state-banner__btn" id="markets-retry-btn">Retry</button>
        </div>
      `;
      grid.querySelector('#markets-retry-btn')?.addEventListener('click', () => onRetry?.());
      return;
    }

    const list =
      state.marketTab === 'watchlist'
        ? state.markets.filter((c) => state.watchlist.includes(c.id))
        : state.markets;

    if (!list.length) {
      grid.innerHTML = `
        <div class="state-banner">
          <p style="margin:0;font-weight:600;color:var(--text-primary);">Your Watchlist is empty</p>
          <p style="margin:6px 0 0;font-size:0.875rem;">Search for a cryptocurrency above and click “Add to Watchlist” to pin it here.</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = list
      .map((coin) => {
        const delta = coin.price_change_percentage_24h ?? 0;
        const isUp = delta >= 0;
        const isSelected = coin.id === state.activeCoinId;
        return `
          <button type="button" class="market-card ${isSelected ? 'is-selected' : ''}" data-coin-id="${escapeHtml(coin.id)}">
            <div class="market-card__head">
              <div class="market-card__coin">
                <img src="${escapeHtml(coin.image || '')}" alt="" loading="lazy" />
                <div style="min-width:0;">
                  <div class="market-card__name">${escapeHtml(coin.name)}</div>
                  <div class="market-card__sym">${escapeHtml(coin.symbol)}</div>
                </div>
              </div>
              <span class="delta-pill tabular ${isUp ? 'is-up' : 'is-down'}" style="font-size:0.75rem;padding:3px 8px;">
                ${isUp ? '▲' : '▼'} ${formatPercent(delta)}
              </span>
            </div>
            <div class="market-card__price-row">
              <span class="market-card__price tabular">${formatCurrency(coin.current_price, state.currency)}</span>
              ${coin.market_cap_rank ? `<span style="font-size:0.75rem;color:var(--text-muted);font-weight:600;">#${coin.market_cap_rank}</span>` : ''}
            </div>
          </button>
        `;
      })
      .join('');
  }

  render();
  store.subscribe(render);
}
