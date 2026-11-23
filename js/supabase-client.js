import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js?v=4';

export const isConfigured =
  !SUPABASE_URL.includes('YOUR-PROJECT') && !SUPABASE_ANON_KEY.includes('YOUR-ANON');

// `supabase` is the global from the CDN script tag loaded in each HTML page.
export const db = isConfigured ? supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
