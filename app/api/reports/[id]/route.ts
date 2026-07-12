import { NextResponse } from "next/server";
import { getAuthedClient, actorLabel } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import type { WeeklyReport } from "@/lib/db/types";

export const runtime = "nodejs";

/**
 * Delete a report and its cascaded rows. Approved reports are protected
 * (docs/AGENTIC_LAYER.md: deleting an approved report is human-only) unless the
 * caller explicitly confirms with { force: true }.
 */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const { supabase, user } = await getAuthedClient();
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    const { data: report } = await supabase.from("weekly_reports").select("status, user_id").eq("id", id).maybeSingle();
    if (!report) return NextResponse.json({ error: "Report not found." }, { status: 404 });
    if ((report as Pick<WeeklyReport, "user_id">).user_id !== user.id)
      return NextResponse.json({ error: "You don't own this report." }, { status: 403 });

    const url = new URL(req.url);
    const force = url.searchParams.get("force") === "true";
    if ((report as { status: string }).status === "approved" && !force) {
      return NextResponse.json(
        { error: "This report is approved. Confirm deletion to proceed." },
        { status: 409 },
      );
    }

    await writeAudit(supabase, {
      action: "weekly_report.deleted",
      target_table: "weekly_reports",
      target_id: id,
      actor_label: actorLabel(user),
      user_id: user.id,
      detail: { status: (report as { status: string }).status },
    });
    const { error } = await supabase.from("weekly_reports").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Delete failed." }, { status: 500 });
  }
}
