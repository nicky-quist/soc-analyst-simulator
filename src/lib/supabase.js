// Lazily-created Supabase client. The URL and anon key are public by design:
// they only identify the project, and every table is locked down by row-level
// security (see supabase/schema.sql), so the key grants nothing on its own.
// The supabase-js bundle is loaded on first use so offline play stays light.

const URL = import.meta.env.VITE_SUPABASE_URL || 'https://aasojkdrqwssccumpsyw.supabase.co';
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFhc29qa2RycXdzc2NjdW1wc3l3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEwNjY4NzUsImV4cCI6MjEwNjY0Mjg3NX0.n9jpsYL_aRBewXIce2fyxAZg9ZvjKXLthXatUgQ3rxQ';

let clientPromise = null;

export function getSupabase() {
  if (!clientPromise) {
    clientPromise = import('@supabase/supabase-js').then(({ createClient }) =>
      createClient(URL, ANON_KEY, {
        // PKCE returns ?code=… in the query string. The implicit flow would put
        // tokens in the URL hash, which this app already uses for routing.
        auth: { flowType: 'pkce', persistSession: true, detectSessionInUrl: true },
      }),
    );
  }
  return clientPromise;
}
