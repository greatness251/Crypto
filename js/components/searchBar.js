import { searchCoins } from '../api/cryptoService.js';
import { store } from '../state/store.js';
import { escapeHtml } from '../utils/formatters.js';

const COIN_ALIASES = {
  btc: 'bitcoin',
  bitcoin: 'bitcoin',
  eth: 'ethereum',
  ethereum: 'ethereum',
  sol: 'solana',
  solana: 'solana',
  bnb: 'binancecoin',
  xrp: 'ripple',
  ripple: 'ripple',
  ada: 'cardano',
  cardano: 'cardano',
  doge: 'dogecoin',
  dogecoin: 'dogecoin',
  usdt: 'tether',
  tether: 'tether',
  usdc: 'usd-coin',
  trx: 'tron',
  tron: 'tron',
  dot: 'polkadot',
  polkadot: 'polkadot',
  avax: 'avalanche-2',
  avalanche: 'avalanche-2',
  link: 'chainlink',
  chainlink: 'chainlink',
  ltc: 'litecoin',
  litecoin: 'litecoin'
};

function resolveLocalCoin(query) {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  if (COIN_ALIASES[q]) return COIN_ALIASES[q];
  const { markets } = store.getState();
  const match = markets.find(
    (c) =>
      c.id.toLowerCase() === q ||
      c.symbol.toLowerCase() === q ||
      c.name.toLowerCase() === q ||
      c.name.toLowerCase().includes(q)
  );
  return match ? match.id : null;
}

export function initSearchBar({ onSelectCoin }) {
  const form = document.getElementById('search-form');
  const input = document.getElementById('search-input');
  const clearBtn = document.getElementById('search-clear');
  const list = document.getElementById('autocomplete-list');
  const chipsContainer = document.getElementById('quick-chips');

  let debounceTimer = null;
  let results = [];
  let highlightedIndex = -1;

  function closeList() {
    list.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    highlightedIndex = -1;
  }

  function openList() {
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  }

  function renderResults(coins) {
    results = coins;
    highlightedIndex = -1;

    if (!coins.length) {
      list.innerHTML = `<li class="autocomplete-empty">No matching cryptocurrencies found.</li>`;
      openList();
      return;
    }

    list.innerHTML = coins
      .map(
        (coin, idx) => `
        <li class="autocomplete-item" role="option" data-index="${idx}" data-coin-id="${escapeHtml(coin.id)}">
          <div class="autocomplete-item__left">
            <img class="autocomplete-item__img" src="${escapeHtml(coin.thumb || '')}" alt="" loading="lazy" />
            <span class="autocomplete-item__name">${escapeHtml(coin.name)}</span>
            <span class="autocomplete-item__symbol">${escapeHtml(coin.symbol)}</span>
          </div>
          ${coin.market_cap_rank ? `<span class="autocomplete-item__rank">#${coin.market_cap_rank}</span>` : ''}
        </li>`
      )
      .join('');

    openList();
  }

  function pickCoin(coinId, label) {
    if (!coinId) return;
    if (label) {
      input.value = label;
      clearBtn.hidden = false;
    }
    closeList();
    onSelectCoin?.(coinId);
  }

  input.addEventListener('input', () => {
    const query = input.value.trim();
    clearBtn.hidden = query.length === 0;

    clearTimeout(debounceTimer);
    if (query.length < 2) {
      closeList();
      return;
    }

    debounceTimer = setTimeout(async () => {
      try {
        const coins = await searchCoins(query);
        if (input.value.trim() === query) {
          renderResults(coins);
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          closeList();
        }
      }
    }, 280);
  });

  input.addEventListener('keydown', (e) => {
    if (list.hidden || !results.length) return;
    const items = list.querySelectorAll('.autocomplete-item');

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      highlightedIndex = (highlightedIndex + 1) % results.length;
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      highlightedIndex = (highlightedIndex - 1 + results.length) % results.length;
    } else if (e.key === 'Enter' && highlightedIndex >= 0) {
      e.preventDefault();
      const chosen = results[highlightedIndex];
      pickCoin(chosen.id, chosen.name);
      return;
    } else if (e.key === 'Escape') {
      closeList();
      return;
    }

    items.forEach((item, i) => {
      item.classList.toggle('is-highlighted', i === highlightedIndex);
    });
  });

  list.addEventListener('click', (e) => {
    const item = e.target.closest('.autocomplete-item');
    if (!item) return;
    const coinId = item.dataset.coinId;
    const name = item.querySelector('.autocomplete-item__name')?.textContent || coinId;
    pickCoin(coinId, name);
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const query = input.value.trim();
    if (!query) return;

    if (highlightedIndex >= 0 && results[highlightedIndex]) {
      pickCoin(results[highlightedIndex].id, results[highlightedIndex].name);
      return;
    }

    try {
      const coins = await searchCoins(query);
      if (coins.length > 0) {
        pickCoin(coins[0].id, coins[0].name);
      } else {
        const localId = resolveLocalCoin(query);
        if (localId) {
          pickCoin(localId, query);
        } else {
          renderResults([]);
        }
      }
    } catch {
      const localId = resolveLocalCoin(query);
      pickCoin(localId || query.toLowerCase(), query);
    }
  });

  clearBtn.addEventListener('click', () => {
    input.value = '';
    clearBtn.hidden = true;
    closeList();
    input.focus();
  });

  chipsContainer.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip[data-coin-id]');
    if (!chip) return;
    pickCoin(chip.dataset.coinId, '');
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-wrapper')) {
      closeList();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (
      e.key === '/' &&
      document.activeElement !== input &&
      !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)
    ) {
      e.preventDefault();
      input.focus();
    }
  });
}
