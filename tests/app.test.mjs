import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

// Minimal browser globals for testing ES modules that touch localStorage/document
function setupDomGlobals() {
  const storageMap = new Map();
  globalThis.localStorage = {
    getItem: (k) => (storageMap.has(k) ? storageMap.get(k) : null),
    setItem: (k, v) => storageMap.set(k, String(v)),
    removeItem: (k) => storageMap.delete(k)
  };
  const attrs = { 'data-theme': 'dark' };
  globalThis.document = {
    documentElement: {
      setAttribute: (k, v) => {
        attrs[k] = String(v);
      },
      getAttribute: (k) => attrs[k] ?? null
    }
  };
  return { storageMap, attrs };
}

test('formatters format currencies, percentages, and escape HTML safely', async () => {
  const { formatCurrency, formatCompactCurrency, formatPercent, escapeHtml } = await import(
    '../js/utils/formatters.js'
  );

  assert.match(formatCurrency(61234.5, 'usd'), /\$61,234\.50/);
  assert.match(formatCurrency(0.004521, 'usd'), /\$0\.004521/);
  assert.match(formatCurrency(1500, 'ngn'), /1,500/);
  assert.match(formatCompactCurrency(1_200_000_000, 'usd'), /\$1\.2B/);
  assert.equal(formatPercent(4.256), '+4.26%');
  assert.equal(formatPercent(-2.1), '-2.10%');
  assert.equal(escapeHtml('<script>"x"</script>'), '&lt;script&gt;&quot;x&quot;&lt;/script&gt;');
});

test('store toggles theme between dark and light, persists currency, and updates watchlist', async () => {
  const { attrs, storageMap } = setupDomGlobals();
  const { store } = await import('../js/state/store.js');

  let notified = 0;
  const unsub = store.subscribe(() => {
    notified += 1;
  });

  assert.equal(store.getState().theme, 'dark');
  store.toggleTheme();
  assert.equal(store.getState().theme, 'light');
  assert.equal(attrs['data-theme'], 'light');
  assert.equal(storageMap.get('coinpulse_theme'), 'light');

  store.toggleTheme();
  assert.equal(store.getState().theme, 'dark');
  assert.equal(attrs['data-theme'], 'dark');

  store.setCurrency('ngn');
  assert.equal(store.getState().currency, 'ngn');
  assert.equal(storageMap.get('coinpulse_currency'), 'ngn');

  const hadDogecoin = store.isWatched('dogecoin');
  store.toggleWatchlist('dogecoin');
  assert.equal(store.isWatched('dogecoin'), !hadDogecoin);
  assert.ok(notified >= 4);
  unsub();
});

