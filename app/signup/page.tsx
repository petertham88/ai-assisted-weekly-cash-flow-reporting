"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [session, setSession] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/confirm` },
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    // If email confirmation is off, a session is returned immediately.
    if (data.session) {
      setSession(true);
      window.location.href = "/";
      return;
    }
    setSent(true);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <div className="rounded-xl border border-neutral-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-neutral-900 text-sm font-bold text-white">$</span>
          <span className="text-lg font-semibold text-neutral-800">Weekly Cash Flow</span>
        </div>

        {sent ? (
          <div>
            <h1 className="text-xl font-bold text-neutral-900">Check your email</h1>
            <p className="mt-2 text-sm text-neutral-600">
              We sent a confirmation link to <span className="font-medium">{email}</span>. Click it to activate your
              account, then sign in.
            </p>
            <Link href="/login" className="mt-4 inline-block rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700">
              Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <h1 className="text-xl font-bold text-neutral-900">Create account</h1>
            <p className="mt-1 text-sm text-neutral-500">Start building your weekly cash flow reports.</p>
            <form onSubmit={submit} className="mt-6 space-y-3">
              <input type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" />
              <input type="password" required placeholder="Password (min 6 chars)" value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" />
              {error && <p className="rounded bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
              <button type="submit" disabled={busy || session}
                className="w-full rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50">
                {busy ? "Creating…" : "Create account"}
              </button>
            </form>
            <p className="mt-4 text-sm text-neutral-500">
              Already have an account?{" "}
              <Link href="/login" className="font-medium text-blue-600 hover:underline">Sign in</Link>
            </p>
          </>
        )}
      </div>
    </main>
  );
}
