import { db, isConfigured } from './supabase-client.js?v=4';
import { getSession, onAuthChange } from './auth.js?v=4';
import { escapeHtml } from './render-utils.js?v=4';

const REGIONS = [
  { key: 'europe', label: 'Europe' },
  { key: 'america', label: 'Americas' },
  { key: 'asia', label: 'Asia' },
  { key: 'africa', label: 'Africa' },
];

const STATUS_LABELS = { idea: 'Idea', planning: 'Planning', booked: 'Booked' };

const BUZZ_ICON = `<svg viewBox="0 0 32 32" title="Popular with the crew"><path d="M16 5 L18.5 13.5 L27 16 L18.5 18.5 L16 27 L13.5 18.5 L5 16 L13.5 13.5 Z" fill="#c94f2c"/><circle cx="16" cy="16" r="2.4" fill="#b5892e"/></svg>`;

export async function renderDestinations() {
  const root = document.getElementById('regions');

  if (!isConfigured) {
    root.innerHTML = `<p class="notice">
      Supabase isn't configured yet. Edit <code>js/config.js</code> with your project URL and anon key,
      then run <code>supabase/schema.sql</code> (and optionally <code>supabase/seed.sql</code>) in the
      Supabase SQL Editor. See <code>README.md</code> for the full setup.
    </p>`;
    return;
  }

  renderAddTripCta();

  const { data: destinations, error } = await db
    .from('destinations')
    .select('*, subscriptions(commitment), comments(id), profiles(display_name)')
    .order('sort_order', { ascending: true });

  if (error) {
    root.innerHTML = `<p class="notice notice-error">Couldn't load destinations: ${escapeHtml(error.message)}</p>`;
    return;
  }

  root.innerHTML = REGIONS.map((region) =>
    renderRegion(region, destinations.filter((d) => d.region === region.key))
  ).join('');
}

async function renderAddTripCta() {
  const el = document.getElementById('add-trip-cta');
  if (!el) return;

  draw(await getSession());
  onAuthChange(draw);

  function draw(session) {
    el.innerHTML = session ? `<a class="add-trip-link" href="add.html">+ Add a trip</a>` : '';
  }
}

function renderRegion(region, destinations) {
  const cards = destinations.length
    ? destinations.map(renderCard).join('')
    : `<p class="empty">No destinations yet.</p>`;
  return `
    <section class="region">
      <h2>${region.label}</h2>
      <div class="card-grid">${cards}</div>
    </section>
  `;
}

function renderCard(dest) {
  const count = dest.subscriptions?.length ?? 0;
  const commentCount = dest.comments?.length ?? 0;
  const committedCount = dest.subscriptions?.filter((s) => s.commitment === 'committed').length ?? 0;
  const isBuzzing = committedCount >= 2 || commentCount >= 3;
  const badge = [dest.planned_year, dest.best_time].filter(Boolean).join(' · ');
  const facts = [dest.ideal_length, dest.budget].filter(Boolean);
  const creatorName = dest.profiles?.display_name;
  const safeImageUrl = dest.image_url ? dest.image_url.replace(/"/g, '%22').replace(/'/g, '%27') : '';
  const photoStyle = safeImageUrl
    ? ` style="background-image: linear-gradient(rgba(42,31,24,0.72), rgba(42,31,24,0.72)), url('${safeImageUrl}')"`
    : '';
  return `
    <a class="card${dest.image_url ? ' card-photo' : ''}" href="destination.html?id=${dest.id}"${photoStyle}>
      <div class="card-top">
        <h3>${escapeHtml(dest.name)}</h3>
        <div class="card-badges">
          ${isBuzzing ? `<span class="card-buzz">${BUZZ_ICON}</span>` : ''}
          ${dest.status && dest.status !== 'idea' ? `<span class="badge badge-${dest.status}">${STATUS_LABELS[dest.status] ?? dest.status}</span>` : ''}
          ${badge ? `<span class="year">${escapeHtml(badge)}</span>` : ''}
        </div>
      </div>
      <p>${escapeHtml(dest.description ?? '')}</p>
      ${facts.length ? `<div class="card-facts">${facts.map((f) => `<span>${escapeHtml(f)}</span>`).join('')}</div>` : ''}
      ${creatorName ? `<div class="card-creator"><span class="badge badge-creator">by ${escapeHtml(creatorName)}</span></div>` : ''}
      <div class="card-stats">
        <span class="subscriber-count">${count} subscribed</span>
        <span class="subscriber-count">${commentCount} comment${commentCount === 1 ? '' : 's'}</span>
      </div>
    </a>
  `;
}
