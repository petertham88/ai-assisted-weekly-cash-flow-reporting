import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { generateReportSections, type ReportContext } from "@/lib/ai/openai";
import { sortFlags } from "@/lib/cashflow/risk";
import { writeAudit } from "@/lib/audit";
import type { ForecastWeek, RiskFlag, WeeklyReport, ReportOutput } from "@/lib/db/types";

export const runtime = "nodejs";
export const maxDuration = 60;

/** generate_report_sections — draft the 4 management-report sections. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const supabase = createServiceClient();
    const { data: report } = await supabase.from("weekly_reports").select("*").eq("id", id).maybeSingle();
    if (!report) return NextResponse.json({ error: "Report not found." }, { status: 404 });

    const [{ data: fwData }, { data: flagData }, { data: existing }] = await Promise.all([
      supabase.from("forecast_weeks").select("*").eq("weekly_report_id", id).order("week_offset"),
      supabase.from("risk_flags").select("*").eq("weekly_report_id", id),
      supabase.from("report_outputs").select("*").eq("weekly_report_id", id).maybeSingle(),
    ]);

    const forecastWeeks = (fwData ?? []) as ForecastWeek[];
    if (forecastWeeks.length === 0) {
      return NextResponse.json(
        { error: "No cash flow data yet. Upload a file before generating a report." },
        { status: 422 },
      );
    }

    const allFlags = (flagData ?? []) as RiskFlag[];
    const activeFlags = sortFlags(allFlags.filter((f) => f.review_status !== "dismissed"));

    const ctx: ReportContext = {
      weekLabel: (report as WeeklyReport).week_label,
      forecastWeeks: forecastWeeks.map((w) => ({
        week_offset: w.week_offset,
        week_label: w.week_label,
        opening_balance: w.opening_balance,
        total_inflows: w.total_inflows,
        total_outflows: w.total_outflows,
        closing_balance: w.closing_balance,
        forecast_closing_balance: w.forecast_closing_balance,
      })),
      flags: activeFlags.map((f) => ({
        cash_flow_item_id: f.cash_flow_item_id,
        flag_type: f.flag_type,
        description: f.description,
        recommended_action: f.recommended_action ?? "",
        severity: f.severity,
        ai_value: f.ai_value,
        ai_source: f.ai_source ?? "rule-based",
        ai_confidence: f.ai_confidence,
        _varianceMag: 0,
      })),
      totalInflows: forecastWeeks.reduce((s, w) => s + w.total_inflows, 0),
      totalOutflows: forecastWeeks.reduce((s, w) => s + w.total_outflows, 0),
    };

    const sections = await generateReportSections(ctx);

    const payload: Record<string, unknown> = {
      weekly_report_id: id,
      executive_summary: sections.executive_summary.value,
      executive_summary_source: sections.executive_summary.source,
      executive_summary_confidence: sections.executive_summary.confidence,
      executive_summary_review_status: "unreviewed",
      key_variances_narrative: sections.key_variances_narrative.value,
      key_variances_narrative_source: sections.key_variances_narrative.source,
      key_variances_narrative_confidence: sections.key_variances_narrative.confidence,
      key_variances_narrative_review_status: "unreviewed",
      risk_narrative: sections.risk_narrative.value,
      risk_narrative_source: sections.risk_narrative.source,
      risk_narrative_confidence: sections.risk_narrative.confidence,
      risk_narrative_review_status: "unreviewed",
      recommended_actions: sections.recommended_actions.value,
      recommended_actions_source: sections.recommended_actions.source,
      recommended_actions_confidence: sections.recommended_actions.confidence,
      recommended_actions_review_status: "unreviewed",
    };

    const existingOutput = existing as ReportOutput | null;
    if (existingOutput) {
      // Don't clobber an already-approved report.
      if (existingOutput.overall_review_status === "approved") {
        return NextResponse.json({ error: "Report is approved; unlock before regenerating." }, { status: 409 });
      }
      const { error } = await supabase.from("report_outputs").update(payload).eq("id", existingOutput.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    } else {
      const { error } = await supabase.from("report_outputs").insert({ ...payload, overall_review_status: "draft" });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await writeAudit(supabase, {
      action: "report_output.generated",
      target_table: "report_outputs",
      target_id: id,
      detail: { source: sections.executive_summary.source },
    });

    return NextResponse.json({ ok: true, source: sections.executive_summary.source });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Generation failed." }, { status: 500 });
  }
}
