import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { recompute } from "@/lib/cashflow/orchestrate";
import { writeAudit } from "@/lib/audit";
import type { WeeklyReport } from "@/lib/db/types";

export const runtime = "nodejs";

/** Manual line-item entry (Sprint 6) — add a one-off item without a file upload. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const supabase = createServiceClient();
    const { data: report } = await supabase.from("weekly_reports").select("*").eq("id", id).maybeSingle();
    if (!report) return NextResponse.json({ error: "Report not found." }, { status: 404 });

    const body = await req.json();
    const description = String(body.description ?? "").trim();
    if (!description) return NextResponse.json({ error: "Description is required." }, { status: 400 });

    const row = {
      weekly_report_id: id,
      category: body.category === "outflow" ? "outflow" : "inflow",
      subcategory: body.subcategory ?? "other",
      description,
      week_offset: Math.max(0, Math.min(3, Math.round(Number(body.week_offset) || 0))),
      forecast_amount: Math.abs(Number(body.forecast_amount) || 0),
      actual_amount:
        body.actual_amount === null || body.actual_amount === "" || body.actual_amount == null
          ? null
          : Math.abs(Number(body.actual_amount)),
      currency: String(body.currency ?? "USD").toUpperCase().slice(0, 6) || "USD",
      source_file: null,
    };

    const { data: inserted, error } = await supabase.from("cash_flow_items").insert(row).select("id").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await recompute(supabase, report as WeeklyReport, { enrichAi: false });
    await writeAudit(supabase, {
      action: "cash_flow_item.created",
      target_table: "cash_flow_items",
      target_id: inserted?.id,
      detail: { description, manual: true },
    });
    return NextResponse.json({ ok: true, id: inserted?.id });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Create failed." }, { status: 500 });
  }
}
