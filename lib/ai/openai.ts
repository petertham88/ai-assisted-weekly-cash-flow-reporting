import type { ComputedForecastWeek } from "@/lib/cashflow/forecast";
import type { ComputedFlag } from "@/lib/cashflow/risk";
import type { SectionKey } from "@/lib/db/types";

export function isAiEnabled(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

const MODEL = "gpt-4o";
const TIMEOUT_MS = 20000;

async function chat(system: string, user: string): Promise<string | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.3,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    return typeof text === "string" ? text.trim() : null;
  } catch {
    return null; // AI failure → caller uses rule-based fallback
  } finally {
    clearTimeout(timer);
  }
}

function fmt(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

export interface ReportContext {
  weekLabel: string;
  forecastWeeks: ComputedForecastWeek[];
  flags: ComputedFlag[];
  totalInflows: number;
  totalOutflows: number;
}

function contextBlock(ctx: ReportContext): string {
  const lines = ctx.forecastWeeks.map(
    (w) =>
      `${w.week_label}: opening ${fmt(w.opening_balance)}, inflows ${fmt(w.total_inflows)}, outflows ${fmt(
        w.total_outflows,
      )}, closing ${fmt(w.closing_balance)} vs forecast ${fmt(w.forecast_closing_balance)} (variance ${fmt(
        w.closing_balance - w.forecast_closing_balance,
      )})`,
  );
  const flagLines = ctx.flags.map((f) => `- [${f.severity}] ${f.description}`);
  return `Reporting week: ${ctx.weekLabel}\n\nForecast weeks:\n${lines.join("\n")}\n\nRisk flags:\n${
    flagLines.join("\n") || "(none)"
  }`;
}

// ── Risk narrative enrichment ────────────────────────────────────────────────

export interface FlagEnrichment {
  ai_value: string;
  ai_source: string;
  ai_confidence: number;
}

/** generate_risk_narratives tool — GPT-4o enriches each flag with detail + confidence. */
export async function generateRiskNarratives(
  flags: ComputedFlag[],
  ctx: ReportContext,
): Promise<Map<number, FlagEnrichment>> {
  const out = new Map<number, FlagEnrichment>();
  if (!isAiEnabled() || flags.length === 0) return out;

  const list = flags.map((f, i) => `${i}. [${f.severity}] ${f.description}`).join("\n");
  const text = await chat(
    "You are a finance analyst. For each numbered cash-flow risk flag, write one concise sentence (max 30 words) of additional analysis explaining the likely driver and implication. Respond as a JSON array of objects: [{\"i\":0,\"detail\":\"...\",\"confidence\":0.0-1.0}]. Output only JSON.",
    `${contextBlock(ctx)}\n\nFlags:\n${list}`,
  );
  if (!text) return out;
  try {
    const json = JSON.parse(text.replace(/^```json\s*/i, "").replace(/```$/i, "").trim());
    if (Array.isArray(json)) {
      for (const row of json) {
        const i = Number(row.i);
        if (Number.isInteger(i) && i >= 0 && i < flags.length && typeof row.detail === "string") {
          out.set(i, {
            ai_value: row.detail.trim(),
            ai_source: MODEL,
            ai_confidence: clampConf(row.confidence),
          });
        }
      }
    }
  } catch {
    // malformed → no enrichment; rule-based flags stand on their own
  }
  return out;
}

function clampConf(v: unknown): number {
  const n = typeof v === "number" ? v : parseFloat(String(v));
  if (isNaN(n)) return 0.7;
  return Math.max(0, Math.min(1, n));
}

// ── Report section generation ────────────────────────────────────────────────

export interface GeneratedSection {
  value: string;
  source: string;
  confidence: number;
}

/**
 * generate_report_sections tool — GPT-4o drafts the 4 management-report sections.
 * Always returns all 4 sections; falls back to a rule-based draft per section
 * when AI is unavailable or fails, so the report is never blank.
 */
export async function generateReportSections(
  ctx: ReportContext,
): Promise<Record<SectionKey, GeneratedSection>> {
  const fallback = ruleBasedSections(ctx);
  if (!isAiEnabled()) return fallback;

  const text = await chat(
    "You are a financial controller drafting a weekly cash-flow management report. Using only the data provided, write four sections. Respond as JSON: {\"executive_summary\":\"...\",\"key_variances_narrative\":\"...\",\"risk_narrative\":\"...\",\"recommended_actions\":\"...\"}. Each section 2-4 sentences, precise, board-ready. Use the actual figures. Output only JSON.",
    contextBlock(ctx),
  );
  if (!text) return fallback;
  try {
    const json = JSON.parse(text.replace(/^```json\s*/i, "").replace(/```$/i, "").trim());
    const keys: SectionKey[] = ["executive_summary", "key_variances_narrative", "risk_narrative", "recommended_actions"];
    const result = { ...fallback };
    for (const k of keys) {
      if (typeof json[k] === "string" && json[k].trim()) {
        result[k] = { value: json[k].trim(), source: MODEL, confidence: 0.85 };
      }
    }
    return result;
  } catch {
    return fallback;
  }
}

/** Deterministic, data-driven narratives used as the AI-off floor. */
export function ruleBasedSections(ctx: ReportContext): Record<SectionKey, GeneratedSection> {
  const wk0 = ctx.forecastWeeks[0];
  const last = ctx.forecastWeeks[ctx.forecastWeeks.length - 1];
  const net = wk0 ? wk0.total_inflows - wk0.total_outflows : 0;
  const closingVsForecast = wk0 ? wk0.closing_balance - wk0.forecast_closing_balance : 0;
  const highFlags = ctx.flags.filter((f) => f.severity === "high");
  const medFlags = ctx.flags.filter((f) => f.severity === "medium");

  const exec = wk0
    ? `For ${ctx.weekLabel}, the opening bank balance was ${fmt(wk0.opening_balance)}. Week-1 inflows of ${fmt(
        wk0.total_inflows,
      )} against outflows of ${fmt(wk0.total_outflows)} produced a net movement of ${fmt(net)}, closing at ${fmt(
        wk0.closing_balance,
      )} — ${closingVsForecast < 0 ? `${fmt(Math.abs(closingVsForecast))} below` : `${fmt(closingVsForecast)} ahead of`} forecast. Over the 4-week horizon the balance is projected to close at ${fmt(
        last?.closing_balance ?? wk0.closing_balance,
      )}.`
    : "No cash flow data is available for this reporting week yet.";

  const variances = ctx.forecastWeeks
    .map((w) => `${w.week_label} closed ${fmt(w.closing_balance)} vs forecast ${fmt(w.forecast_closing_balance)} (${w.closing_balance - w.forecast_closing_balance >= 0 ? "+" : ""}${fmt(w.closing_balance - w.forecast_closing_balance)})`)
    .join("; ");
  const variancesText = variances
    ? `Week-by-week actual vs forecast: ${variances}. Line-item variances beyond ±10% are captured in the risk flags below.`
    : "No variances to report.";

  const riskText = ctx.flags.length
    ? `${highFlags.length} high-severity and ${medFlags.length} medium-severity risk${
        ctx.flags.length === 1 ? "" : "s"
      } are active. ${highFlags[0]?.description ?? medFlags[0]?.description ?? ""}`.trim()
    : "No material risks were detected this week; all lines are within tolerance.";

  const actions = ctx.flags.length
    ? ctx.flags
        .slice(0, 4)
        .map((f, i) => `${i + 1}. ${f.recommended_action}`)
        .join(" ")
    : "1. No action required this week. 2. Continue monitoring AR collections and payroll against forecast.";

  return {
    executive_summary: { value: exec, source: "rule-based", confidence: 0.6 },
    key_variances_narrative: { value: variancesText, source: "rule-based", confidence: 0.6 },
    risk_narrative: { value: riskText, source: "rule-based", confidence: 0.6 },
    recommended_actions: { value: actions, source: "rule-based", confidence: 0.6 },
  };
}
