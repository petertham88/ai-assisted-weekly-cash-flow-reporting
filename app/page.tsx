import Link from "next/link";
import { redirect } from "next/navigation";
import { listReports, getReportBundle, getPriorClosing } from "@/lib/data";
import { getSessionUser } from "@/lib/auth";
import { isAiEnabled } from "@/lib/ai/openai";
import { ReportView } from "@/app/components/ReportView";
import { TopNav } from "@/app/components/TopNav";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const reports = await listReports(user.id);

  if (reports.length === 0) {
    return (
      <div>
        <TopNav reports={[]} userEmail={user.email} />
        <main className="mx-auto flex max-w-xl flex-col items-center justify-center gap-4 px-4 py-24 text-center">
          <h1 className="text-3xl font-bold text-neutral-900">Welcome</h1>
          <p className="text-neutral-500">
            You don&apos;t have any reports yet. Upload a weekly Finance data file to consolidate cash flow, build the
            4-week forecast, and generate a management report.
          </p>
          <Link href="/upload" className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700">
            Upload Weekly Data
          </Link>
          <Link href="/demo" className="text-sm font-medium text-neutral-500 hover:text-neutral-800">
            or view the read-only demo
          </Link>
        </main>
      </div>
    );
  }

  const bundle = await getReportBundle(reports[0].id);
  if (!bundle) return <div className="p-8 text-neutral-500">Report not found.</div>;
  const priorClosing = await getPriorClosing(bundle.report, reports);

  return (
    <ReportView bundle={bundle} reports={reports} priorClosing={priorClosing} aiEnabled={isAiEnabled()} userEmail={user.email} />
  );
}
