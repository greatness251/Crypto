import { fetchCoinMarket, fetchTopMarkets } from './api/cryptoService.js';
import { initAppsHub } from './components/appsHub.js';
import { renderSpotlight } from './components/coinSpotlight.js';
import { initMarketGrid } from './components/marketGrid.js';
import { initNavbar } from './components/navbar.js';
import { initSearchBar } from './components/searchBar.js';
import { store } from './state/store.js';

function updateApiStatus(source) {
  if (source === 'cached') {
    store.setState({ apiStatus: 'cached', apiStatusLabel: 'Cached' });
  } else {
    store.setState({ apiStatus: 'live', apiStatusLabel: 'Live' });
  }
}

async function loadSpotlight(coinId) {
  const { currency, markets } = store.getState();
  store.setState({
    activeCoinId: coinId,
    spotlightLoading: true,
    spotlightError: null
  });
  renderSpotlight(() => loadSpotlight(coinId));

  // Instant optimistic render if coin is already in loaded markets
  const inMarkets = markets.find((m) => m.id === coinId);
  if (inMarkets) {
    store.setState({
      activeCoinData: inMarkets,
      spotlightLoading: false,
      spotlightError: null
    });
    renderSpotlight(() => loadSpotlight(coinId));
    return;
  }

  try {
    const { coin, source } = await fetchCoinMarket(coinId, currency);
    updateApiStatus(source);
    store.setState({
      activeCoinData: coin,
      spotlightLoading: false,
      spotlightError: null
    });
  } catch (err) {
    store.setState({
      spotlightLoading: false,
      spotlightError: err.status === 429
        ? 'Public API rate limit reached. Please wait a moment and try again.'
        : err.message || 'Unable to fetch coin data.',
      apiStatus: 'error',
      apiStatusLabel: 'Offline'
    });
  }
  renderSpotlight(() => loadSpotlight(coinId));
}

async function loadMarkets() {
  const { currency } = store.getState();
  store.setState({ marketsLoading: true, marketsError: null });

  try {
    const { data, source } = await fetchTopMarkets(currency, 12);
    updateApiStatus(source);
    store.setState({
      markets: data,
      marketsLoading: false,
      marketsError: null
    });
  } catch (err) {
    store.setState({
      marketsLoading: false,
      marketsError: err.status === 429
        ? 'Public API rate limit reached. Please wait a moment and retry.'
        : 'Failed to load top market prices.',
      apiStatus: 'error',
      apiStatusLabel: 'Offline'
    });
  }
}

async function refreshAll() {
  const { activeCoinId } = store.getState();
  await loadMarkets();
  await loadSpotlight(activeCoinId);
}

function bootstrap() {
  initNavbar({
    onCurrencyChange: () => {
      refreshAll();
    },
    onOpenWatchlist: () => {
      store.setState({ marketTab: 'watchlist' });
    }
  });

  initSearchBar({
    onSelectCoin: (coinId) => {
      loadSpotlight(coinId);
    }
  });

  initMarketGrid({
    onSelectCoin: (coinId) => {
      loadSpotlight(coinId);
    },
    onRetry: () => {
      loadMarkets();
    }
  });

  initAppsHub();
  refreshAll();
}

bootstrap();