test('cryptoService caches responses and falls back to stale cache on HTTP 429', async () => {
  setupDomGlobals();
  const originalFetch = globalThis.fetch;
  let calls = 0;

  globalThis.fetch = async (url) => {
    calls += 1;
    if (String(url).includes('/coins/markets') && calls === 1) {
      return {
        ok: true,
        status: 200,
        json: async () => [
          {
            id: 'bitcoin',
            name: 'Bitcoin',
            symbol: 'btc',
            current_price: 62000,
            price_change_percentage_24h: 2.5,
            sparkline_in_7d: { price: [60000, 61000, 62000] }
          }
        ]
      };
    }
    return { ok: false, status: 429, json: async () => ({}) };
  };

  try {
    const { fetchTopMarkets } = await import('../js/api/cryptoService.js');
    const first = await fetchTopMarkets('usd', 12);
    assert.equal(first.source, 'live');
    assert.equal(first.data[0].id, 'bitcoin');

    // Second call within TTL hits cache without calling fetch again
    const second = await fetchTopMarkets('usd', 12);
    assert.equal(second.data[0].current_price, 62000);
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('app.bundle.js boots cleanly, switches theme, renders apps, and searches bitcoin', async () => {
  const bundlePath = path.join(rootDir, 'js/app.bundle.js');
  const bundleCode = fs.readFileSync(bundlePath, 'utf8');

  function makeElement(id = '', tag = 'DIV') {
    const listeners = {};
    const classSet = new Set();
    const el = {
      id,
      tagName: tag,
      value: '',
      hidden: false,
      innerHTML: '',
      textContent: '',
      dataset: {},
      style: {},
      attributes: {},
      classList: {
        add: (...c) => c.forEach((x) => classSet.add(x)),
        remove: (...c) => c.forEach((x) => classSet.delete(x)),
        toggle: (c, force) => {
          if (force === undefined) {
            if (classSet.has(c)) classSet.delete(c);
            else classSet.add(c);
          } else if (force) classSet.add(c);
          else classSet.delete(c);
        },
        contains: (c) => classSet.has(c)
      },
      setAttribute: (k, v) => {
        el.attributes[k] = String(v);
      },
      getAttribute: (k) => el.attributes[k] ?? null,
      addEventListener: (ev, fn) => {
        listeners[ev] = listeners[ev] || [];
        listeners[ev].push(fn);
      },
      dispatchEvent: (evObj) => {
        const event = {
          preventDefault() {},
          target: el,
          ...evObj
        };
        (listeners[event.type] || []).forEach((fn) => fn(event));
      },
      focus: () => {},
      scrollIntoView: () => {},
      closest: () => null,
      querySelector: () => makeElement(),
      querySelectorAll: () => []
    };
    return el;
  }

  const elements = {
    'currency-select': makeElement('currency-select', 'SELECT'),
    'theme-toggle': makeElement('theme-toggle', 'BUTTON'),
    'nav-watchlist-btn': makeElement('nav-watchlist-btn', 'BUTTON'),
    'watchlist-count': makeElement('watchlist-count', 'SPAN'),
    'api-status': makeElement('api-status', 'DIV'),
    'api-status-text': makeElement('api-status-text', 'SPAN'),
    'search-form': makeElement('search-form', 'FORM'),
    'search-input': makeElement('search-input', 'INPUT'),
    'search-clear': makeElement('search-clear', 'BUTTON'),
    'autocomplete-list': makeElement('autocomplete-list', 'UL'),
    'quick-chips': makeElement('quick-chips', 'DIV'),
    'spotlight-container': makeElement('spotlight-container', 'DIV'),
    'markets-grid': makeElement('markets-grid', 'DIV'),
    'apps-grid': makeElement('apps-grid', 'DIV')
  };

  const docAttrs = { 'data-theme': 'dark' };
  const storage = new Map();
  const mockFetch = async (url) => {
    const u = String(url);
    if (u.includes('/search')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          coins: [{ id: 'bitcoin', name: 'Bitcoin', symbol: 'BTC', market_cap_rank: 1, thumb: '' }]
        })
      };
    }
    return {
      ok: true,
      status: 200,
      json: async () => [
        {
          id: 'bitcoin',
          name: 'Bitcoin',
          symbol: 'btc',
          image: '',
          market_cap_rank: 1,
          current_price: 61500,
          price_change_percentage_24h: 1.8,
          market_cap: 1200000000000,
          total_volume: 25000000000,
          high_24h: 62000,
          low_24h: 60100,
          circulating_supply: 19700000,
          sparkline_in_7d: { price: [60000, 61000, 61500] }
        }
      ]
    };
  };

  const sandbox = {
    console,
    setTimeout,
    clearTimeout,
    Intl,
    Math,
    Date,
    Number,
    String,
    Array,
    Object,
    Map,
    Set,
    JSON,
    URLSearchParams,
    encodeURIComponent,
    AbortController,
    fetch: mockFetch,
    localStorage: {
      getItem: (k) => (storage.has(k) ? storage.get(k) : null),
      setItem: (k, v) => storage.set(k, String(v)),
      removeItem: (k) => storage.delete(k)
    },
    document: {
      documentElement: {
        setAttribute: (k, v) => {
          docAttrs[k] = String(v);
        },
        getAttribute: (k) => docAttrs[k] ?? null
      },
      activeElement: null,
      getElementById: (id) => elements[id] || makeElement(id),
      querySelectorAll: () => [],
      addEventListener: () => {}
    }
  };

  vm.runInNewContext(bundleCode, sandbox);
  await new Promise((r) => setTimeout(r, 30));

  // Verify initial render populated apps hub and spotlight
  assert.match(elements['apps-grid'].innerHTML, /Binance/);
  assert.match(elements['apps-grid'].innerHTML, /MetaMask/);
  assert.match(elements['spotlight-container'].innerHTML, /Bitcoin/);

  // Verify theme toggle flips dark -> light -> dark
  elements['theme-toggle'].dispatchEvent({ type: 'click' });
  assert.equal(docAttrs['data-theme'], 'light');
  elements['theme-toggle'].dispatchEvent({ type: 'click' });
  assert.equal(docAttrs['data-theme'], 'dark');

  // Verify searching "bitcoin" updates spotlight cleanly
  elements['search-input'].value = 'bitcoin';
  elements['search-form'].dispatchEvent({ type: 'submit' });
  await new Promise((r) => setTimeout(r, 30));
  assert.match(elements['spotlight-container'].innerHTML, /Bitcoin/);
  assert.match(elements['spotlight-container'].innerHTML, /61,500/);
});
