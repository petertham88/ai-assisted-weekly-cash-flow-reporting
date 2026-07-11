import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { writeAudit } from "@/lib/audit";
import type { RiskFlag } from "@/lib/db/types";

export const runtime = "nodejs";

const VALID_STATUS = ["unreviewed", "accepted", "dismissed", "needs_edit"];

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const supabase = createServiceClient();
    const { data: flag } = await supabase.from("risk_flags").select("*").eq("id", id).maybeSingle();
    if (!flag) return NextResponse.json({ error: "Flag not found." }, { status: 404 });
    const current = flag as RiskFlag;

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
      detail: { severity: current.severity, note: reviewerNote },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Update failed." }, { status: 500 });
  }
}
