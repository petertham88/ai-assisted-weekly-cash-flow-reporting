import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Server-side Supabase client for data operations (reads + writes).
 *
 * v1 uses the anon key under open RLS policies (see supabase/migrations/0001_init.sql),
 * so no service-role key is required or exposed. When the lock-down sprint introduces
 * per-user RLS, request-scoped clients carry the user's session instead.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase env not configured. Run `vercel env pull .env.local`.",
    );
  }
  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
