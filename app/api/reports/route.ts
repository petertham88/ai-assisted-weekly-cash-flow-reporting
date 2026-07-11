import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { writeAudit } from "@/lib/audit";

export const runtime = "nodejs";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function mondayOf(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d;
}

/** Create a blank draft report (for manual line-item entry without a file). */
export async function POST(req: Request) {
  try {
    const supabase = createServiceClient();
    const body = await req.json().catch(() => ({}));
    const monday = mondayOf(new Date());
    const weekLabel =
      (body.weekLabel && String(body.weekLabel).trim()) ||
      `Week of ${monday.getUTCDate()} ${MONTHS[monday.getUTCMonth()]} ${monday.getUTCFullYear()}`;

    const { data, error } = await supabase
      .from("weekly_reports")
      .insert({ report_date: monday.toISOString().slice(0, 10), week_label: weekLabel, status: "draft" })
      .select("id")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await writeAudit(supabase, {
      action: "weekly_report.created",
      target_table: "weekly_reports",
      target_id: data?.id,
      detail: { manual: true },
    });
    return NextResponse.json({ ok: true, reportId: data?.id });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Create failed." }, { status: 500 });
  }
}
