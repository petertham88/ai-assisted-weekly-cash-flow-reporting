import { NextResponse } from "next/server";
import { getAuthedClient, actorLabel } from "@/lib/auth";
import { recompute } from "@/lib/cashflow/orchestrate";
import { writeAudit } from "@/lib/audit";
import type { CashFlowItem, WeeklyReport } from "@/lib/db/types";
import type { User } from "@supabase/supabase-js";

export const runtime = "nodejs";

const EDITABLE = ["description", "category", "subcategory", "week_offset", "forecast_amount", "actual_amount", "currency"];

type SupabaseClient = Awaited<ReturnType<typeof getAuthedClient>>["supabase"];
type OwnedResult =
  | { ok: false; status: number; error: string }
  | { ok: true; supabase: SupabaseClient; user: User; item: CashFlowItem; report: WeeklyReport };

/** Load the item + its report and confirm the signed-in user owns it. */
async function loadOwned(id: string): Promise<OwnedResult> {
  const { supabase, user } = await getAuthedClient();
  if (!user) return { ok: false, status: 401, error: "Authentication required." };
  const { data: item } = await supabase.from("cash_flow_items").select("*").eq("id", id).maybeSingle();
  if (!item) return { ok: false, status: 404, error: "Item not found." };
  const { data: report } = await supabase
    .from("weekly_reports")
    .select("*")
    .eq("id", (item as CashFlowItem).weekly_report_id)
    .maybeSingle();
  if (!report) return { ok: false, status: 404, error: "Item not found." };
  if ((report as WeeklyReport).user_id !== user.id) return { ok: false, status: 403, error: "You don't own this item." };
  return { ok: true, supabase, user, item: item as CashFlowItem, report: report as WeeklyReport };
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const ctx = await loadOwned(id);
    if (!ctx.ok) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    const body = await req.json();

    const patch: Record<string, unknown> = {};
    for (const k of EDITABLE) {
      if (k in body) patch[k] = body[k];
    }
    if ("week_offset" in patch) patch.week_offset = Math.max(0, Math.min(3, Math.round(Number(patch.week_offset) || 0)));
    if ("forecast_amount" in patch) patch.forecast_amount = Number(patch.forecast_amount) || 0;
    if ("actual_amount" in patch)
      patch.actual_amount = patch.actual_amount === null || patch.actual_amount === "" ? null : Number(patch.actual_amount);

    const { error } = await ctx.supabase.from("cash_flow_items").update(patch).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await recompute(ctx.supabase, ctx.report, { enrichAi: false, userId: ctx.user.id });
    await writeAudit(ctx.supabase, {
      action: "cash_flow_item.edited",
      target_table: "cash_flow_items",
      target_id: id,
      actor_label: actorLabel(ctx.user),
      user_id: ctx.user.id,
      detail: { fields: Object.keys(patch) },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Update failed." }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const ctx = await loadOwned(id);
    if (!ctx.ok) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

    const { error } = await ctx.supabase.from("cash_flow_items").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await recompute(ctx.supabase, ctx.report, { enrichAi: false, userId: ctx.user.id });
    await writeAudit(ctx.supabase, {
      action: "cash_flow_item.deleted",
      target_table: "cash_flow_items",
      target_id: id,
      actor_label: actorLabel(ctx.user),
      user_id: ctx.user.id,
      detail: { description: ctx.item.description },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Delete failed." }, { status: 500 });
  }
}
