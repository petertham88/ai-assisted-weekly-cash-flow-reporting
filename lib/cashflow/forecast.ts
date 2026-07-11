import type { CashFlowItem } from "@/lib/db/types";

export interface ComputedForecastWeek {
  week_offset: number;
  week_label: string;
  opening_balance: number;
  total_inflows: number;
  total_outflows: number;
  closing_balance: number;
  forecast_closing_balance: number;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function weekLabel(reportDate: string, offset: number): string {
  const d = new Date(reportDate + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + offset * 7);
  return `Wk ${offset + 1} (${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]})`;
}

/**
 * compute_forecast_weeks tool — aggregate cash flow items into a 4-week rolling
 * forecast. Opening balance chains week to week (each week opens where the prior
 * week closed). "Actual" basis uses actual amounts where present, falling back to
 * forecast; "forecast" basis always uses forecast amounts.
 */
export function computeForecastWeeks(
  items: Pick<CashFlowItem, "category" | "week_offset" | "forecast_amount" | "actual_amount">[],
  reportDate: string,
  openingBalance: number,
): ComputedForecastWeek[] {
  const weeks: ComputedForecastWeek[] = [];
  let opening = openingBalance;
  let forecastOpening = openingBalance;

  for (let offset = 0; offset <= 3; offset++) {
    const weekItems = items.filter((i) => i.week_offset === offset);

    let actualIn = 0;
    let actualOut = 0;
    let forecastIn = 0;
    let forecastOut = 0;

    for (const it of weekItems) {
      const actual = it.actual_amount != null ? it.actual_amount : it.forecast_amount;
      if (it.category === "inflow") {
        actualIn += actual;
        forecastIn += it.forecast_amount;
      } else {
        actualOut += actual;
        forecastOut += it.forecast_amount;
      }
    }

    const closing = opening + actualIn - actualOut;
    const forecastClosing = forecastOpening + forecastIn - forecastOut;

    weeks.push({
      week_offset: offset,
      week_label: weekLabel(reportDate, offset),
      opening_balance: round2(opening),
      total_inflows: round2(actualIn),
      total_outflows: round2(actualOut),
      closing_balance: round2(closing),
      forecast_closing_balance: round2(forecastClosing),
    });

    opening = closing;
    forecastOpening = forecastClosing;
  }

  return weeks;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
