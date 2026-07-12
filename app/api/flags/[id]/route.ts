import { NextResponse } from "next/server";
import { getAuthedClient, actorLabel } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import type { RiskFlag, WeeklyReport } from "@/lib/db/types";

export const runtime = "nodejs";

const VALID_STATUS = ["unreviewed", "accepted", "dismissed", "needs_edit"];

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const { supabase, user } = await getAuthedClient();
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    const { data: flag } = await supabase.from("risk_flags").select("*").eq("id", id).maybeSingle();
    if (!flag) return NextResponse.json({ error: "Flag not found." }, { status: 404 });
    const current = flag as RiskFlag;
    const { data: report } = await supabase
      .from("weekly_reports")
      .select("user_id")
      .eq("id", current.weekly_report_id)
      .maybeSingle();
    if (!report || (report as Pick<WeeklyReport, "user_id">).user_id !== user.id)
      return NextResponse.json({ error: "You don't own this flag." }, { status: 403 });

    const body = await req.json();
    const status = String(body.review_status ?? "");
    if (!VALID_STATUS.includes(status)) {
      return NextResponse.json({ error: "Invalid review status." }, { status: 400 });
    }
    const reviewerNote = body.reviewer_note != null ? String(body.reviewer_note).trim() : null;

    // High-severity flags require a reviewer note to be dismissed (docs/AGENTIC_LAYER.md).
    if (status === "dismissed" && current.severity === "high" && !reviewerNote) {
      return NextResponse.json(
        { error: "A reviewer note is required to dismiss a high-severity flag." },
        { status: 400 },
      );
    }

    const { error } = await supabase
      .from("risk_flags")
      .update({ review_status: status, reviewer_note: reviewerNote })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await writeAudit(supabase, {
      action: `risk_flag.${status}`,
      target_table: "risk_flags",
      target_id: id,
      actor_label: actorLabel(user),
      user_id: user.id,
      detail: { severity: current.severity, note: reviewerNote },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Update failed." }, { status: 500 });
  }
}
