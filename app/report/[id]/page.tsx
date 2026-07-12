import Link from "next/link";
import { redirect } from "next/navigation";
import { listReports, getReportBundle, getPriorClosing } from "@/lib/data";
import { getSessionUser } from "@/lib/auth";
import { isAiEnabled } from "@/lib/ai/openai";
import { ReportView } from "@/app/components/ReportView";

export const dynamic = "force-dynamic";

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const [reports, bundle] = await Promise.all([listReports(user.id), getReportBundle(id)]);

  // Ownership enforcement (app-layer): a report you don't own is treated as not found.
  if (!bundle || bundle.report.user_id !== user.id) {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-4 p-8 text-center">
        <h1 className="text-2xl font-bold text-neutral-900">Report not available</h1>
        <p className="text-neutral-500">This report doesn&apos;t exist or belongs to another account.</p>
        <Link href="/" className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700">
          Back to your reports
        </Link>
      </main>
    );
  }

  const priorClosing = await getPriorClosing(bundle.report, reports);
  return (
    <ReportView bundle={bundle} reports={reports} priorClosing={priorClosing} aiEnabled={isAiEnabled()} userEmail={user.email} />
  );
}
