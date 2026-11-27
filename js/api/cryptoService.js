const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';
const CACHE_PREFIX = 'coinpulse_cache_v1_';
const MARKET_TTL_MS = 60 * 1000; // 60 seconds
const SEARCH_TTL_MS = 5 * 60 * 1000; // 5 minutes

const memoryCache = new Map();
let activeSearchController = null;

function getCache(key, allowStale = false) {
  const now = Date.now();
  const mem = memoryCache.get(key);
  if (mem) {
    if (allowStale || now < mem.expiresAt) {
      return { data: mem.data, stale: now >= mem.expiresAt, updatedAt: mem.updatedAt };
    }
  }
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    memoryCache.set(key, parsed);
    if (allowStale || now < parsed.expiresAt) {
      return { data: parsed.data, stale: now >= parsed.expiresAt, updatedAt: parsed.updatedAt };
    }
  } catch {
    return null;
  }
  return null;
}

function setCache(key, data, ttlMs) {
  const entry = {
    data,
    updatedAt: Date.now(),
    expiresAt: Date.now() + ttlMs
  };
  memoryCache.set(key, entry);
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry));
  } catch {
    // Ignore storage quota errors cleanly
  }
}

async function fetchJsonWithCache(cacheKey, url, ttlMs, signal) {
  const cached = getCache(cacheKey, false);
  if (cached) {
    return { data: cached.data, source: 'live', updatedAt: cached.updatedAt };
  }

  try {
    const res = await fetch(url, { signal });
    if (!res.ok) {
      const err = new Error(`API HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }
    const data = await res.json();
    setCache(cacheKey, data, ttlMs);
    return { data, source: 'live', updatedAt: Date.now() };
  } catch (error) {
    if (error.name === 'AbortError') {
      throw error;
    }
    const stale = getCache(cacheKey, true);
    if (stale) {
      return { data: stale.data, source: 'cached', updatedAt: stale.updatedAt };
    }
    throw error;
  }
}

/**
 * Fetch top market coins with 7-day sparklines.
 */
export async function fetchTopMarkets(currency = 'usd', perPage = 12) {
  const key = `markets_${currency}_${perPage}`;
  const url = `${COINGECKO_BASE}/coins/markets?vs_currency=${encodeURIComponent(currency)}&order=market_cap_desc&per_page=${perPage}&page=1&sparkline=true&price_change_percentage=24h`;
  return fetchJsonWithCache(key, url, MARKET_TTL_MS);
}

/**
 * Fetch detailed market snapshot for a single coin ID.
 * Falls back to CoinCap spot price if CoinGecko is rate-limited and uncached.
 */
export async function fetchCoinMarket(coinId, currency = 'usd') {
  const key = `coin_${coinId}_${currency}`;
  const url = `${COINGECKO_BASE}/coins/markets?vs_currency=${encodeURIComponent(currency)}&ids=${encodeURIComponent(coinId)}&sparkline=true&price_change_percentage=24h`;

  try {
    const result = await fetchJsonWithCache(key, url, MARKET_TTL_MS);
    const coin = Array.isArray(result.data) ? result.data[0] : null;
    if (!coin) {
      throw new Error('Cryptocurrency not found.');
    }
    return { coin, source: result.source, updatedAt: result.updatedAt };
  } catch (err) {
    if (currency === 'usd') {
      const fallback = await fetchCoinCapFallback(coinId);
      if (fallback) {
        return { coin: fallback, source: 'cached', updatedAt: Date.now() };
      }
    }
    throw err;
  }
}

/**
 * Search coins for autocomplete with AbortController cancellation.
 */
export async function searchCoins(query) {
  const trimmed = query.trim();
  if (!trimmed) return [];

  if (activeSearchController) {
    activeSearchController.abort();
  }
  activeSearchController = new AbortController();

  const key = `search_${trimmed.toLowerCase()}`;
  const url = `${COINGECKO_BASE}/search?query=${encodeURIComponent(trimmed)}`;
  const result = await fetchJsonWithCache(key, url, SEARCH_TTL_MS, activeSearchController.signal);
  return (result.data?.coins || []).slice(0, 8);
}

async function fetchCoinCapFallback(coinId) {
  try {
    const res = await fetch(`https://api.coincap.io/v2/assets/${encodeURIComponent(coinId)}`);
    if (!res.ok) return null;
    const json = await res.json();
    const d = json?.data;
    if (!d) return null;
    return {
      id: d.id,
      name: d.name,
      symbol: d.symbol?.toLowerCase() || '',
      image: `https://assets.coincap.io/assets/icons/${(d.symbol || 'btc').toLowerCase()}@2x.png`,
      market_cap_rank: Number(d.rank) || null,
      current_price: Number(d.priceUsd),
      price_change_percentage_24h: Number(d.changePercent24Hr),
      market_cap: Number(d.marketCapUsd),
      total_volume: Number(d.volumeUsd24Hr),
      high_24h: null,
      low_24h: null,
      circulating_supply: Number(d.supply),
      sparkline_in_7d: { price: [] }
    };
  } catch {
    return null;
  }
}
