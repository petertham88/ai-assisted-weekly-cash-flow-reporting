import type { ForecastWeek } from "@/lib/db/types";
import { money, signedMoney } from "@/lib/format";

export function ForecastTable({ weeks }: { weeks: ForecastWeek[] }) {
  if (weeks.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-8 text-center text-neutral-500">
        No forecast yet. Upload a weekly data file to build the 4-week rolling forecast.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white shadow-sm print-full">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
            <th className="px-4 py-3 font-semibold">Week</th>
            <th className="px-4 py-3 text-right font-semibold">Opening</th>
            <th className="px-4 py-3 text-right font-semibold">Inflows</th>
            <th className="px-4 py-3 text-right font-semibold">Outflows</th>
            <th className="px-4 py-3 text-right font-semibold">Closing</th>
            <th className="px-4 py-3 text-right font-semibold">Forecast</th>
            <th className="px-4 py-3 text-right font-semibold">Variance</th>
          </tr>
        </thead>
        <tbody>
          {weeks.map((w) => {
            const variance = w.closing_balance - w.forecast_closing_balance;
            const low = w.closing_balance < 250000;
            return (
              <tr key={w.id ?? w.week_offset} className="border-b border-neutral-100 last:border-0">
                <td className="px-4 py-3 font-medium text-neutral-800">
                  {w.week_label}
                  {low && (
                    <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">
                      LOW
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-neutral-600">{money(w.opening_balance)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-emerald-700">{money(w.total_inflows)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-rose-700">{money(w.total_outflows)}</td>
                <td className={`px-4 py-3 text-right font-semibold tabular-nums ${low ? "text-red-700" : "text-neutral-900"}`}>
                  {money(w.closing_balance)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-neutral-500">{money(w.forecast_closing_balance)}</td>
                <td
                  className={`px-4 py-3 text-right font-medium tabular-nums ${
                    variance < 0 ? "text-rose-700" : variance > 0 ? "text-emerald-700" : "text-neutral-500"
                  }`}
                >
                  {signedMoney(variance)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
