import Link from "next/link";
import { listReports, getReportBundle, getPriorClosing } from "@/lib/data";
import { isAiEnabled } from "@/lib/ai/openai";
import { ReportView } from "@/app/components/ReportView";

export const dynamic = "force-dynamic";

export default async function Home() {
  const reports = await listReports();

  if (reports.length === 0) {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-4 p-8 text-center">
        <h1 className="text-3xl font-bold text-neutral-900">Weekly Cash Flow Reporting</h1>
        <p className="text-neutral-500">
          No reports yet. Upload a weekly Finance data file to consolidate cash flow, build the 4-week forecast, and
          generate a management report.
        </p>
        <Link href="/upload" className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700">
          Upload Weekly Data
        </Link>
      </main>
    );
  }

  const bundle = await getReportBundle(reports[0].id);
  if (!bundle) {
    return <div className="p-8 text-neutral-500">Report not found.</div>;
  }
  const priorClosing = await getPriorClosing(bundle.report, reports);

  return <ReportView bundle={bundle} reports={reports} priorClosing={priorClosing} aiEnabled={isAiEnabled()} />;
}
