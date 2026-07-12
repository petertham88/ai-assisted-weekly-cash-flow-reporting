"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { WeeklyReport } from "@/lib/db/types";

export function TopNav({
  reports,
  currentId,
  userEmail,
  demo = false,
}: {
  reports: WeeklyReport[];
  currentId?: string;
  userEmail?: string | null;
  demo?: boolean;
}) {
  const router = useRouter();

  return (
    <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white/90 backdrop-blur no-print">
      {demo && (
        <div className="bg-amber-100 px-4 py-1.5 text-center text-xs font-medium text-amber-800">
          Read-only demo · <Link href="/login" className="underline">sign in</Link> to create and edit your own reports
        </div>
      )}
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
        <Link href={demo ? "/demo" : "/"} className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-neutral-900 text-sm font-bold text-white">
            $
          </span>
          <span className="text-sm font-semibold text-neutral-800">Weekly Cash Flow</span>
        </Link>

        {!demo && reports.length > 0 && (
          <select
            value={currentId ?? ""}
            onChange={(e) => router.push(`/report/${e.target.value}`)}
            className="rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm text-neutral-700"
          >
            {reports.map((r) => (
              <option key={r.id} value={r.id}>
                {r.week_label} {r.status === "approved" ? "✓" : ""}
              </option>
            ))}
          </select>
        )}

        <nav className="ml-auto flex items-center gap-1">
          {demo ? (
            <Link
              href="/login"
              className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-700"
            >
              Sign in
            </Link>
          ) : (
            <>
              <Link href="/" className="rounded px-3 py-1.5 text-sm font-medium text-neutral-600 hover:bg-neutral-100">
                Current
              </Link>
              <Link href="/reports" className="rounded px-3 py-1.5 text-sm font-medium text-neutral-600 hover:bg-neutral-100">
                History
              </Link>
              <Link
                href="/upload"
                className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-700"
              >
                Upload Weekly Data
              </Link>
              {userEmail && (
                <div className="ml-2 flex items-center gap-2 border-l border-neutral-200 pl-3">
                  <span className="hidden max-w-[160px] truncate text-xs text-neutral-500 sm:inline" title={userEmail}>
                    {userEmail}
                  </span>
                  <form action="/auth/signout" method="post">
                    <button className="rounded px-2 py-1.5 text-sm font-medium text-neutral-600 hover:bg-neutral-100">
                      Sign out
                    </button>
                  </form>
                </div>
              )}
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
