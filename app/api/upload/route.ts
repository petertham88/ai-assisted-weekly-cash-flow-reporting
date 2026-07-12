import { NextResponse } from "next/server";
import { getAuthedClient, actorLabel } from "@/lib/auth";
import { parseUploadFile } from "@/lib/cashflow/parse";
import { recompute } from "@/lib/cashflow/orchestrate";
import { writeAudit } from "@/lib/audit";
import type { WeeklyReport } from "@/lib/db/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const ALLOWED_EXT = ["csv", "xls", "xlsx", "tsv", "txt"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function mondayOf(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay(); // 0 Sun .. 6 Sat
  const diff = (day + 6) % 7; // days since Monday
  d.setUTCDate(d.getUTCDate() - diff);
  return d;
}

export async function POST(req: Request) {
  try {
    const { supabase, user } = await getAuthedClient();
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }

    const ext = (file.name.split(".").pop() ?? "").toLowerCase();
    if (!ALLOWED_EXT.includes(ext)) {
      return NextResponse.json(
        { error: `Unsupported file type ".${ext}". Upload a CSV or Excel (.xlsx) file.` },
        { status: 400 },
      );
    }

    const openingBalanceRaw = form.get("openingBalance");
    const openingBalance =
      openingBalanceRaw != null && String(openingBalanceRaw).trim() !== ""
        ? Number(String(openingBalanceRaw).replace(/[,$\s]/g, ""))
        : undefined;

    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = parseUploadFile(buffer, file.name);

    if (parsed.items.length === 0) {
      return NextResponse.json(
        {
          error:
            "We couldn't read any cash flow items from this file. Check the column headers and try again.",
        },
        { status: 422 },
      );
    }

    // Create the weekly report for the current week.
    const monday = mondayOf(new Date());
    const weekLabel =
      (form.get("weekLabel") && String(form.get("weekLabel")).trim()) ||
      `Week of ${monday.getUTCDate()} ${MONTHS[monday.getUTCMonth()]} ${monday.getUTCFullYear()}`;
    const reportDate = monday.toISOString().slice(0, 10);

    const { data: reportRow, error: reportErr } = await supabase
      .from("weekly_reports")
      .insert({ report_date: reportDate, week_label: weekLabel, status: "draft", user_id: user.id })
      .select("*")
      .single();
    if (reportErr || !reportRow) {
      return NextResponse.json({ error: `Could not create report: ${reportErr?.message}` }, { status: 500 });
    }
    const report = reportRow as WeeklyReport;

    // Insert cash flow items.
    const { error: itemsErr } = await supabase.from("cash_flow_items").insert(
      parsed.items.map((it) => ({
        weekly_report_id: report.id,
        user_id: user.id,
        category: it.category,
        subcategory: it.subcategory,
        description: it.description,
        week_offset: it.week_offset,
        forecast_amount: it.forecast_amount,
        actual_amount: it.actual_amount,
        currency: it.currency,
        source_file: file.name,
      })),
    );
    if (itemsErr) {
      // Roll back the empty report so we don't leave orphans.
      await supabase.from("weekly_reports").delete().eq("id", report.id);
      return NextResponse.json({ error: `Could not save items: ${itemsErr.message}` }, { status: 500 });
    }

    // Consolidate forecast + rule-based (and AI, if enabled) risk flags.
    await recompute(supabase, report, { openingBalance, enrichAi: true, userId: user.id });

    await writeAudit(supabase, {
      action: "file.uploaded",
      target_table: "weekly_reports",
      target_id: report.id,
      actor_label: actorLabel(user),
      user_id: user.id,
      detail: { filename: file.name, rows: parsed.rowsSeen, items: parsed.items.length },
    });

    return NextResponse.json({ reportId: report.id, itemCount: parsed.items.length });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed." },
      { status: 500 },
    );
  }
}
