/* Supabase connection — Dashboard → Project Settings → API.
   The anon key is public by design; access is enforced by RLS (see supabase/schema.sql). */
const SUPABASE_URL      = 'https://veewtnleyzpzbczrjdfy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZlZXd0bmxleXpwemJjenJqZGZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE1NTc4NTAsImV4cCI6MjEwNzEzMzg1MH0.9mjFSMcGXM4qd01wyIxq4Nz1qC_zKViiNy9Qo1quiOU';

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
