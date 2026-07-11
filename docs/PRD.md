# Product Requirements — AI-Assisted Weekly Cash Flow Reporting

## Problem
Finance teams spend several hours each week manually consolidating cash flow data from multiple sources, updating spreadsheet forecasts, and writing management reports. The process is slow, error-prone, and produces inconsistent output.

## Target Users
Finance Executives, Finance Managers, Financial Controllers, Accountants, and CFOs who own the weekly cash flow reporting cycle.

## Core Objects
- **Weekly Report** — one per reporting week; tracks status (draft → approved)
- **Cash Flow Item** — one line per inflow/outflow (category, forecast, actual, variance)
- **Forecast Week** — 4-week rolling summary (opening balance, inflows, outflows, closing balance vs forecast)
- **Risk Flag** — AI-identified risk or variance item, with severity and recommended action
- **Report Output** — AI-drafted management narrative (executive summary, variances, risks, recommendations)
- **Audit Log** — every review, edit, and approval action

## MVP Must-Haves
- [ ] Upload a weekly Finance data file (CSV/Excel); auto-parse into cash flow line items
- [ ] Auto-consolidate AR, AP, payroll, loans, tax, and other categories by week
- [ ] Display a 4-week rolling forecast table with actuals, forecast, and variance columns
- [ ] AI flags high-risk items and material variances (rule-based floor ensures flags exist even if AI is unavailable)
- [ ] AI generates a management report narrative (executive summary, key variances, risks, recommended actions)
- [ ] Finance Executive reviews, edits, and approves the report in-app
- [ ] Approved report is print/PDF-ready
- [ ] All states handled: loading, empty, error, ready

## Non-Goals (v1)
ERP integration, bank API connections, AI payment-behaviour prediction, multi-company consolidation, email delivery, mobile app, long-term budgeting.

## Success Criterion
A Finance Executive uploads the week's data file, the system consolidates it, surfaces 3 flagged risks, and produces a complete management report narrative — all reviewed and approved in under 30 minutes, with no manual spreadsheet work required.
