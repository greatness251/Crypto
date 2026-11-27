import { CRYPTO_APPS } from '../data/cryptoApps.js';
import { store } from '../state/store.js';
import { escapeHtml } from '../utils/formatters.js';

export function initAppsHub() {
  const grid = document.getElementById('apps-grid');
  const filterPills = document.querySelectorAll('#apps-filter-pills .filter-pill');

  filterPills.forEach((pill) => {
    pill.addEventListener('click', () => {
      store.setState({ appsCategory: pill.dataset.category });
    });
  });

  function render() {
    const { appsCategory } = store.getState();

    filterPills.forEach((pill) => {
      const active = pill.dataset.category === appsCategory;
      pill.classList.toggle('is-active', active);
      pill.setAttribute('aria-selected', String(active));
    });

    const items =
      appsCategory === 'all'
        ? CRYPTO_APPS
        : CRYPTO_APPS.filter((app) => app.category === appsCategory);

    grid.innerHTML = items
      .map(
        (app) => `
        <article class="app-card">
          <div>
            <div class="app-card__top">
              <div class="app-card__brand">
                <span class="app-card__badge" style="background:${escapeHtml(app.color)};">${escapeHtml(app.badge)}</span>
                <div>
                  <h3 class="app-card__title">${escapeHtml(app.name)}</h3>
                  <span class="app-card__tag">${escapeHtml(app.tag)}</span>
                </div>
              </div>
            </div>
            <p class="app-card__desc" style="margin-top:12px;">${escapeHtml(app.description)}</p>
          </div>
          <a class="app-card__link" href="${escapeHtml(app.url)}" target="_blank" rel="noopener noreferrer">
            Open ${escapeHtml(app.name)}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M7 17L17 7"></path>
              <path d="M7 7h10v10"></path>
            </svg>
          </a>
        </article>`
      )
      .join('');
  }

  render();
  store.subscribe(render);
}
