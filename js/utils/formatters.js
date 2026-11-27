const CURRENCY_META = {
  usd: { code: 'USD', locale: 'en-US' },
  ngn: { code: 'NGN', locale: 'en-NG' },
  eur: { code: 'EUR', locale: 'en-IE' },
  gbp: { code: 'GBP', locale: 'en-GB' },
  jpy: { code: 'JPY', locale: 'ja-JP' }
};

/**
 * Format a numeric value as fiat currency with adaptive precision for low-priced coins.
 */
export function formatCurrency(value, currency = 'usd') {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '—';
  }
  const num = Number(value);
  const meta = CURRENCY_META[currency] || CURRENCY_META.usd;

  let maxDigits = 2;
  if (num > 0 && num < 0.01) {
    maxDigits = 6;
  } else if (num >= 0.01 && num < 1) {
    maxDigits = 4;
  } else if (meta.code === 'JPY' && num >= 1) {
    maxDigits = 0;
  }

  return new Intl.NumberFormat(meta.locale, {
    style: 'currency',
    currency: meta.code,
    minimumFractionDigits: num >= 1 && meta.code !== 'JPY' ? 2 : 0,
    maximumFractionDigits: maxDigits
  }).format(num);
}

/**
 * Format large financial numbers compactly (e.g. $1.84T, $42.5B).
 */
export function formatCompactCurrency(value, currency = 'usd') {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '—';
  }
  const meta = CURRENCY_META[currency] || CURRENCY_META.usd;
  return new Intl.NumberFormat(meta.locale, {
    style: 'currency',
    currency: meta.code,
    notation: 'compact',
    maximumFractionDigits: 2
  }).format(Number(value));
}

/**
 * Format circulating supply or general large numbers compactly.
 */
export function formatCompactNumber(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '—';
  }
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 2
  }).format(Number(value));
}

/**
 * Format a 24h percentage change with sign.
 */
export function formatPercent(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '0.00%';
  }
  const num = Number(value);
  const sign = num > 0 ? '+' : '';
  return `${sign}${num.toFixed(2)}%`;
}

/**
 * Escape HTML special characters for safe template rendering.
 */
export function escapeHtml(str = '') {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
