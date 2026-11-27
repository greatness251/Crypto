const STORAGE_KEYS = {
  currency: 'coinpulse_currency',
  theme: 'coinpulse_theme',
  watchlist: 'coinpulse_watchlist'
};

function readStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function readString(key, fallback) {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

function readTheme() {
  const saved = readString(STORAGE_KEYS.theme, 'dark');
  return saved === 'light' || saved === 'dark' ? saved : 'dark';
}

const initialState = {
  currency: readString(STORAGE_KEYS.currency, 'usd'),
  theme: readTheme(),
  watchlist: readStorage(STORAGE_KEYS.watchlist, ['bitcoin', 'ethereum', 'solana']),
  activeCoinId: 'bitcoin',
  activeCoinData: null,
  spotlightLoading: true,
  spotlightError: null,
  markets: [],
  marketsLoading: true,
  marketsError: null,
  marketTab: 'top',
  appsCategory: 'all',
  apiStatus: 'live', // 'live' | 'cached' | 'error'
  apiStatusLabel: 'Live'
};

const listeners = new Set();

export const store = {
  getState() {
    return initialState;
  },

  setState(patch) {
    Object.assign(initialState, patch);
    listeners.forEach((fn) => fn(initialState));
  },

  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  setCurrency(currency) {
    try {
      localStorage.setItem(STORAGE_KEYS.currency, currency);
    } catch {}
    this.setState({ currency });
  },

  toggleTheme() {
    const next = initialState.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem(STORAGE_KEYS.theme, next);
    } catch {}
    this.setState({ theme: next });
  },

  toggleWatchlist(coinId) {
    const exists = initialState.watchlist.includes(coinId);
    const next = exists
      ? initialState.watchlist.filter((id) => id !== coinId)
      : [...initialState.watchlist, coinId];
    try {
      localStorage.setItem(STORAGE_KEYS.watchlist, JSON.stringify(next));
    } catch {}
    this.setState({ watchlist: next });
  },

  isWatched(coinId) {
    return initialState.watchlist.includes(coinId);
  }
};
