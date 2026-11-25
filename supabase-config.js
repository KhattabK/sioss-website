/* Supabase connection — Dashboard → Project Settings → API.
   Since 25 Nov 2026 the graduate registry lives in the courses project (the old registry project was deleted).
   The anon key is public by design; access is enforced by RLS (see supabase/schema.sql). */
const SUPABASE_URL      = 'https://pawvtskgquzydpppjbcd.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_-d2JAm4vNQlq3uONGG_ivA_v6TyZFNV';

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
