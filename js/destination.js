import { db, isConfigured } from './supabase-client.js?v=4';
import { getSession, onAuthChange } from './auth.js?v=4';
import { escapeHtml, timeAgo } from './render-utils.js?v=4';

const params = new URLSearchParams(window.location.search);
const destinationId = params.get('id');

const REGION_LABELS = { europe: 'Europe', america: 'Americas', asia: 'Asia', africa: 'Africa' };
const COMMITMENT_LABELS = { interested: 'Interested', likely: 'Likely going', committed: 'Committed' };
const STATUS_LABELS = { idea: 'Idea', planning: 'Planning', booked: 'Booked' };

export async function renderDestination() {
  const root = document.getElementById('destination-root');

  if (!isConfigured) {
    root.innerHTML = `<p class="notice">Supabase isn't configured yet. See README.md.</p>`;
    return;
  }
  if (!destinationId) {
    root.innerHTML = `<p class="notice notice-error">No destination specified.</p>`;
    return;
  }

  const { data: dest, error } = await db.from('destinations').select('*').eq('id', destinationId).single();

  if (error || !dest) {
    root.innerHTML = `<p class="notice notice-error">Destination not found.</p>`;
    return;
  }

  // Looked up separately (rather than embedded via a join) so this keeps working
  // even before the `created_by` column/relationship exists on an older project.
  let authorName = null;
  if (dest.created_by) {
    const { data: author } = await db.from('profiles').select('display_name').eq('id', dest.created_by).maybeSingle();
    authorName = author?.display_name ?? null;
  }

  document.title = `${dest.name} (Travel Plans)`;

  root.innerHTML = `
    ${renderHero(dest, authorName)}
    <p class="description">${escapeHtml(dest.description ?? '')}</p>

    ${renderFacts(dest)}

    <section id="author-controls"></section>
    <section class="subscribe-box" id="subscribe-box"></section>
    <section class="subscribers" id="subscribers"></section>
    <section class="comments" id="comments"></section>
  `;

  await Promise.all([renderAuthorControls(dest), renderSubscribeBox(), renderSubscribers(), renderComments()]);

  onAuthChange(() => {
    renderAuthorControls(dest);
    renderSubscribeBox();
    renderSubscribers();
    renderComments();
  });
}

async function renderAuthorControls(dest) {
  const el = document.getElementById('author-controls');
  const session = await getSession();

  if (!session || !dest.created_by || session.user.id !== dest.created_by) {
    el.innerHTML = '';
    return;
  }

  el.innerHTML = `
    <div class="author-controls">
      <a href="add.html?id=${dest.id}">Edit trip</a>
      <button id="delete-trip-btn" class="delete-trip-btn">Delete trip</button>
    </div>
  `;

  document.getElementById('delete-trip-btn').addEventListener('click', () => handleDeleteDestination(dest));
}

async function handleDeleteDestination(dest) {
  const [{ count: subCount }, { count: commentCount }] = await Promise.all([
    db.from('subscriptions').select('id', { count: 'exact', head: true }).eq('destination_id', dest.id),
    db.from('comments').select('id', { count: 'exact', head: true }).eq('destination_id', dest.id),
  ]);

  const impact = [];
  if (subCount) impact.push(`${subCount} subscription${subCount === 1 ? '' : 's'}`);
  if (commentCount) impact.push(`${commentCount} comment${commentCount === 1 ? '' : 's'}`);
  const warning = impact.length ? ` This also removes ${impact.join(' and ')} from other people.` : '';

  if (!window.confirm(`Delete "${dest.name}"?${warning}`)) return;

  const { error } = await db.from('destinations').delete().eq('id', dest.id);
  if (error) {
    window.alert(error.message);
    return;
  }
  window.location.href = 'index.html';
}

