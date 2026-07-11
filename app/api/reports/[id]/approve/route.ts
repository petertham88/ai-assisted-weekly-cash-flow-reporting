import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { writeAudit } from "@/lib/audit";

export const runtime = "nodejs";

/** Approve (or re-open) the report — high-risk action, always audited. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const supabase = createServiceClient();
    const body = await req.json().catch(() => ({}));
    const unlock = body?.unlock === true;

    const { data: output } = await supabase
      .from("report_outputs")
      .select("id")
      .eq("weekly_report_id", id)
      .maybeSingle();
    if (!output) return NextResponse.json({ error: "No report to approve yet." }, { status: 404 });

    const now = new Date().toISOString();
    if (unlock) {
      await supabase
        .from("report_outputs")
        .update({ overall_review_status: "draft", approved_at: null })
        .eq("id", (output as { id: string }).id);
      await supabase.from("weekly_reports").update({ status: "draft" }).eq("id", id);
      await writeAudit(supabase, {
        action: "report_output.reopened",
        target_table: "report_outputs",
        target_id: id,
      });
      return NextResponse.json({ ok: true, status: "draft" });
    }

    const { error } = await supabase
      .from("report_outputs")
      .update({ overall_review_status: "approved", approved_at: now })
      .eq("id", (output as { id: string }).id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await supabase.from("weekly_reports").update({ status: "approved" }).eq("id", id);

    await writeAudit(supabase, {
      action: "report_output.approved",
      target_table: "report_outputs",
      target_id: id,
      detail: { approved_at: now },
    });
    return NextResponse.json({ ok: true, status: "approved", approved_at: now });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Approval failed." }, { status: 500 });
  }
}
