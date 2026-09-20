import { db, isConfigured } from './supabase-client.js?v=4';
import { getSession, onAuthChange } from './auth.js?v=4';
import { escapeHtml } from './render-utils.js?v=4';
import { fetchDestinationImage } from './unsplash.js?v=4';

const REGIONS = [
  { key: 'europe', label: 'Europe' },
  { key: 'america', label: 'Americas' },
  { key: 'asia', label: 'Asia' },
  { key: 'africa', label: 'Africa' },
];

const STATUSES = [
  { key: 'idea', label: 'Idea' },
  { key: 'planning', label: 'Planning' },
  { key: 'booked', label: 'Booked' },
];

export async function renderAddTripForm() {
  const root = document.getElementById('add-trip-root');

  if (!isConfigured) {
    root.innerHTML = `<p class="notice">Supabase isn't configured yet. See README.md.</p>`;
    return;
  }

  const editId = new URLSearchParams(window.location.search).get('id');

  draw(await getSession());
  onAuthChange(draw);

  async function draw(session) {
    if (!session) {
      root.innerHTML = `<p class="notice">Sign in (top right) to add a trip.</p>`;
      return;
    }

    let existing = null;
    if (editId) {
      const { data, error } = await db.from('destinations').select('*').eq('id', editId).single();
      if (error || !data) {
        root.innerHTML = `<p class="notice notice-error">Trip not found.</p>`;
        return;
      }
      if (data.created_by !== session.user.id) {
        root.innerHTML = `<p class="notice notice-error">You can only edit trips you added.</p>`;
        return;
      }
      existing = data;
    }

    document.title = existing ? `Edit ${existing.name} (Travel Plans)` : 'Add a Trip (Travel Plans)';

    root.innerHTML = `
      <h1>${existing ? 'Edit trip' : 'Add a trip'}</h1>
      <form id="add-trip-form" class="trip-form">
        <label>Region
          <select name="region" required>
            ${REGIONS.map((r) => `<option value="${r.key}" ${existing?.region === r.key ? 'selected' : ''}>${r.label}</option>`).join('')}
          </select>
        </label>
        <label>Status
          <select name="status">
            ${STATUSES.map((s) => `<option value="${s.key}" ${(existing?.status ?? 'idea') === s.key ? 'selected' : ''}>${s.label}</option>`).join('')}
          </select>
        </label>
        <label>Name
          <input name="name" type="text" required placeholder="e.g. Kyoto, Japan" value="${existing ? escapeHtml(existing.name) : ''}" />
        </label>
        <label>Why go
          <textarea name="description" placeholder="Short description">${existing ? escapeHtml(existing.description ?? '') : ''}</textarea>
        </label>
        <label>Planned year (leave blank if undecided)
          <input name="planned_year" type="number" placeholder="e.g. 2027" value="${existing?.planned_year ?? ''}" />
        </label>
        <label>Best time
          <input name="best_time" type="text" placeholder="e.g. May-Jun, Sep-Oct" value="${existing ? escapeHtml(existing.best_time ?? '') : ''}" />
        </label>
        <label>Ideal length
          <input name="ideal_length" type="text" placeholder="e.g. 7-8 nights" value="${existing ? escapeHtml(existing.ideal_length ?? '') : ''}" />
        </label>
        <label>Budget
          <input name="budget" type="text" placeholder="e.g. CHF 3,800-6,500" value="${existing ? escapeHtml(existing.budget ?? '') : ''}" />
        </label>
        <label>Drive distance
          <input name="drive_distance" type="text" placeholder="e.g. 350-550 km" value="${existing ? escapeHtml(existing.drive_distance ?? '') : ''}" />
        </label>
        <label>Fly time
          <input name="fly_time" type="text" placeholder="e.g. ~2h 10" value="${existing ? escapeHtml(existing.fly_time ?? '') : ''}" />
        </label>
        <button type="submit">${existing ? 'Save changes' : 'Add trip'}</button>
        <p id="add-trip-status" class="signin-status"></p>
      </form>
    `;

    document.getElementById('add-trip-form').addEventListener('submit', (e) => handleSubmit(e, existing));
  }
}

async function handleSubmit(e, existing) {
  e.preventDefault();
  const form = e.target;
  const status = document.getElementById('add-trip-status');
  const submitBtn = form.querySelector('button[type="submit"]');

  const name = form.name.value.trim();
  if (!name) {
    status.textContent = 'Name is required.';
    return;
  }

  submitBtn.disabled = true;
  status.textContent = '';

  const region = form.region.value;
  const payload = {
    region,
    status: form.status.value,
    name,
    description: form.description.value.trim() || null,
    planned_year: form.planned_year.value ? parseInt(form.planned_year.value, 10) : null,
    best_time: form.best_time.value.trim() || null,
    ideal_length: form.ideal_length.value.trim() || null,
    budget: form.budget.value.trim() || null,
    drive_distance: form.drive_distance.value.trim() || null,
    fly_time: form.fly_time.value.trim() || null,
  };

  let destId = existing?.id;
  let error;

  if (existing) {
    ({ error } = await db.from('destinations').update(payload).eq('id', existing.id));
  } else {
    const session = await getSession();
    payload.created_by = session.user.id;

    const image = await fetchDestinationImage(name);
    if (image) Object.assign(payload, image);

    const { data: last } = await db
      .from('destinations')
      .select('sort_order')
      .eq('region', region)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();
    payload.sort_order = (last?.sort_order ?? 0) + 1;

    const { data: inserted, error: insertError } = await db.from('destinations').insert(payload).select('id').single();
    error = insertError;
    destId = inserted?.id;
  }

  if (error) {
    status.textContent = error.message;
    submitBtn.disabled = false;
    return;
  }

  window.location.href = `destination.html?id=${destId}`;
}
