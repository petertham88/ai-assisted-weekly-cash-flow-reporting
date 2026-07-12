"use client";

import { useState } from "react";
import Link from "next/link";
import type { ReportOutput } from "@/lib/db/types";
import { SECTION_KEYS, SECTION_LABELS, type SectionKey } from "@/lib/db/types";
import { formatDateTime } from "@/lib/format";
import { useApi } from "./useApi";

function sectionValue(o: ReportOutput, k: SectionKey): string {
  return (o[k] as string | null) ?? "";
}
function sectionSource(o: ReportOutput, k: SectionKey): string | null {
  return o[`${k}_source` as keyof ReportOutput] as string | null;
}
function sectionConfidence(o: ReportOutput, k: SectionKey): number | null {
  return o[`${k}_confidence` as keyof ReportOutput] as number | null;
}

export function ReportSections({
  reportId,
  output,
  hasData,
  readOnly = false,
}: {
  reportId: string;
  output: ReportOutput | null;
  hasData: boolean;
  readOnly?: boolean;
}) {
  const { call, busy, error } = useApi();
  const [editing, setEditing] = useState<SectionKey | null>(null);
  const [draft, setDraft] = useState("");

  const approved = output?.overall_review_status === "approved";

  async function generate() {
    await call(`/api/reports/${reportId}/generate`, { method: "POST" });
  }
  async function saveSection(section: SectionKey) {
    const res = await call(`/api/reports/${reportId}/section`, {
      method: "PATCH",
      body: { section, value: draft },
    });
    if (res.ok) setEditing(null);
  }
  async function approve() {
    if (!confirm("Approve this report? It will be locked and marked approved.")) return;
    await call(`/api/reports/${reportId}/approve`, { method: "POST" });
  }
  async function reopen() {
    await call(`/api/reports/${reportId}/approve`, { method: "POST", body: { unlock: true } });
  }

  // Empty state — no report generated yet.
  if (!output) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-neutral-700">Management Report</h3>
        </div>
        {error && <p className="rounded bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-8 text-center">
          <p className="text-neutral-500">
            {readOnly
              ? "No management report has been generated for this demo report."
              : hasData
                ? "No report drafted yet. Generate the AI management narrative from the current data."
                : "Upload cash flow data first, then generate the management report."}
          </p>
          {!readOnly && (
            <button
              disabled={busy || !hasData}
              onClick={generate}
              className="mt-4 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-40"
            >
              {busy ? "Generating…" : "Generate Report"}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-neutral-700">
          Management Report
          {approved && (
            <span className="ml-2 rounded bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
              APPROVED
            </span>
          )}
        </h3>
        {!readOnly && (
        <div className="flex flex-wrap gap-2 no-print">
          <Link
            href={`/report/${reportId}/print`}
            className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
          >
            Print / PDF
          </Link>
          {!approved && (
            <>
              <button disabled={busy} onClick={generate}
                className="rounded-md border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50">
                {busy ? "Working…" : "Regenerate"}
              </button>
              <button disabled={busy} onClick={approve}
                className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50">
                Approve Report
              </button>
            </>
          )}
          {approved && (
            <button disabled={busy} onClick={reopen}
              className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50 disabled:opacity-50">
              Re-open for editing
            </button>
          )}
        </div>
        )}
      </div>

      {error && <p className="rounded bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      {approved && output.approved_at && (
        <p className="text-xs text-neutral-500">Approved {formatDateTime(output.approved_at)}</p>
      )}

      <div className="space-y-3">
        {SECTION_KEYS.map((key) => {
          const value = sectionValue(output, key);
          const source = sectionSource(output, key);
          const conf = sectionConfidence(output, key);
          const isEditing = editing === key;
          return (
            <div key={key} className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm print-full">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h4 className="text-sm font-semibold text-neutral-800">{SECTION_LABELS[key]}</h4>
                <div className="flex items-center gap-2 no-print">
                  {source && (
                    <span className={`rounded px-2 py-0.5 text-[11px] font-medium ${
                      source === "edited" ? "bg-blue-50 text-blue-700"
                        : source === "rule-based" ? "bg-amber-50 text-amber-700"
                        : "bg-indigo-50 text-indigo-700"
                    }`}>
                      {source === "edited" ? "edited" : source}
                      {conf != null && source !== "edited" && ` · ${Math.round(conf * 100)}%`}
                    </span>
                  )}
                  {!approved && !isEditing && !readOnly && (
                    <button onClick={() => { setEditing(key); setDraft(value); }}
                      className="text-xs font-medium text-blue-600 hover:underline">
                      Edit
                    </button>
                  )}
                </div>
              </div>
              {isEditing ? (
                <div className="space-y-2 no-print">
                  <textarea className="w-full rounded border border-neutral-300 p-2 text-sm" rows={5}
                    value={draft} onChange={(e) => setDraft(e.target.value)} />
                  <div className="flex gap-2">
                    <button disabled={busy} onClick={() => saveSection(key)}
                      className="rounded bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50">Save</button>
                    <button onClick={() => setEditing(null)}
                      className="rounded bg-neutral-200 px-3 py-1 text-xs text-neutral-700">Cancel</button>
                  </div>
                </div>
              ) : (
                <p className="whitespace-pre-line text-sm leading-relaxed text-neutral-700">
                  {value || <span className="text-neutral-400">— empty —</span>}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
