import { formatCurrency } from '../utils/formatters.js';

/**
 * Render an interactive 7-day SVG sparkline inside a container element.
 */
export function renderSparkline(container, prices = [], currency = 'usd', isPositive = true) {
  if (!container) return;

  if (!Array.isArray(prices) || prices.length < 2) {
    container.innerHTML = `<div style="height:100%;display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:0.85rem;">7-day chart unavailable</div>`;
    return;
  }

  const width = 520;
  const height = 140;
  const pad = 8;

  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;

  const points = prices.map((price, idx) => {
    const x = (idx / (prices.length - 1)) * width;
    const y = height - pad - ((price - min) / range) * (height - pad * 2);
    return { x, y, price };
  });

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(' ');
  const areaPath = `${linePath} L ${width} ${height} L 0 ${height} Z`;

  const strokeColor = isPositive ? 'var(--gain)' : 'var(--loss)';
  const gradId = `spark-grad-${Math.random().toString(36).slice(2, 8)}`;

  container.innerHTML = `
    <div class="sparkline-wrap">
      <div class="sparkline-tooltip mono" id="spark-tooltip"></div>
      <svg class="sparkline-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-label="7-day price trend">
        <defs>
          <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${strokeColor}" stop-opacity="0.32" />
            <stop offset="100%" stop-color="${strokeColor}" stop-opacity="0.0" />
          </linearGradient>
        </defs>
        <path d="${areaPath}" fill="url(#${gradId})" />
        <path d="${linePath}" fill="none" stroke="${strokeColor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
        <circle class="spark-dot" cx="0" cy="0" r="4.5" fill="${strokeColor}" stroke="var(--bg-canvas)" stroke-width="2" style="opacity:0;" />
      </svg>
    </div>
  `;

  const wrap = container.querySelector('.sparkline-wrap');
  const svg = container.querySelector('.sparkline-svg');
  const dot = container.querySelector('.spark-dot');
  const tooltip = container.querySelector('#spark-tooltip');

  wrap.addEventListener('pointermove', (e) => {
    const rect = svg.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const idx = Math.round(ratio * (points.length - 1));
    const pt = points[idx];
    if (!pt) return;

    dot.setAttribute('cx', pt.x.toFixed(2));
    dot.setAttribute('cy', pt.y.toFixed(2));
    dot.style.opacity = '1';
    tooltip.textContent = formatCurrency(pt.price, currency);
    tooltip.classList.add('is-visible');
  });

  wrap.addEventListener('pointerleave', () => {
    dot.style.opacity = '0';
    tooltip.classList.remove('is-visible');
  });
}
