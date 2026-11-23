import { db, isConfigured } from './supabase-client.js?v=4';
import { getSession, onAuthChange, signInWithEmail, signOut } from './auth.js?v=4';
import { escapeHtml } from './render-utils.js?v=4';

export async function renderAuthWidget() {
  const el = document.getElementById('auth-widget');
  if (!el || !isConfigured) return;

  draw(await getSession());
  onAuthChange(draw);

  async function draw(session) {
    if (!session) {
      el.innerHTML = `
        <form id="signin-form" class="signin-form">
          <input type="email" id="signin-email" placeholder="you@email.com" required />
          <button type="submit" id="signin-submit">Sign in</button>
          <button type="button" id="first-time-toggle" class="signup-btn">
            <span class="signup-btn-main">Sign Up</span>
            <span class="signup-btn-sub">First time here?</span>
          </button>
          <div id="first-time-fields" class="first-time-fields" hidden>
            <input type="text" id="signin-name" placeholder="Your name" />
            <label class="signin-toggle"><input type="checkbox" id="signin-show-name" />Show my name in the crew list</label>
          </div>
        </form>
        <span id="signin-status" class="signin-status"></span>
      `;
      document.getElementById('first-time-toggle').addEventListener('click', () => {
        const fields = document.getElementById('first-time-fields');
        const submitBtn = document.getElementById('signin-submit');
        const toggleMain = document.querySelector('#first-time-toggle .signup-btn-main');
        const toggleSub = document.querySelector('#first-time-toggle .signup-btn-sub');

        fields.hidden = !fields.hidden;

        if (!fields.hidden) {
          submitBtn.textContent = 'Sign Up';
          toggleMain.textContent = 'Never mind';
          toggleSub.textContent = 'I have an account';
          document.getElementById('signin-name').focus();
        } else {
          submitBtn.textContent = 'Sign in';
          toggleMain.textContent = 'Sign Up';
          toggleSub.textContent = 'First time here?';
        }
      });
      document.getElementById('signin-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('signin-name').value.trim();
        const email = document.getElementById('signin-email').value.trim();
        const showName = document.getElementById('signin-show-name').checked;
        const status = document.getElementById('signin-status');
        try {
          await signInWithEmail(email, name, showName);
          status.textContent = 'Check your email for a sign-in link.';
        } catch (err) {
          status.textContent = err.message;
        }
      });
    } else {
      const { data: profile } = await db
        .from('profiles')
        .select('display_name, show_name_publicly')
        .eq('id', session.user.id)
        .single();
      const displayName = profile?.display_name ?? session.user.email;
      const showNamePublicly = profile?.show_name_publicly ?? false;

      el.innerHTML = `
        <div class="current-user-wrap">
          <span class="current-user" id="current-user-name" title="Click to edit">${escapeHtml(displayName)}</span>
          <button id="signout-btn">Sign out</button>
        </div>
      `;
      document.getElementById('signout-btn').addEventListener('click', () => signOut());
      document
        .getElementById('current-user-name')
        .addEventListener('click', () => startProfileEdit(session, displayName, showNamePublicly));
    }
  }

  function startProfileEdit(session, currentName, currentShowPublicly) {
    const wrap = document.querySelector('.current-user-wrap');
    if (!wrap || wrap.querySelector('.profile-edit-form')) return;

    const form = document.createElement('form');
    form.className = 'profile-edit-form';
    form.innerHTML = `
      <input type="text" class="name-edit-input" value="${escapeHtml(currentName)}" />
      <label class="profile-edit-toggle"><input type="checkbox" ${currentShowPublicly ? 'checked' : ''} />Show my name in the crew list</label>
      <div class="profile-edit-actions">
        <button type="submit">Save</button>
        <button type="button" class="profile-edit-cancel">Cancel</button>
      </div>
      <span class="profile-edit-status signin-status"></span>
    `;
    wrap.appendChild(form);

    const nameInput = form.querySelector('.name-edit-input');
    nameInput.focus();
    nameInput.select();

    form.querySelector('.profile-edit-cancel').addEventListener('click', () => form.remove());

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const newName = nameInput.value.trim();
      const showNamePublicly = form.querySelector('input[type="checkbox"]').checked;
      const status = form.querySelector('.profile-edit-status');
      if (!newName) return;

      const { error } = await db
        .from('profiles')
        .update({ display_name: newName, show_name_publicly: showNamePublicly })
        .eq('id', session.user.id);

      if (error) {
        status.textContent = error.message;
        return;
      }
      draw(session);
    });
  }
}
