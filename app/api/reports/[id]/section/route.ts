import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { writeAudit } from "@/lib/audit";
import { SECTION_KEYS, type SectionKey } from "@/lib/db/types";

export const runtime = "nodejs";

/** Inline edit of one report section — saves immediately, marks it edited. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const body = await req.json();
    const section = String(body.section ?? "") as SectionKey;
    if (!SECTION_KEYS.includes(section)) {
      return NextResponse.json({ error: "Invalid section." }, { status: 400 });
    }
    const value = String(body.value ?? "");

    const supabase = createServiceClient();
    const { data: output } = await supabase
      .from("report_outputs")
      .select("id, overall_review_status")
      .eq("weekly_report_id", id)
      .maybeSingle();
    if (!output) return NextResponse.json({ error: "No report to edit yet." }, { status: 404 });
    if ((output as { overall_review_status: string }).overall_review_status === "approved") {
      return NextResponse.json({ error: "Report is approved and locked." }, { status: 409 });
    }

    const { error } = await supabase
      .from("report_outputs")
      .update({
        [section]: value,
        [`${section}_source`]: "edited",
        [`${section}_review_status`]: "edited",
      })
      .eq("id", (output as { id: string }).id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await writeAudit(supabase, {
      action: "report_output.section_edited",
      target_table: "report_outputs",
      target_id: id,
      detail: { section },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Save failed." }, { status: 500 });
  }
}
