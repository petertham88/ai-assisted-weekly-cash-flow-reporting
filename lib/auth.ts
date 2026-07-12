import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/** Current signed-in user (or null) from the request-scoped session client. */
export async function getSessionUser(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ?? null;
}

/** Human-readable actor label for audit logs. */
export function actorLabel(user: Pick<User, "email"> | null): string {
  return user?.email ?? "Unknown user";
}

/**
 * Request-scoped session client + the current user, for API routes.
 * Returns { user: null } when unauthenticated so callers can 401.
 */
export async function getAuthedClient() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}
