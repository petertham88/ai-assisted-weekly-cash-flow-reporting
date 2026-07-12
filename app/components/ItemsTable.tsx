"use client";

import { useState } from "react";
import type { CashFlowItem, Subcategory } from "@/lib/db/types";
import { money, signedMoney, subcategoryLabel } from "@/lib/format";
import { useApi } from "./useApi";

const SUBCATS: Subcategory[] = [
  "accounts_receivable",
  "accounts_payable",
  "payroll",
  "loan_repayment",
  "tax",
  "other",
];

interface Draft {
  description: string;
  category: "inflow" | "outflow";
  subcategory: Subcategory;
  week_offset: number;
  forecast_amount: string;
  actual_amount: string;
}

function emptyDraft(): Draft {
  return { description: "", category: "inflow", subcategory: "other", week_offset: 0, forecast_amount: "", actual_amount: "" };
}

export function ItemsTable({
  reportId,
  items,
  readOnly = false,
}: {
  reportId: string;
  items: CashFlowItem[];
  readOnly?: boolean;
}) {
  const { call, busy, error } = useApi();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [adding, setAdding] = useState(false);
  const [addDraft, setAddDraft] = useState<Draft>(emptyDraft());

  function startEdit(it: CashFlowItem) {
    setEditingId(it.id);
    setDraft({
      description: it.description,
      category: it.category,
      subcategory: (it.subcategory ?? "other") as Subcategory,
      week_offset: it.week_offset,
      forecast_amount: String(it.forecast_amount),
      actual_amount: it.actual_amount == null ? "" : String(it.actual_amount),
    });
  }

  async function saveEdit(id: string) {
    const res = await call(`/api/items/${id}`, {
      method: "PATCH",
      body: {
        description: draft.description,
        category: draft.category,
        subcategory: draft.subcategory,
        week_offset: draft.week_offset,
        forecast_amount: Number(draft.forecast_amount) || 0,
        actual_amount: draft.actual_amount === "" ? null : Number(draft.actual_amount),
      },
    });
    if (res.ok) setEditingId(null);
  }

  async function del(id: string) {
    if (!confirm("Delete this line item? The forecast and risk flags will recompute.")) return;
    await call(`/api/items/${id}`, { method: "DELETE" });
  }

  async function addItem() {
    if (!addDraft.description.trim()) return;
    const res = await call(`/api/reports/${reportId}/items`, {
      method: "POST",
      body: {
        description: addDraft.description,
        category: addDraft.category,
        subcategory: addDraft.subcategory,
        week_offset: addDraft.week_offset,
        forecast_amount: Number(addDraft.forecast_amount) || 0,
        actual_amount: addDraft.actual_amount === "" ? null : Number(addDraft.actual_amount),
      },
    });
    if (res.ok) {
      setAddDraft(emptyDraft());
      setAdding(false);
    }
  }

  const inputCls = "w-full rounded border border-neutral-300 px-2 py-1 text-sm";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-neutral-700">
          Cash Flow Line Items <span className="text-neutral-400">({items.length})</span>
        </h3>
        {!readOnly && (
          <button
            onClick={() => setAdding((a) => !a)}
            className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-700"
          >
            {adding ? "Cancel" : "+ Add line item"}
          </button>
        )}
      </div>

      {error && <p className="rounded bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      {adding && (
        <div className="grid grid-cols-2 gap-2 rounded-lg border border-neutral-200 bg-white p-3 sm:grid-cols-7">
          <input className={inputCls + " col-span-2"} placeholder="Description" value={addDraft.description}
            onChange={(e) => setAddDraft({ ...addDraft, description: e.target.value })} />
          <select className={inputCls} value={addDraft.category}
            onChange={(e) => setAddDraft({ ...addDraft, category: e.target.value as Draft["category"] })}>
            <option value="inflow">Inflow</option>
            <option value="outflow">Outflow</option>
          </select>
          <select className={inputCls} value={addDraft.subcategory}
            onChange={(e) => setAddDraft({ ...addDraft, subcategory: e.target.value as Subcategory })}>
            {SUBCATS.map((s) => <option key={s} value={s}>{subcategoryLabel(s)}</option>)}
          </select>
          <select className={inputCls} value={addDraft.week_offset}
            onChange={(e) => setAddDraft({ ...addDraft, week_offset: Number(e.target.value) })}>
            {[0, 1, 2, 3].map((w) => <option key={w} value={w}>Wk {w + 1}</option>)}
          </select>
          <input className={inputCls} type="number" placeholder="Forecast" value={addDraft.forecast_amount}
            onChange={(e) => setAddDraft({ ...addDraft, forecast_amount: e.target.value })} />
          <div className="flex gap-1">
            <input className={inputCls} type="number" placeholder="Actual" value={addDraft.actual_amount}
              onChange={(e) => setAddDraft({ ...addDraft, actual_amount: e.target.value })} />
            <button disabled={busy} onClick={addItem}
              className="rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50">
              Save
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white shadow-sm">
        <table className="w-full min-w-[780px] text-sm">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
              <th className="px-3 py-2 font-semibold">Description</th>
              <th className="px-3 py-2 font-semibold">Category</th>
              <th className="px-3 py-2 font-semibold">Subcategory</th>
              <th className="px-3 py-2 font-semibold">Week</th>
              <th className="px-3 py-2 text-right font-semibold">Forecast</th>
              <th className="px-3 py-2 text-right font-semibold">Actual</th>
              <th className="px-3 py-2 text-right font-semibold">Variance</th>
              {!readOnly && <th className="px-3 py-2 text-right font-semibold no-print">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-neutral-400">
                  No line items yet.
                </td>
              </tr>
            )}
            {items.map((it) =>
              editingId === it.id ? (
                <tr key={it.id} className="border-b border-neutral-100 bg-amber-50">
                  <td className="px-3 py-2"><input className={inputCls} value={draft.description}
                    onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></td>
                  <td className="px-3 py-2"><select className={inputCls} value={draft.category}
                    onChange={(e) => setDraft({ ...draft, category: e.target.value as Draft["category"] })}>
                    <option value="inflow">Inflow</option><option value="outflow">Outflow</option></select></td>
                  <td className="px-3 py-2"><select className={inputCls} value={draft.subcategory}
                    onChange={(e) => setDraft({ ...draft, subcategory: e.target.value as Subcategory })}>
                    {SUBCATS.map((s) => <option key={s} value={s}>{subcategoryLabel(s)}</option>)}</select></td>
                  <td className="px-3 py-2"><select className={inputCls} value={draft.week_offset}
                    onChange={(e) => setDraft({ ...draft, week_offset: Number(e.target.value) })}>
                    {[0, 1, 2, 3].map((w) => <option key={w} value={w}>Wk {w + 1}</option>)}</select></td>
                  <td className="px-3 py-2"><input className={inputCls + " text-right"} type="number" value={draft.forecast_amount}
                    onChange={(e) => setDraft({ ...draft, forecast_amount: e.target.value })} /></td>
                  <td className="px-3 py-2"><input className={inputCls + " text-right"} type="number" placeholder="—" value={draft.actual_amount}
                    onChange={(e) => setDraft({ ...draft, actual_amount: e.target.value })} /></td>
                  <td className="px-3 py-2 text-right text-neutral-400">auto</td>
                  <td className="px-3 py-2 text-right no-print">
                    <button disabled={busy} onClick={() => saveEdit(it.id)}
                      className="mr-1 rounded bg-emerald-600 px-2 py-1 text-xs text-white hover:bg-emerald-500 disabled:opacity-50">Save</button>
                    <button onClick={() => setEditingId(null)}
                      className="rounded bg-neutral-200 px-2 py-1 text-xs text-neutral-700 hover:bg-neutral-300">Cancel</button>
                  </td>
                </tr>
              ) : (
                <tr key={it.id} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50">
                  <td className="px-3 py-2 text-neutral-800">{it.description}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${it.category === "inflow" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                      {it.category}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-neutral-600">{subcategoryLabel(it.subcategory)}</td>
                  <td className="px-3 py-2 text-neutral-600">Wk {it.week_offset + 1}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-neutral-600">{money(it.forecast_amount, it.currency)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-neutral-800">{it.actual_amount == null ? "—" : money(it.actual_amount, it.currency)}</td>
                  <td className={`px-3 py-2 text-right tabular-nums ${it.actual_amount == null ? "text-neutral-300" : it.variance < 0 ? "text-rose-700" : it.variance > 0 ? "text-emerald-700" : "text-neutral-500"}`}>
                    {it.actual_amount == null ? "—" : signedMoney(it.variance, it.currency)}
                  </td>
                  {!readOnly && (
                    <td className="px-3 py-2 text-right no-print">
                      <button onClick={() => startEdit(it)} className="mr-2 text-xs font-medium text-blue-600 hover:underline">Edit</button>
                      <button disabled={busy} onClick={() => del(it.id)} className="text-xs font-medium text-rose-600 hover:underline disabled:opacity-50">Delete</button>
                    </td>
                  )}
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
