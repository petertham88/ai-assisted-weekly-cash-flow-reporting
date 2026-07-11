import type { ReportBundle, WeeklyReport } from "@/lib/db/types";
import { money, signedMoney } from "@/lib/format";
import { TopNav } from "./TopNav";
import { ForecastTable } from "./ForecastTable";
import { ItemsTable } from "./ItemsTable";
import { RiskFlagsPanel } from "./RiskFlagsPanel";
import { ReportSections } from "./ReportSections";

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "pos" | "neg" | "warn" }) {
  const color =
    tone === "pos" ? "text-emerald-700" : tone === "neg" ? "text-rose-700" : tone === "warn" ? "text-amber-700" : "text-neutral-900";
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</div>
      <div className={`mt-1 text-xl font-semibold tabular-nums ${color}`}>{value}</div>
    </div>
  );
}

export function ReportView({
  bundle,
  reports,
  priorClosing,
  aiEnabled,
}: {
  bundle: ReportBundle;
  reports: WeeklyReport[];
  priorClosing: number | null;
  aiEnabled: boolean;
}) {
  const { report, items, forecastWeeks, flags, output } = bundle;
  const wk0 = forecastWeeks.find((w) => w.week_offset === 0);
  const last = [...forecastWeeks].sort((a, b) => a.week_offset - b.week_offset).at(-1);
  const net = wk0 ? wk0.total_inflows - wk0.total_outflows : 0;
  const closing = wk0?.closing_balance ?? null;
  const vsPrior = closing != null && priorClosing != null ? closing - priorClosing : null;
  const highFlags = flags.filter((f) => f.severity === "high").length;
  const hasData = items.length > 0;

  return (
    <div>
      <TopNav reports={reports} currentId={report.id} />
      <main className="mx-auto max-w-6xl space-y-8 px-4 py-6">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">{report.week_label}</h1>
            <p className="text-sm text-neutral-500">
              Weekly cash flow report ·{" "}
              <span className={report.status === "approved" ? "text-emerald-600 font-medium" : "text-amber-600 font-medium"}>
                {report.status}
              </span>
              {!aiEnabled && (
                <span className="ml-2 rounded bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                  AI off — rule-based mode
                </span>
              )}
            </p>
          </div>
        </div>

        {/* KPI cards */}
        {hasData && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <Kpi label="Opening (Wk 1)" value={money(wk0?.opening_balance ?? 0)} />
            <Kpi label="Net movement" value={signedMoney(net)} tone={net < 0 ? "neg" : "pos"} />
            <Kpi label="Closing (Wk 1)" value={money(closing ?? 0)} tone={closing != null && closing < 250000 ? "warn" : undefined} />
            <Kpi label="4-Wk Closing" value={money(last?.closing_balance ?? 0)} tone={last && last.closing_balance < 250000 ? "warn" : undefined} />
            <Kpi
              label="vs Prior Week"
              value={vsPrior == null ? "—" : signedMoney(vsPrior)}
              tone={vsPrior == null ? undefined : vsPrior < 0 ? "neg" : "pos"}
            />
          </div>
        )}

        {!hasData && (
          <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-10 text-center">
            <p className="text-lg font-medium text-neutral-700">No cash flow data yet.</p>
            <p className="mt-1 text-sm text-neutral-500">Upload a weekly Finance file to get started.</p>
            <a href="/upload" className="mt-4 inline-block rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700">
              Upload Weekly Data
            </a>
          </div>
        )}

        {/* Forecast */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">4-Week Rolling Forecast</h2>
            {highFlags > 0 && (
              <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                {highFlags} high risk{highFlags === 1 ? "" : "s"}
              </span>
            )}
          </div>
          <ForecastTable weeks={forecastWeeks} />
        </section>

        {/* Line items */}
        <section className="no-print">
          <ItemsTable reportId={report.id} items={items} />
        </section>

        {/* Risk flags + report side by side on large screens */}
        <div className="grid gap-8 lg:grid-cols-2">
          <section>
            <RiskFlagsPanel flags={flags} />
          </section>
          <section>
            <ReportSections reportId={report.id} output={output} hasData={hasData} />
          </section>
        </div>
      </main>
    </div>
  );
}
