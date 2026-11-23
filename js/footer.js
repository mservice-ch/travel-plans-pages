import { db, isConfigured } from './supabase-client.js?v=4';
import { getSession, onAuthChange } from './auth.js?v=4';

// Supabase's client can occasionally stall on its cross-tab session lock
// (a known Safari issue), and a hung promise here would otherwise leave
// the whole footer blank forever with no error to show for it.
function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((resolve) => setTimeout(() => resolve(undefined), ms))]);
}

export async function renderFooter() {
  const el = document.getElementById('site-footer');
  if (!el || !isConfigured) return;

  const countResult = await withTimeout(db.from('profiles').select('id', { count: 'exact', head: true }), 4000);
  const count = countResult?.count;
  const crewLine =
    count && count > 0
      ? `Built for the crew (${count} traveler${count === 1 ? '' : 's'} signed up so far).`
      : 'Built for the crew.';

  el.innerHTML = `
    <div id="feedback-box"></div>
    <p>${crewLine}</p>
  `;

  const session = await withTimeout(getSession(), 4000);
  drawFeedbackBox(session ?? null);
  onAuthChange(drawFeedbackBox);
}

function drawFeedbackBox(session) {
  const box = document.getElementById('feedback-box');
  if (!box) return;

  if (!session) {
    box.innerHTML = `<p class="notice feedback-notice">Sign in (top right) to leave feedback.</p>`;
    return;
  }

  box.innerHTML = `
    <form id="feedback-form" class="feedback-form">
      <textarea id="feedback-body" placeholder="Ideas, bugs, anything, tell us what you think" required></textarea>
      <button type="submit">Send feedback</button>
      <span id="feedback-status" class="signin-status"></span>
    </form>
  `;

  document.getElementById('feedback-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = document.getElementById('feedback-body').value.trim();
    if (!body) return;

    const btn = e.target.querySelector('button');
    const status = document.getElementById('feedback-status');
    btn.disabled = true;

    const { error } = await db.from('feedback').insert({ user_id: session.user.id, body });

    if (error) {
      status.textContent = error.message;
      btn.disabled = false;
      return;
    }

    box.innerHTML = `<p class="notice feedback-thanks">Thanks for the feedback!</p>`;
  });
}
