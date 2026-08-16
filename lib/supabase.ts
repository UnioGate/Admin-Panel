import { createClient } from '@supabase/supabase-js';

// Server-only. This uses the service role key, which bypasses RLS entirely —
// it must never reach the browser. Every caller sits behind requireAdmin().
if (typeof window !== 'undefined') {
  throw new Error('lib/supabase.ts is server-only and must not be imported into a client component.');
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabaseConfigured = !!(url && key);

export const supabase = createClient(url ?? '', key ?? '', {
  auth: { persistSession: false, autoRefreshToken: false }
});
