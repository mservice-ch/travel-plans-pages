import { db, isConfigured } from './supabase-client.js?v=4';
import { escapeHtml } from './render-utils.js?v=4';

const COLOR_COUNT = 6;

function colorIndex(id) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return hash % COLOR_COUNT;
}

export async function renderCrew() {
  const el = document.getElementById('crew-roster');
  if (!el || !isConfigured) return;

  const { data, error } = await db
    .from('profiles')
    .select('id, display_name')
    .eq('show_name_publicly', true)
    .order('display_name');

  if (error || !data?.length) {
    el.innerHTML = '';
    return;
  }

  el.innerHTML = `
    <p class="crew-roster-label">The Crew So Far</p>
    <div class="crew-roster-badges">
      ${data
        .map((p) => `<span class="badge crew-color-${colorIndex(p.id)}">${escapeHtml(p.display_name)}</span>`)
        .join('')}
    </div>
  `;
}
