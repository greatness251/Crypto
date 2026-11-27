import { store } from '../state/store.js';
import {
  escapeHtml,
  formatCompactCurrency,
  formatCompactNumber,
  formatCurrency,
  formatPercent
} from '../utils/formatters.js';
import { renderSparkline } from './sparkline.js';

export function renderSpotlight(onRetry) {
  const container = document.getElementById('spotlight-container');
  const state = store.getState();

  if (state.spotlightLoading) {
    container.innerHTML = `
      <div class="spotlight-card" aria-busy="true">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:16px;margin-bottom:20px;">
          <div style="display:flex;align-items:center;gap:14px;">
            <div class="skeleton" style="width:48px;height:48px;border-radius:50%;"></div>
            <div>
              <div class="skeleton" style="width:160px;height:24px;margin-bottom:8px;"></div>
              <div class="skeleton" style="width:220px;height:36px;"></div>
            </div>
          </div>
          <div class="skeleton" style="width:130px;height:36px;border-radius:999px;"></div>
        </div>
        <div class="spotlight-body">
          <div class="skeleton" style="height:200px;border-radius:18px;"></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div class="skeleton" style="height:68px;"></div>
            <div class="skeleton" style="height:68px;"></div>
            <div class="skeleton" style="height:68px;"></div>
            <div class="skeleton" style="height:68px;"></div>
          </div>
        </div>
      </div>
    `;
    return;
  }

  if (state.spotlightError || !state.activeCoinData) {
    container.innerHTML = `
      <div class="state-banner">
        <p style="margin:0;font-weight:600;color:var(--text-primary);">Could not load cryptocurrency valuation</p>
        <p style="margin:6px 0 0;font-size:0.875rem;">${escapeHtml(state.spotlightError || 'Rate limit or network issue encountered.')}</p>
        <button type="button" class="state-banner__btn" id="spotlight-retry-btn">Try Again</button>
      </div>
    `;
    container.querySelector('#spotlight-retry-btn')?.addEventListener('click', () => onRetry?.());
    return;
  }

  const coin = state.activeCoinData;
  const currency = state.currency;
  const delta = coin.price_change_percentage_24h ?? 0;
  const isUp = delta >= 0;
  const isSaved = store.isWatched(coin.id);
  const symbolUpper = (coin.symbol || '').toUpperCase();
  const unitPrice = coin.current_price || 0;

  container.innerHTML = `
    <article class="spotlight-card">
      <div class="spotlight-top">
        <div>
          <div class="spotlight-identity">
            <img class="spotlight-logo" src="${escapeHtml(coin.image || '')}" alt="${escapeHtml(coin.name)} logo" />
            <div>
              <div class="spotlight-title-row">
                <h2 class="spotlight-name">${escapeHtml(coin.name)}</h2>
                <span class="spotlight-ticker">${escapeHtml(symbolUpper)}</span>
                ${coin.market_cap_rank ? `<span class="spotlight-rank">Rank #${coin.market_cap_rank}</span>` : ''}
              </div>
              <div class="spotlight-price-block">
                <span class="spotlight-price tabular">${formatCurrency(unitPrice, currency)}</span>
                <span class="delta-pill tabular ${isUp ? 'is-up' : 'is-down'}">
                  ${isUp ? '▲' : '▼'} ${formatPercent(delta)} (24h)
                </span>
              </div>
            </div>
          </div>
        </div>

        <div class="spotlight-actions">
          <button type="button" class="watchlist-btn ${isSaved ? 'is-saved' : ''}" id="spotlight-watch-btn">
            <span>${isSaved ? '★' : '☆'}</span>
            <span>${isSaved ? 'Saved to Watchlist' : 'Add to Watchlist'}</span>
          </button>
        </div>
      </div>

      <div class="spotlight-body">
        <div class="chart-panel">
          <div class="chart-panel__head">
            <span>7-Day Price Trend</span>
            <span class="mono" style="color:var(--text-muted);">Hover chart to inspect</span>
          </div>
          <div id="spotlight-sparkline"></div>
        </div>

        <div class="spotlight-right">
          <div class="stats-grid">
            <div class="stat-box">
              <div class="stat-box__label">Market Cap</div>
              <div class="stat-box__value tabular">${formatCompactCurrency(coin.market_cap, currency)}</div>
            </div>
            <div class="stat-box">
              <div class="stat-box__label">24h Volume</div>
              <div class="stat-box__value tabular">${formatCompactCurrency(coin.total_volume, currency)}</div>
            </div>
            <div class="stat-box">
              <div class="stat-box__label">24h High / Low</div>
              <div class="stat-box__value tabular">${formatCurrency(coin.high_24h, currency)} / ${formatCurrency(coin.low_24h, currency)}</div>
            </div>
            <div class="stat-box">
              <div class="stat-box__label">Circulating Supply</div>
              <div class="stat-box__value tabular">${formatCompactNumber(coin.circulating_supply)} ${escapeHtml(symbolUpper)}</div>
            </div>
          </div>

          <div class="converter-box">
            <div class="converter-box__title">Quick Value Converter</div>
            <div class="converter-row">
              <label class="converter-field">
                <input type="number" id="conv-coin" min="0" step="any" value="1" aria-label="Amount in ${escapeHtml(symbolUpper)}" />
                <span>${escapeHtml(symbolUpper)}</span>
              </label>
              <span class="converter-eq" aria-hidden="true">⇄</span>
              <label class="converter-field">
                <input type="number" id="conv-fiat" min="0" step="any" value="${unitPrice ? unitPrice.toFixed(unitPrice < 1 ? 4 : 2) : '0'}" aria-label="Amount in ${currency.toUpperCase()}" />
                <span>${currency.toUpperCase()}</span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </article>
  `;

  const sparkEl = container.querySelector('#spotlight-sparkline');
  renderSparkline(sparkEl, coin.sparkline_in_7d?.price || [], currency, isUp);

  container.querySelector('#spotlight-watch-btn')?.addEventListener('click', () => {
    store.toggleWatchlist(coin.id);
    renderSpotlight(onRetry);
  });

  const coinInput = container.querySelector('#conv-coin');
  const fiatInput = container.querySelector('#conv-fiat');

  coinInput?.addEventListener('input', () => {
    const qty = parseFloat(coinInput.value);
    if (Number.isNaN(qty) || !unitPrice) {
      fiatInput.value = '';
      return;
    }
    const result = qty * unitPrice;
    fiatInput.value = result < 1 ? result.toFixed(6) : result.toFixed(2);
  });

  fiatInput?.addEventListener('input', () => {
    const fiat = parseFloat(fiatInput.value);
    if (Number.isNaN(fiat) || !unitPrice) {
      coinInput.value = '';
      return;
    }
    coinInput.value = (fiat / unitPrice).toFixed(6);
  });
}
