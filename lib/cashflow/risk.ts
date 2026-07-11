import type { CashFlowItem, FlagType, Severity, Subcategory } from "@/lib/db/types";
import type { ComputedForecastWeek } from "./forecast";

export interface ComputedFlag {
  cash_flow_item_id: string | null;
  flag_type: FlagType;
  description: string;
  recommended_action: string;
  severity: Severity;
  ai_value: string | null;
  ai_source: string;
  ai_confidence: number | null;
  // sort helper (not persisted)
  _varianceMag: number;
}

const LOW_BALANCE_FLOOR = 250000;

function fmt(n: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
}

/**
 * run_risk_scoring tool — pure rule-based variance checks (no AI). Produces the
 * rule-based floor of flags so risks always exist even when GPT-4o is unavailable.
 *
 * Rules (docs/INTELLIGENCE_LAYER.md):
 *  - line-item variance > ±10% → medium; > ±20% → high
 *  - any forecast week closing_balance < $250,000 → low_balance_risk (high)
 *  - payroll actual > forecast → payroll_overrun (medium)
 */
export function runRiskScoring(
  items: (Pick<
    CashFlowItem,
    "id" | "category" | "subcategory" | "description" | "week_offset" | "forecast_amount" | "actual_amount" | "currency"
  >)[],
  forecastWeeks: ComputedForecastWeek[],
): ComputedFlag[] {
  const flags: ComputedFlag[] = [];

  for (const it of items) {
    if (it.actual_amount == null || it.forecast_amount === 0) continue;
    const variance = it.actual_amount - it.forecast_amount;
    const pct = variance / it.forecast_amount;
    const absPct = Math.abs(pct);
    const currency = it.currency ?? "USD";

    // Payroll overrun: actual over forecast by any amount.
    if (it.subcategory === "payroll" && variance > 0) {
      flags.push({
        cash_flow_item_id: it.id,
        flag_type: "payroll_overrun",
        description: `Payroll ${fmt(variance, currency)} over forecast (+${(pct * 100).toFixed(1)}%). Review headcount changes or overtime.`,
        recommended_action: "Obtain payroll breakdown from HR. Confirm whether the overrun is one-off or recurring.",
        severity: "medium",
        ai_value: null,
        ai_source: "rule-based",
        ai_confidence: null,
        _varianceMag: Math.abs(variance),
      });
      continue;
    }

    if (absPct <= 0.1) continue;

    const severity: Severity = absPct > 0.2 ? "high" : "medium";
    const { flag_type, description, action } = classifyVariance(it, variance, pct, currency);

    flags.push({
      cash_flow_item_id: it.id,
      flag_type,
      description,
      recommended_action: action,
      severity,
      ai_value: null,
      ai_source: "rule-based",
      ai_confidence: null,
      _varianceMag: Math.abs(variance),
    });
  }

  // Low balance risk on any forecast week.
  for (const w of forecastWeeks) {
    if (w.closing_balance < LOW_BALANCE_FLOOR) {
      flags.push({
        cash_flow_item_id: null,
        flag_type: "low_balance_risk",
        description: `${w.week_label} projected closing balance ${fmt(w.closing_balance)} is below the ${fmt(LOW_BALANCE_FLOOR)} minimum operating threshold.`,
        recommended_action: "Arrange a standby facility draw-down and prioritise AR collections to restore the balance above the floor.",
        severity: "high",
        ai_value: null,
        ai_source: "rule-based",
        ai_confidence: null,
        _varianceMag: LOW_BALANCE_FLOOR - w.closing_balance,
      });
    }
  }

  return flags;
}

function classifyVariance(
  it: { category: string; subcategory: Subcategory | null; description: string },
  variance: number,
  pct: number,
  currency: string,
): { flag_type: FlagType; description: string; action: string } {
  const dir = pct < 0 ? "below" : "above";
  const pctStr = `${(pct * 100).toFixed(1)}%`;

  if (it.category === "inflow" && it.subcategory === "accounts_receivable" && variance < 0) {
    return {
      flag_type: "collection_shortfall",
      description: `${it.description}: collections ${fmt(Math.abs(variance), currency)} ${dir} forecast (${pctStr}). Payment may be delayed.`,
      action: "Contact the customer's AR team to confirm payment ETA and adjust the forecast if the shortfall persists.",
    };
  }
  if (it.category === "outflow" && it.subcategory === "accounts_payable" && variance > 0) {
    return {
      flag_type: "ap_spike",
      description: `${it.description}: supplier payment ${fmt(variance, currency)} ${dir} forecast (+${pctStr}).`,
      action: "Verify the invoice and confirm whether the increase is a timing shift or a genuine cost increase.",
    };
  }
  return {
    flag_type: "other",
    description: `${it.description}: actual ${fmt(Math.abs(variance), currency)} ${dir} forecast (${pctStr}).`,
    action: "Review the underlying transaction and confirm the variance driver.",
  };
}

const SEVERITY_RANK: Record<Severity, number> = { high: 3, medium: 2, low: 1 };

/** Sort by severity desc → ai_confidence desc → variance magnitude desc. */
export function sortFlags<T extends { severity: Severity; ai_confidence: number | null; _varianceMag?: number }>(
  flags: T[],
): T[] {
  return [...flags].sort((a, b) => {
    if (SEVERITY_RANK[b.severity] !== SEVERITY_RANK[a.severity])
      return SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
    const ca = a.ai_confidence ?? 0;
    const cb = b.ai_confidence ?? 0;
    if (cb !== ca) return cb - ca;
    return (b._varianceMag ?? 0) - (a._varianceMag ?? 0);
  });
}
