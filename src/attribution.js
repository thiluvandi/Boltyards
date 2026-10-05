// Remembers where a visitor came from (first touch, 30 days) so the contact form can tell us.
// Tag links you share like: https://www.boltyards.com/?utm_source=reddit&utm_medium=social&utm_campaign=r_webdev
const KEY = 'by-attribution';
const TTL = 30 * 24 * 3600 * 1000;

function read() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null');
    return v && Date.now() - v.ts < TTL ? v : null;
  } catch { return null; }
}

export function captureAttribution() {
  const q = new URLSearchParams(location.search);
  const milestone = q.get('milestone');
  if (milestone) { try { localStorage.setItem('by-milestone', milestone); } catch { /* ignore */ } }
  const utm = { source: q.get('utm_source'), medium: q.get('utm_medium'), campaign: q.get('utm_campaign'), content: q.get('utm_content') };
  let ref = '';
  try { if (document.referrer) { const h = new URL(document.referrer).hostname; if (h !== location.hostname) ref = h.replace(/^www\./, ''); } } catch { /* ignore */ }
  const hasUtm = Object.values(utm).some(Boolean);
  const existing = read();
  // keep the first touch unless this visit carries explicit campaign tags
  if (existing && !hasUtm) return existing;
  if (!hasUtm && !ref && !existing) return null;
  const rec = { ...utm, referrer: ref, landing: location.pathname + location.search, ts: Date.now() };
  try { localStorage.setItem(KEY, JSON.stringify(rec)); } catch { /* ignore */ }
  return rec;
}

/** Plain-text fields for the enquiry email */
export function attributionFields() {
  let milestone = '';
  try { milestone = localStorage.getItem('by-milestone') || ''; } catch { /* ignore */ }
  const extra = milestone === 'explored_all' ? { game_milestone: 'Explored all 8 buildings in the 3D tour' } : {};
  return { ...baseFields(), ...extra };
}

function baseFields() {
  const a = read();
  if (!a) return { found_us_via: 'Direct / unknown' };
  const tag = [a.source, a.medium, a.campaign, a.content].filter(Boolean).join(' / ');
  return {
    found_us_via: tag || a.referrer || 'Direct / unknown',
    referrer_site: a.referrer || '-',
    first_landing_page: a.landing || '-',
  };
}

/** Vercel Web Analytics (cookie-less visitor and referrer stats). Only runs on the live site. */
export function initAnalytics() {
  if (import.meta.env.DEV) return;
  const s = document.createElement('script');
  s.defer = true;
  s.src = '/_vercel/insights/script.js';
  document.head.append(s);
}
