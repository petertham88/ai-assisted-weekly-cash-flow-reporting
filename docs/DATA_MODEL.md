# Data Model

## weekly_reports
| Field | Type | Notes |
|-------|------|-------|
| id | uuid PK | |
| user_id | uuid nullable | owner (populated at lock-down sprint) |
| report_date | date | Monday of the reporting week |
| week_label | text | e.g. "Week of 14 Jul 2025" |
| status | text | draft \| approved |
| created_at | timestamptz | |

## cash_flow_items
| Field | Type | Notes |
|-------|------|-------|
| id | uuid PK | |
| user_id | uuid nullable | |
| weekly_report_id | uuid FK → weekly_reports | |
| category | text | inflow \| outflow |
| subcategory | text | accounts_receivable \| accounts_payable \| payroll \| loan_repayment \| tax \| other |
| description | text | |
| week_offset | integer | 0 = current week, 1–3 = forecast weeks |
| forecast_amount | numeric | |
| actual_amount | numeric nullable | null for future weeks |
| variance | numeric | computed: actual − forecast |
| currency | text | |
| source_file | text nullable | original filename |
| created_at | timestamptz | |

## forecast_weeks
| Field | Type | Notes |
|-------|------|-------|
| id | uuid PK | |
| user_id | uuid nullable | |
| weekly_report_id | uuid FK | |
| week_offset | integer | 0–3 |
| week_label | text | |
| opening_balance | numeric | |
| total_inflows | numeric | |
| total_outflows | numeric | |
| closing_balance | numeric | actual |
| forecast_closing_balance | numeric | |
| variance | numeric | computed |
| created_at | timestamptz | |

## risk_flags
| Field | Type | Notes |
|-------|------|-------|
| id | uuid PK | |
| user_id | uuid nullable | |
| weekly_report_id | uuid FK | |
| cash_flow_item_id | uuid FK nullable | |
| flag_type | text | collection_shortfall \| payroll_overrun \| low_balance_risk \| ap_spike \| other |
| description | text | |
| recommended_action | text | |
| severity | text | low \| medium \| high |
| review_status | text | unreviewed \| accepted \| dismissed \| needs_edit |
| **ai_value** | text | AI-generated flag detail |
| **ai_source** | text | e.g. "gpt-4o" or "rule-based" |
| **ai_confidence** | numeric | 0–1 |
| reviewer_note | text nullable | |
| created_at | timestamptz | |

## report_outputs
Four AI-generated sections — each stores: `value text`, `source text`, `confidence numeric`, `review_status text`.
Sections: `executive_summary`, `key_variances_narrative`, `risk_narrative`, `recommended_actions`.
Plus `overall_review_status` (draft \| approved) and `approved_at timestamptz`.

## audit_logs
| Field | Type |
|-------|------|
| id | uuid PK |
| user_id | uuid nullable |
| actor_label | text |
| action | text |
| target_table | text |
| target_id | uuid |
| detail | jsonb |
| created_at | timestamptz |

## RLS
All tables have RLS enabled. v1: open read + write policies for demo. Lock-down sprint replaces with `auth.uid() = user_id`.
