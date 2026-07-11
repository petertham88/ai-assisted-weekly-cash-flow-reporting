import type { SupabaseClient } from "@supabase/supabase-js";
import type { CashFlowItem, WeeklyReport } from "@/lib/db/types";
import { computeForecastWeeks, type ComputedForecastWeek } from "./forecast";
import { runRiskScoring, sortFlags, type ComputedFlag } from "./risk";
import { generateRiskNarratives, type ReportContext } from "@/lib/ai/openai";

const DEFAULT_OPENING_BALANCE = 500000;

export interface RecomputeResult {
  forecastWeeks: ComputedForecastWeek[];
  flags: ComputedFlag[];
  totalInflows: number;
  totalOutflows: number;
}

/**
 * Recompute forecast_weeks and rule-based risk_flags for a report from its
 * current cash_flow_items. Preserves the opening balance and any user-reviewed
 * flags (accepted / dismissed / needs_edit); only unreviewed flags are refreshed.
 */
export async function recompute(
  supabase: SupabaseClient,
  report: WeeklyReport,
  opts: { openingBalance?: number; enrichAi?: boolean } = {},
): Promise<RecomputeResult> {
  const { data: itemRows } = await supabase
    .from("cash_flow_items")
    .select("*")
    .eq("weekly_report_id", report.id);
  const items = (itemRows ?? []) as CashFlowItem[];

  // Opening balance: explicit override → existing forecast week 0 → default.
  let opening = opts.openingBalance;
  if (opening == null) {
    const { data: fw } = await supabase
      .from("forecast_weeks")
      .select("opening_balance")
      .eq("weekly_report_id", report.id)
      .eq("week_offset", 0)
      .maybeSingle();
    opening = (fw?.opening_balance as number | undefined) ?? DEFAULT_OPENING_BALANCE;
  }

  const forecastWeeks = computeForecastWeeks(items, report.report_date, opening);

  // Replace forecast weeks wholesale (not user-editable).
  await supabase.from("forecast_weeks").delete().eq("weekly_report_id", report.id);
  if (forecastWeeks.length) {
    await supabase.from("forecast_weeks").insert(
      forecastWeeks.map((w) => ({ ...w, weekly_report_id: report.id })),
    );
  }

  // Rescore risks: drop unreviewed flags, keep user-reviewed ones, insert fresh.
  await supabase
    .from("risk_flags")
    .delete()
    .eq("weekly_report_id", report.id)
    .eq("review_status", "unreviewed");

  const flags = sortFlags(runRiskScoring(items, forecastWeeks));

  if (opts.enrichAi && flags.length) {
    const totalInflows = forecastWeeks.reduce((s, w) => s + w.total_inflows, 0);
    const totalOutflows = forecastWeeks.reduce((s, w) => s + w.total_outflows, 0);
    const ctx: ReportContext = {
      weekLabel: report.week_label,
      forecastWeeks,
      flags,
      totalInflows,
      totalOutflows,
    };
    const enrichment = await generateRiskNarratives(flags, ctx);
    enrichment.forEach((e, i) => {
      flags[i].ai_value = e.ai_value;
      flags[i].ai_source = e.ai_source;
      flags[i].ai_confidence = e.ai_confidence;
    });
  }

  if (flags.length) {
    await supabase.from("risk_flags").insert(
      flags.map((f) => ({
        weekly_report_id: report.id,
        cash_flow_item_id: f.cash_flow_item_id,
        flag_type: f.flag_type,
        description: f.description,
        recommended_action: f.recommended_action,
        severity: f.severity,
        review_status: "unreviewed",
        ai_value: f.ai_value,
        ai_source: f.ai_source,
        ai_confidence: f.ai_confidence,
      })),
    );
  }

  const totalInflows = forecastWeeks.reduce((s, w) => s + w.total_inflows, 0);
  const totalOutflows = forecastWeeks.reduce((s, w) => s + w.total_outflows, 0);
  return { forecastWeeks, flags, totalInflows, totalOutflows };
}
