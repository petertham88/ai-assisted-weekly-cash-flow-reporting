import { listReports, getWeekZeroClosing } from "@/lib/data";
import { createServiceClient } from "@/lib/supabase/service";
import { TopNav } from "@/app/components/TopNav";
import { ReportsList, type ReportSummary } from "@/app/components/ReportsList";

export const dynamic = "force-dynamic";

export default async function ReportsHistoryPage() {
  const reports = await listReports();
  const supabase = createServiceClient();

  // Build per-report summaries (closing balance, counts) then compute WoW deltas.
  const base = await Promise.all(
    reports.map(async (r) => {
      const [closing, items, flags] = await Promise.all([
        getWeekZeroClosing(r.id),
        supabase.from("cash_flow_items").select("id").eq("weekly_report_id", r.id),
        supabase.from("risk_flags").select("id").eq("weekly_report_id", r.id),
      ]);
      return {
        id: r.id,
        week_label: r.week_label,
        report_date: r.report_date,
        status: r.status,
        closing,
        itemCount: (items.data ?? []).length,
        flagCount: (flags.data ?? []).length,
      };
    }),
  );

  // reports are sorted date desc; prior = next entry with an earlier date.
  const summaries: ReportSummary[] = base.map((s, i) => {
    const prior = base.slice(i + 1).find((p) => p.report_date < s.report_date && p.closing != null);
    const delta = s.closing != null && prior?.closing != null ? s.closing - prior.closing : null;
    return { ...s, delta };
  });

  return (
    <div>
      <TopNav reports={reports} />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Report History</h1>
          <p className="text-sm text-neutral-500">All weekly reports, newest first, with week-over-week closing-balance comparison.</p>
        </div>
        <ReportsList summaries={summaries} />
      </main>
    </div>
  );
}
