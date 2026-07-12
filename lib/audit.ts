import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Write an audit_logs row for a state-changing action.
 * Per SECURITY.md, every meaningful action is logged. We throw on failure so
 * callers can roll back / surface an error rather than silently proceeding.
 */
export async function writeAudit(
  supabase: SupabaseClient,
  entry: {
    action: string;
    target_table: string;
    target_id?: string | null;
    actor_label?: string;
    user_id?: string | null;
    detail?: Record<string, unknown>;
  },
) {
  const { error } = await supabase.from("audit_logs").insert({
    action: entry.action,
    target_table: entry.target_table,
    target_id: entry.target_id ?? null,
    actor_label: entry.actor_label ?? "Finance Executive (demo)",
    user_id: entry.user_id ?? null,
    detail: entry.detail ?? {},
  });
  if (error) throw new Error(`audit write failed: ${error.message}`);
}
