/* Supabase project that holds the online courses (separate from the graduate-registry project).
   The publishable (anon) key is public by design; access is enforced by RLS (see supabase/course-schema.sql).
   Dashboard → Project Settings → API Keys → "Publishable key" (or "anon public"). */
const SUPABASE_URL      = 'https://pawvtskgquzydpppjbcd.supabase.co';
const SUPABASE_ANON_KEY = 'PASTE_PUBLISHABLE_KEY_HERE';

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
