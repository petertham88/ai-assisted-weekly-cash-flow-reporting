"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function ChangePasswordForm({ userEmail }: { userEmail: string }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(false);
    if (next.length < 6) {
      setError("New password must be at least 6 characters.");
      return;
    }
    if (next !== confirm) {
      setError("New passwords don't match.");
      return;
    }
    if (next === current) {
      setError("New password must be different from your current password.");
      return;
    }

    setBusy(true);
    const supabase = createClient();

    // Re-authenticate to confirm the current password before changing it.
    const { error: signInErr } = await supabase.auth.signInWithPassword({ email: userEmail, password: current });
    if (signInErr) {
      setError("Current password is incorrect.");
      setBusy(false);
      return;
    }

    const { error: updErr } = await supabase.auth.updateUser({ password: next });
    setBusy(false);
    if (updErr) {
      setError(updErr.message);
      return;
    }
    setDone(true);
    setCurrent("");
    setNext("");
    setConfirm("");
  }

  const inputCls = "w-full rounded-md border border-neutral-300 px-3 py-2 text-sm";

  return (
    <div className="max-w-md rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-neutral-900">Change password</h2>
      <p className="mt-1 text-sm text-neutral-500">
        Signed in as <span className="font-medium">{userEmail}</span>.
      </p>

      <form onSubmit={submit} className="mt-5 space-y-3">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-neutral-600">Current password</span>
          <input type="password" required autoComplete="current-password" value={current}
            onChange={(e) => setCurrent(e.target.value)} className={inputCls} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-neutral-600">New password</span>
          <input type="password" required autoComplete="new-password" placeholder="At least 6 characters"
            value={next} onChange={(e) => setNext(e.target.value)} className={inputCls} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-neutral-600">Confirm new password</span>
          <input type="password" required autoComplete="new-password" value={confirm}
            onChange={(e) => setConfirm(e.target.value)} className={inputCls} />
        </label>

        {error && <p className="rounded bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        {done && <p className="rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Password updated successfully.</p>}

        <button type="submit" disabled={busy}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50">
          {busy ? "Updating…" : "Update password"}
        </button>
      </form>
    </div>
  );
}
