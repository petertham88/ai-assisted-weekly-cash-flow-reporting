import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { listReports } from "@/lib/data";
import { TopNav } from "@/app/components/TopNav";
import { ChangePasswordForm } from "@/app/components/ChangePasswordForm";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const reports = await listReports(user.id);

  return (
    <div>
      <TopNav reports={reports} userEmail={user.email} />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Account</h1>
          <p className="text-sm text-neutral-500">Manage your sign-in credentials.</p>
        </div>
        <ChangePasswordForm userEmail={user.email ?? ""} />
      </main>
    </div>
  );
}
