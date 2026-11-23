// Fill these in from your Supabase project: Project Settings -> API.
// The anon/public key is designed to be exposed in client code like this —
// it's safe to commit. Access control comes from the Row Level Security
// policies in supabase/schema.sql, not from hiding this key.

export const SUPABASE_URL = 'https://zboukapovyawdadttaar.supabase.co';
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpib3VrYXBvdnlhd2RhZHR0YWFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk5MjA3NjIsImV4cCI6MjEwNTQ5Njc2Mn0.Z7d__oY4H_otVcliWnUBU8oO_SKYtwP8hYvTf230lGc';

// Optional. From unsplash.com/developers -> your app -> Access Key. Used to
// pull a background photo when a trip is added. The demo tier's key is
// meant for exactly this kind of client-side use (same trust model as the
// Supabase anon key above) — it's rate-limited, not secret. Leave the
// placeholder to skip photo fetching entirely; nothing else depends on it.
export const UNSPLASH_ACCESS_KEY = '-XQJ1_gIuVpQ4E01KzCU85lV4vw0TgyRYx54Rew4jNE';
