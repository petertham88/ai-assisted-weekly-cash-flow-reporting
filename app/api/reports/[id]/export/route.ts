import { createServiceClient } from "@/lib/supabase/service";
import type { CashFlowItem, WeeklyReport } from "@/lib/db/types";

export const runtime = "nodejs";

function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV export of cash_flow_items for a report. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createServiceClient();
  const { data: report } = await supabase.from("weekly_reports").select("*").eq("id", id).maybeSingle();
  if (!report) return new Response("Report not found", { status: 404 });

  const { data } = await supabase
    .from("cash_flow_items")
    .select("*")
    .eq("weekly_report_id", id)
    .order("week_offset")
    .order("category");
  const items = (data ?? []) as CashFlowItem[];

  const header = ["description", "category", "subcategory", "week_offset", "forecast_amount", "actual_amount", "variance", "currency"];
  const rows = items.map((it) =>
    [it.description, it.category, it.subcategory, it.week_offset, it.forecast_amount, it.actual_amount ?? "", it.variance, it.currency]
      .map(csvCell)
      .join(","),
  );
  const csv = [header.join(","), ...rows].join("\n");
  const label = (report as WeeklyReport).week_label.replace(/[^a-z0-9]+/gi, "_").toLowerCase();

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="cashflow_${label}.csv"`,
    },
  });
}
