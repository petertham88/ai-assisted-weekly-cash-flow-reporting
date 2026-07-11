# Architecture

## Stack
- **Frontend:** Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Database:** Supabase (Postgres + RLS)
- **AI:** OpenAI GPT-4o via server-side API route (never exposed to browser)
- **Hosting:** Vercel
- **File parsing:** `xlsx` / `papaparse` libraries, server-side

## Now vs Later
| Now | Later |
|-----|-------|
| CSV/Excel file upload + parse | ERP API connectors |
| Rule-based + AI risk flagging | AI payment-behaviour prediction |
| 4-week forecast table | Multi-company consolidation |
| AI narrative generation | Email report delivery |
| In-app review and approval | Long-term planning module |
| Print/PDF report | Native PDF export service |

## Key User Action — Step by Step
1. Finance Executive opens the app (no login required in v1) and clicks **Upload Weekly Data**.
2. File is sent to a Next.js API route; server parses rows into typed cash flow items.
3. Items are written to `cash_flow_items`; `forecast_weeks` rows are computed and upserted.
4. A second API route runs rule-based variance checks, then calls GPT-4o to score and narrate risks; results saved to `risk_flags`.
5. A third API route calls GPT-4o to draft the four report sections; results saved to `report_outputs` with `review_status = 'draft'`.
6. UI renders the 4-week forecast table, Risk Flags panel, and Report draft — all from the database.
7. Finance Executive edits any section inline, then clicks **Approve Report**; `review_status` → `'approved'`, action logged to `audit_logs`.
8. Print view renders the approved report.

## Core Runs Without AI
Variance computation, cash shortage/surplus indicators, and risk thresholds are all calculated server-side in pure TypeScript. If the GPT-4o call fails, the report shows rule-based flags and a placeholder narrative — no blank screens.