function renderHero(dest, authorName) {
  const statusPart = dest.status && dest.status !== 'idea' ? ` · ${STATUS_LABELS[dest.status] ?? dest.status}` : '';
  const meta = `${REGION_LABELS[dest.region] ?? dest.region}${statusPart}${dest.planned_year ? ` · ${dest.planned_year}` : ''}${authorName ? ` · added by ${escapeHtml(authorName)}` : ''}`;

  if (!dest.image_url) {
    return `
      <a class="back-link" href="index.html">&larr; All destinations</a>
      <h1>${escapeHtml(dest.name)}</h1>
      <p class="meta">${meta}</p>
    `;
  }

  const safeImageUrl = dest.image_url.replace(/"/g, '%22').replace(/'/g, '%27');
  const credit =
    dest.image_credit_name && dest.image_credit_url
      ? `<p class="photo-credit">Photo by <a href="${escapeHtml(dest.image_credit_url)}" target="_blank" rel="noopener">${escapeHtml(dest.image_credit_name)}</a> on <a href="https://unsplash.com/?utm_source=travel-plans&utm_medium=referral" target="_blank" rel="noopener">Unsplash</a></p>`
      : '';

  return `
    <div class="destination-hero" style="background-image: linear-gradient(rgba(42,31,24,0.45), rgba(42,31,24,0.75)), url('${safeImageUrl}')">
      <a class="back-link" href="index.html">&larr; All destinations</a>
      <h1>${escapeHtml(dest.name)}</h1>
      <p class="meta">${meta}</p>
      ${credit}
    </div>
  `;
}

function renderFacts(dest) {
  const facts = [
    ['Best time', dest.best_time],
    ['Ideal length', dest.ideal_length],
    ['Budget for two', dest.budget],
    ['Drive from Zurich', dest.drive_distance],
    ['Fly from Zurich', dest.fly_time],
  ].filter(([, value]) => value);

  if (!facts.length) return '';

  return `
    <dl class="trip-facts">
      ${facts.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join('')}
    </dl>
  `;
}

async function renderSubscribeBox() {
  const el = document.getElementById('subscribe-box');
  const session = await getSession();

  if (!session) {
    el.innerHTML = `<p class="notice">Sign in (top right) to subscribe and comment.</p>`;
    return;
  }

  const { data: existing } = await db
    .from('subscriptions')
    .select('commitment')
    .eq('destination_id', destinationId)
    .eq('user_id', session.user.id)
    .maybeSingle();

  el.innerHTML = `
    <label for="commitment-select">Your status</label>
    <select id="commitment-select">
      <option value="">Not subscribed</option>
      ${Object.entries(COMMITMENT_LABELS)
        .map(([value, label]) => `<option value="${value}" ${existing?.commitment === value ? 'selected' : ''}>${label}</option>`)
        .join('')}
    </select>
  `;

  document.getElementById('commitment-select').addEventListener('change', async (e) => {
    const value = e.target.value;
    if (!value) {
      await db.from('subscriptions').delete().eq('destination_id', destinationId).eq('user_id', session.user.id);
    } else {
      await db
        .from('subscriptions')
        .upsert(
          { destination_id: destinationId, user_id: session.user.id, commitment: value },
          { onConflict: 'destination_id,user_id' }
        );
    }
    renderSubscribers();
  });
}

async function renderSubscribers() {
  const el = document.getElementById('subscribers');
  const { data, error } = await db
    .from('subscriptions')
    .select('commitment, profiles(display_name)')
    .eq('destination_id', destinationId);

  if (error || !data?.length) {
    el.innerHTML = `<h3>Who's in</h3><p class="empty">No one has subscribed yet.</p>`;
    return;
  }

  el.innerHTML = `
    <h3>Who's in</h3>
    <ul class="subscriber-list">
      ${data
        .map(
          (s) => `
        <li>
          <span class="name">${escapeHtml(s.profiles?.display_name ?? 'A friend')}</span>
          <span class="badge badge-${s.commitment}">${COMMITMENT_LABELS[s.commitment] ?? s.commitment}</span>
        </li>
      `
        )
        .join('')}
    </ul>
  `;
}

async function renderComments() {
  const el = document.getElementById('comments');
  const session = await getSession();

  const { data, error } = await db
    .from('comments')
    .select('id, body, created_at, user_id, profiles(display_name)')
    .eq('destination_id', destinationId)
    .order('created_at', { ascending: true });

  const list =
    !error && data?.length
      ? data
          .map(
            (c) => `
        <li>
          <span class="name">${escapeHtml(c.profiles?.display_name ?? 'A friend')}</span>
          <span class="time">${timeAgo(c.created_at)}</span>
          <p>${escapeHtml(c.body)}</p>
          ${session?.user.id === c.user_id ? `<button class="delete-comment" data-id="${c.id}">Delete</button>` : ''}
        </li>
      `
          )
          .join('')
      : `<li class="empty">No comments yet.</li>`;

  el.innerHTML = `
    <h3>Comments</h3>
    <ul class="comment-list">${list}</ul>
    ${
      session
        ? `<form id="comment-form">
             <textarea id="comment-body" placeholder="Say something..." required></textarea>
             <button type="submit">Post</button>
           </form>`
        : `<p class="notice">Sign in to comment.</p>`
    }
  `;

  const form = document.getElementById('comment-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const body = document.getElementById('comment-body').value.trim();
      if (!body) return;
      await db.from('comments').insert({ destination_id: destinationId, user_id: session.user.id, body });
      renderComments();
    });
  }

  el.querySelectorAll('.delete-comment').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await db.from('comments').delete().eq('id', btn.dataset.id);
      renderComments();
    });
  });
}
