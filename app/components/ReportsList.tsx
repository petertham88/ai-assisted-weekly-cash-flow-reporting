"use client";

import Link from "next/link";
import { useApi } from "./useApi";
import { money, signedMoney, formatDate } from "@/lib/format";

export interface ReportSummary {
  id: string;
  week_label: string;
  report_date: string;
  status: string;
  closing: number | null;
  itemCount: number;
  flagCount: number;
  delta: number | null; // vs prior week closing
}

export function ReportsList({ summaries }: { summaries: ReportSummary[] }) {
  const { call, busy, error } = useApi();

  async function del(s: ReportSummary) {
    const approved = s.status === "approved";
    const msg = approved
      ? "This report is APPROVED. Delete it anyway? This cannot be undone."
      : "Delete this report and all its data?";
    if (!confirm(msg)) return;
    await call(`/api/reports/${s.id}${approved ? "?force=true" : ""}`, { method: "DELETE" });
  }

  return (
    <div className="space-y-3">
      {error && <p className="rounded bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white shadow-sm">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
              <th className="px-4 py-3 font-semibold">Week</th>
              <th className="px-4 py-3 font-semibold">Date</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 text-right font-semibold">Closing (Wk 1)</th>
              <th className="px-4 py-3 text-right font-semibold">WoW Δ</th>
              <th className="px-4 py-3 text-center font-semibold">Items</th>
              <th className="px-4 py-3 text-center font-semibold">Flags</th>
              <th className="px-4 py-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {summaries.map((s) => (
              <tr key={s.id} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50">
                <td className="px-4 py-3">
                  <Link href={`/report/${s.id}`} className="font-medium text-blue-600 hover:underline">
                    {s.week_label}
                  </Link>
                </td>
                <td className="px-4 py-3 text-neutral-600">{formatDate(s.report_date)}</td>
                <td className="px-4 py-3">
                  <span className={`rounded px-2 py-0.5 text-xs font-medium ${s.status === "approved" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                    {s.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-neutral-800">{s.closing == null ? "—" : money(s.closing)}</td>
                <td className={`px-4 py-3 text-right tabular-nums ${s.delta == null ? "text-neutral-300" : s.delta < 0 ? "text-rose-700" : "text-emerald-700"}`}>
                  {s.delta == null ? "—" : signedMoney(s.delta)}
                </td>
                <td className="px-4 py-3 text-center text-neutral-600">{s.itemCount}</td>
                <td className="px-4 py-3 text-center text-neutral-600">{s.flagCount}</td>
                <td className="px-4 py-3 text-right">
                  <a href={`/api/reports/${s.id}/export`} className="mr-2 text-xs font-medium text-neutral-600 hover:underline">CSV</a>
                  <Link href={`/report/${s.id}/print`} className="mr-2 text-xs font-medium text-neutral-600 hover:underline">Print</Link>
                  <button disabled={busy} onClick={() => del(s)} className="text-xs font-medium text-rose-600 hover:underline disabled:opacity-50">Delete</button>
                </td>
              </tr>
            ))}
            {summaries.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-neutral-400">No reports yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
