# Test Plan

## Success Scenario — End-to-End
1. Open the app homepage. Confirm the 4-week forecast table renders with demo data (no login prompt).
2. Click **Upload Weekly Data**. Upload `demo_cashflow.csv` (a file with 10+ rows across AR, AP, payroll, loan, tax categories).
3. Confirm upload progress indicator appears (loading state).
4. After upload, confirm `cash_flow_items` rows appear in Supabase — count matches uploaded rows.
5. Confirm 4-week forecast table updates: opening balance, inflows, outflows, closing balance, variance all populated.
6. Confirm at least 1 risk flag appears in the Risk Flags panel without AI (rule-based).
7. Wait for AI enrichment. Confirm risk flag gains a narrative description and confidence badge.
8. Confirm flags are sortable/filterable by severity.
9. Set one flag to **dismissed** — confirm reviewer_note is required for high-severity flags.
10. Confirm audit_log has a row for the flag status change.
11. Click **Generate Report**. Confirm loading state. Confirm all 4 report sections appear.
12. Edit one section inline. Refresh the page. Confirm the edit persisted.
13. Click **Approve Report**. Confirm `overall_review_status = 'approved'` in DB. Confirm `approved_at` is set.
14. Open print view. Confirm no navigation chrome; report renders cleanly.

## Empty State Tests
- Load `/report/new` with no data — confirm empty state message: "No cash flow data yet. Upload a file to get started."
- Upload a file with no parseable rows — confirm error message: "We couldn't read any cash flow items from this file. Check the column headers and try again."

## Error State Tests
- Upload a non-CSV/non-Excel file — confirm validation error before any DB write.
- Simulate GPT-4o timeout (set a 1-second timeout in dev) — confirm rule-based flags still appear; AI badge shows "AI pending".
- Simulate DB write failure — confirm error toast; no partial data saved; audit log not written.

## Permission Tests (Sprint 5+)
- Log in as User A, create a weekly_report.
- Log in as User B, attempt direct Supabase query for User A's report — confirm 0 rows returned.
- Confirm unauthenticated browser cannot read any row after lock-down policies are applied.

## Regression Checks
- Every button on every screen triggers a real DB action (no dead buttons).
- Page refresh on any screen reflects DB state exactly.
- No Supabase keys or OpenAI keys appear in browser network tab responses.
