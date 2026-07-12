import Link from "next/link";
import { listReports, getReportBundle } from "@/lib/data";
import { isAiEnabled } from "@/lib/ai/openai";
import { ReportView } from "@/app/components/ReportView";

export const dynamic = "force-dynamic";

/**
 * Public, read-only demo built from the seed data (weekly_reports with user_id IS NULL).
 * No session required — this is the explicit "demo mode" exception to the auth wall.
 */
export default async function DemoPage() {
  const demoReports = await listReports(null);
  const withData = demoReports[0];

  if (!withData) {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-4 p-8 text-center">
        <h1 className="text-2xl font-bold text-neutral-900">No demo data</h1>
        <Link href="/login" className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700">
          Sign in
        </Link>
      </main>
    );
  }

  const bundle = await getReportBundle(withData.id);
  if (!bundle) return <div className="p-8 text-neutral-500">Demo report not found.</div>;

  return <ReportView bundle={bundle} reports={[]} priorClosing={null} aiEnabled={isAiEnabled()} readOnly />;
}
