import { createClient } from "@/lib/supabase/server";
import type {
  CashFlowItem,
  ForecastWeek,
  ReportBundle,
  ReportOutput,
  RiskFlag,
  WeeklyReport,
} from "@/lib/db/types";

/**
 * Reports owned by a specific user. Under app-layer auth (open RLS still active)
 * this filter is what isolates users; once 0002 RLS is applied it is enforced at
 * the database as well. Pass `null` to list demo/seed reports (user_id IS NULL).
 */
export async function listReports(userId: string | null): Promise<WeeklyReport[]> {
  const supabase = await createClient();
  let q = supabase
    .from("weekly_reports")
    .select("*")
    .order("report_date", { ascending: false })
    .order("created_at", { ascending: false });
  q = userId ? q.eq("user_id", userId) : q.is("user_id", null);
  const { data } = await q;
  return (data ?? []) as WeeklyReport[];
}

export async function getLatestReportId(userId: string | null): Promise<string | null> {
  const reports = await listReports(userId);
  return reports[0]?.id ?? null;
}

export async function getWeekZeroClosing(reportId: string): Promise<number | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("forecast_weeks")
    .select("closing_balance")
    .eq("weekly_report_id", reportId)
    .eq("week_offset", 0)
    .maybeSingle();
  return (data?.closing_balance as number | undefined) ?? null;
}

/** Closing balance of the chronologically-previous report (same owner), for week-over-week comparison. */
export async function getPriorClosing(current: WeeklyReport, reports: WeeklyReport[]): Promise<number | null> {
  const prior = reports
    .filter((r) => r.id !== current.id && r.report_date < current.report_date)
    .sort((a, b) => (a.report_date < b.report_date ? 1 : -1))[0];
  if (!prior) return null;
  return getWeekZeroClosing(prior.id);
}

export async function getReportBundle(id: string): Promise<ReportBundle | null> {
  const supabase = await createClient();
  const { data: report } = await supabase.from("weekly_reports").select("*").eq("id", id).maybeSingle();
  if (!report) return null;

  const [items, forecastWeeks, flags, output] = await Promise.all([
    supabase
      .from("cash_flow_items")
      .select("*")
      .eq("weekly_report_id", id)
      .order("week_offset", { ascending: true })
      .order("category", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("forecast_weeks")
      .select("*")
      .eq("weekly_report_id", id)
      .order("week_offset", { ascending: true }),
    supabase.from("risk_flags").select("*").eq("weekly_report_id", id),
    supabase.from("report_outputs").select("*").eq("weekly_report_id", id).maybeSingle(),
  ]);

  return {
    report: report as WeeklyReport,
    items: (items.data ?? []) as CashFlowItem[],
    forecastWeeks: (forecastWeeks.data ?? []) as ForecastWeek[],
    flags: (flags.data ?? []) as RiskFlag[],
    output: (output.data ?? null) as ReportOutput | null,
  };
}
