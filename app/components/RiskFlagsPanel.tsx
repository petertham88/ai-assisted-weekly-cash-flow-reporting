"use client";

import { useState } from "react";
import type { RiskFlag, Severity } from "@/lib/db/types";
import { flagTypeLabel } from "@/lib/format";
import { useApi } from "./useApi";

const SEVERITY_RANK: Record<Severity, number> = { high: 3, medium: 2, low: 1 };

const SEVERITY_STYLE: Record<Severity, string> = {
  high: "bg-red-100 text-red-800 border-red-200",
  medium: "bg-amber-100 text-amber-800 border-amber-200",
  low: "bg-sky-100 text-sky-800 border-sky-200",
};

const STATUS_STYLE: Record<string, string> = {
  unreviewed: "bg-neutral-100 text-neutral-600",
  accepted: "bg-emerald-100 text-emerald-700",
  dismissed: "bg-neutral-200 text-neutral-500 line-through",
  needs_edit: "bg-purple-100 text-purple-700",
};

export function RiskFlagsPanel({ flags }: { flags: RiskFlag[] }) {
  const { call, busy, error } = useApi();
  const [filter, setFilter] = useState<"all" | Severity>("all");
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const sorted = [...flags].sort((a, b) => {
    if (SEVERITY_RANK[b.severity] !== SEVERITY_RANK[a.severity]) return SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
    return (b.ai_confidence ?? 0) - (a.ai_confidence ?? 0);
  });
  const visible = filter === "all" ? sorted : sorted.filter((f) => f.severity === filter);

  async function setStatus(flag: RiskFlag, status: string, reviewerNote?: string) {
    // High-severity dismiss requires a note — open the note box instead of calling.
    if (status === "dismissed" && flag.severity === "high" && !reviewerNote) {
      setNoteFor(flag.id);
      setNote("");
      return;
    }
    const res = await call(`/api/flags/${flag.id}`, {
      method: "PATCH",
      body: { review_status: status, reviewer_note: reviewerNote ?? null },
    });
    if (res.ok) setNoteFor(null);
  }

  const counts = {
    high: flags.filter((f) => f.severity === "high").length,
    medium: flags.filter((f) => f.severity === "medium").length,
    low: flags.filter((f) => f.severity === "low").length,
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-neutral-700">
          Risk Flags <span className="text-neutral-400">({flags.length})</span>
        </h3>
        <div className="flex gap-1 no-print">
          {(["all", "high", "medium", "low"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded px-2 py-1 text-xs font-medium capitalize ${
                filter === f ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
              }`}
            >
              {f}
              {f !== "all" && ` (${counts[f]})`}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="rounded bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      {visible.length === 0 && (
        <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-6 text-center text-sm text-neutral-500">
          {flags.length === 0
            ? "No risk flags. Upload data to run rule-based risk scoring."
            : "No flags match this filter."}
        </div>
      )}

      <div className="space-y-2">
        {visible.map((flag) => {
          const aiPending = !flag.ai_value || flag.ai_source === "rule-based";
          return (
            <div key={flag.id} className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded border px-2 py-0.5 text-xs font-semibold uppercase ${SEVERITY_STYLE[flag.severity]}`}>
                  {flag.severity}
                </span>
                <span className="rounded bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600">
                  {flagTypeLabel(flag.flag_type)}
                </span>
                <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[flag.review_status] ?? ""}`}>
                  {flag.review_status.replace("_", " ")}
                </span>
                <span className="ml-auto text-xs">
                  {aiPending ? (
                    <span className="rounded bg-amber-50 px-2 py-0.5 font-medium text-amber-700">AI pending</span>
                  ) : (
                    <span className="rounded bg-indigo-50 px-2 py-0.5 font-medium text-indigo-700">
                      {flag.ai_source} · {Math.round((flag.ai_confidence ?? 0) * 100)}%
                    </span>
                  )}
                </span>
              </div>

              <p className="mt-2 text-sm text-neutral-800">{flag.description}</p>
              {flag.ai_value && flag.ai_source !== "rule-based" && (
                <p className="mt-1 text-sm italic text-indigo-800">AI: {flag.ai_value}</p>
              )}
              {flag.recommended_action && (
                <p className="mt-1 text-xs text-neutral-500">
                  <span className="font-semibold">Recommended:</span> {flag.recommended_action}
                </p>
              )}
              {flag.reviewer_note && (
                <p className="mt-1 text-xs text-neutral-500">
                  <span className="font-semibold">Reviewer note:</span> {flag.reviewer_note}
                </p>
              )}

              {noteFor === flag.id ? (
                <div className="mt-3 space-y-2 rounded border border-amber-200 bg-amber-50 p-2 no-print">
                  <p className="text-xs font-medium text-amber-800">A reviewer note is required to dismiss a high-severity flag:</p>
                  <textarea
                    className="w-full rounded border border-neutral-300 p-2 text-sm"
                    rows={2}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Reason for dismissing…"
                  />
                  <div className="flex gap-2">
                    <button disabled={busy || !note.trim()} onClick={() => setStatus(flag, "dismissed", note.trim())}
                      className="rounded bg-neutral-900 px-3 py-1 text-xs font-medium text-white disabled:opacity-40">
                      Confirm dismiss
                    </button>
                    <button onClick={() => setNoteFor(null)} className="rounded bg-neutral-200 px-3 py-1 text-xs text-neutral-700">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2 no-print">
                  <button disabled={busy} onClick={() => setStatus(flag, "accepted")}
                    className="rounded bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50">
                    Accept
                  </button>
                  <button disabled={busy} onClick={() => setStatus(flag, "needs_edit")}
                    className="rounded bg-purple-50 px-3 py-1 text-xs font-medium text-purple-700 hover:bg-purple-100 disabled:opacity-50">
                    Needs edit
                  </button>
                  <button disabled={busy} onClick={() => setStatus(flag, "dismissed")}
                    className="rounded bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-200 disabled:opacity-50">
                    Dismiss
                  </button>
                  {flag.review_status !== "unreviewed" && (
                    <button disabled={busy} onClick={() => setStatus(flag, "unreviewed")}
                      className="rounded px-3 py-1 text-xs font-medium text-neutral-400 hover:text-neutral-600 disabled:opacity-50">
                      Reset
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
