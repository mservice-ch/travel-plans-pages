import { db } from './supabase-client.js?v=4';

export async function getSession() {
  if (!db) return null;
  const { data } = await db.auth.getSession();
  return data.session;
}

export function onAuthChange(callback) {
  if (!db) return;
  // Supabase re-validates the session (and fires this) whenever the tab regains
  // focus, not just on actual sign-in/out — ignore anything that isn't a real
  // identity change, otherwise every re-render wipes out in-progress form input.
  let lastUserId = null;
  db.auth.onAuthStateChange((_event, session) => {
    const userId = session?.user?.id ?? null;
    if (userId === lastUserId) return;
    lastUserId = userId;
    callback(session);
  });
}

export async function signInWithEmail(email, displayName, showNamePublicly) {
  const redirectTo = window.location.origin + window.location.pathname;
  const options = { emailRedirectTo: redirectTo };
  // Only used the first time this email signs up — the trigger that creates
  // a profile prefers these over the defaults (email prefix / false). Ignored
  // for a returning user, who already has a profile (edit it via the header).
  if (displayName || showNamePublicly) {
    options.data = { display_name: displayName || undefined, show_name_publicly: showNamePublicly };
  }
  const { error } = await db.auth.signInWithOtp({ email, options });
  if (error) throw error;
}

export async function signOut() {
  await db.auth.signOut();
}
