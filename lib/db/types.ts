// Shared domain types mirroring supabase/migrations/0001_init.sql

export type CashCategory = "inflow" | "outflow";
export type Subcategory =
  | "accounts_receivable"
  | "accounts_payable"
  | "payroll"
  | "loan_repayment"
  | "tax"
  | "other";

export type Severity = "low" | "medium" | "high";
export type FlagReviewStatus = "unreviewed" | "accepted" | "dismissed" | "needs_edit";
export type FlagType =
  | "collection_shortfall"
  | "payroll_overrun"
  | "low_balance_risk"
  | "ap_spike"
  | "other";

export interface WeeklyReport {
  id: string;
  user_id: string | null;
  report_date: string;
  week_label: string;
  status: "draft" | "approved";
  created_at: string;
}

export interface CashFlowItem {
  id: string;
  user_id: string | null;
  weekly_report_id: string;
  category: CashCategory;
  subcategory: Subcategory | null;
  description: string;
  week_offset: number;
  forecast_amount: number;
  actual_amount: number | null;
  variance: number; // generated: coalesce(actual,0) - forecast
  currency: string;
  source_file: string | null;
  created_at: string;
}

export interface ForecastWeek {
  id: string;
  user_id: string | null;
  weekly_report_id: string;
  week_offset: number;
  week_label: string;
  opening_balance: number;
  total_inflows: number;
  total_outflows: number;
  closing_balance: number;
  forecast_closing_balance: number;
  variance: number; // generated: closing - forecast_closing
  created_at: string;
}

export interface RiskFlag {
  id: string;
  user_id: string | null;
  weekly_report_id: string;
  cash_flow_item_id: string | null;
  flag_type: FlagType;
  description: string;
  recommended_action: string | null;
  severity: Severity;
  review_status: FlagReviewStatus;
  ai_value: string | null;
  ai_source: string | null;
  ai_confidence: number | null;
  reviewer_note: string | null;
  created_at: string;
}

export type SectionReviewStatus = "unreviewed" | "edited" | "accepted";

export interface ReportOutput {
  id: string;
  user_id: string | null;
  weekly_report_id: string;
  executive_summary: string | null;
  executive_summary_source: string | null;
  executive_summary_confidence: number | null;
  executive_summary_review_status: string;
  key_variances_narrative: string | null;
  key_variances_narrative_source: string | null;
  key_variances_narrative_confidence: number | null;
  key_variances_narrative_review_status: string;
  risk_narrative: string | null;
  risk_narrative_source: string | null;
  risk_narrative_confidence: number | null;
  risk_narrative_review_status: string;
  recommended_actions: string | null;
  recommended_actions_source: string | null;
  recommended_actions_confidence: number | null;
  recommended_actions_review_status: string;
  overall_review_status: "draft" | "approved";
  approved_at: string | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  actor_label: string | null;
  action: string;
  target_table: string | null;
  target_id: string | null;
  detail: Record<string, unknown> | null;
  created_at: string;
}

export const SECTION_KEYS = [
  "executive_summary",
  "key_variances_narrative",
  "risk_narrative",
  "recommended_actions",
] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];

export const SECTION_LABELS: Record<SectionKey, string> = {
  executive_summary: "Executive Summary",
  key_variances_narrative: "Key Variances",
  risk_narrative: "Risk Narrative",
  recommended_actions: "Recommended Actions",
};

export interface ReportBundle {
  report: WeeklyReport;
  items: CashFlowItem[];
  forecastWeeks: ForecastWeek[];
  flags: RiskFlag[];
  output: ReportOutput | null;
}
