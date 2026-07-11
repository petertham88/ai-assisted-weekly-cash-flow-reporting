# Tasks & Sprints

## Sprint 1 — Database, schema, and demo seed data
**Goal:** Live database with all tables, open RLS, and realistic seed data renderable without login.
- [ ] Write and apply `migration_sql` to Supabase project
- [ ] Verify all 5 core tables exist with correct columns
- [ ] Confirm seed weekly_report, 10 cash_flow_items, 4 forecast_weeks, 3 risk_flags, 1 report_output load in Supabase dashboard
- [ ] Confirm open RLS policies allow anonymous select and insert

**Definition of Done:** Supabase table editor shows seeded rows; a raw `select *` on each table returns data with no auth header.

---

## Sprint 2 — Core engine: upload, parse, consolidate ✦ v1 functional milestone
**Goal:** A real file upload triggers real database writes; the 4-week forecast table renders from live data.
- [ ] `/upload` page: drag-and-drop CSV/Excel; calls `POST /api/upload`
- [ ] `parse_upload_file` tool: map columns to cash_flow_item fields; write rows to DB
- [ ] `compute_forecast_weeks` tool: aggregate items into forecast_weeks; upsert rows
- [ ] `/report/[id]` page: 4-week forecast table from DB (loading / empty / error / ready states)
- [ ] Variance column computed and displayed
- [ ] Seed demo rows editable and deletable from the UI
- [ ] Audit log entry written on file upload

**Definition of Done:** Upload a real CSV file → rows appear in `cash_flow_items` → forecast table updates → variance column shows correct values. No seed-data-only screen.

---

## Sprint 3 — AI risk flagging and variance panel
**Goal:** Risk flags generated (rule-based + AI) and reviewable in-app.
- [ ] `run_risk_scoring` tool: apply threshold rules; create risk_flag rows with `ai_source = 'rule-based'`
- [ ] `generate_risk_narratives` tool: GPT-4o enriches flags; update ai_value, ai_source, ai_confidence
- [ ] Risk Flags panel on `/report/[id]`: sorted by severity; shows description, recommended_action, confidence badge
- [ ] Finance Executive can set review_status to accepted / dismissed / needs_edit; reviewer_note required for dismissed high-severity flags
- [ ] AI failure fallback: rule-based flags display; AI badge shows "AI pending"
- [ ] Audit log entry on every flag status change

**Definition of Done:** Upload triggers flag creation; at least 1 flag appears without AI; GPT-4o enrichment adds narrative; user can accept/dismiss a flag and the status persists on refresh.

---

## Sprint 4 — Management report generation and approval
**Goal:** AI-drafted report is reviewable, editable, approvable, and print-ready.
- [ ] `generate_report_sections` tool: GPT-4o drafts 4 sections; saved to report_outputs with confidence and review_status
- [ ] Report Review screen: renders all 4 sections; each section has inline edit + confidence badge
- [ ] Edits save to DB immediately (no lost work on refresh)
- [ ] **Approve Report** button: sets overall_review_status = 'approved', writes approved_at, logs to audit_log
- [ ] Print/PDF view: clean CSS print stylesheet, no nav chrome
- [ ] All five states handled: loading, empty (no report yet), partial (some sections ready), error (AI failed — show rule-based summary), ready

**Definition of Done:** Full upload → flag → report flow works end-to-end. Approved report survives page refresh with status = 'approved'. Print view renders cleanly.

---

## Sprint 5 — Lock it down (auth + per-user RLS)
**Goal:** Real users log in; their data is isolated; demo seed remains in a separate demo account.
- [ ] Supabase Auth: email/password login and signup pages
- [ ] Populate user_id on all new rows
- [ ] Replace v1 open policies with `auth.uid() = user_id` RLS policies
- [ ] Unauthenticated visitors redirected to login (except explicit demo mode)
- [ ] Audit log actor_label populated from auth session
- [ ] Confirm no cross-user data leakage (test with two accounts)

**Definition of Done:** User A cannot read User B's weekly_reports. Confirmed by direct Supabase query with User B's JWT.

---

## Sprint 6 — History, comparison, and export
**Goal:** Prior reports browsable; CSV and PDF export working.
- [ ] Reports list page: all weekly_reports for the user, sorted by date desc
- [ ] Week-over-week variance comparison view (current vs prior week closing balances)
- [ ] Manual line-item entry form (add one-off items without uploading a file)
- [ ] CSV export of cash_flow_items for the selected report
- [ ] PDF export via browser print (already done in Sprint 4; confirm it works end-to-end)
- [ ] Final empty/error state audit across all pages

**Definition of Done:** All six pages (upload, forecast, risk flags, report, history, comparison) pass TEST_PLAN.md manual test steps.

---

## Gantt (sprint → feature)
```
Sprint 1: DB schema + seed
Sprint 2: Upload engine + forecast table          ← v1 functional milestone
Sprint 3: Risk flags + AI enrichment
Sprint 4: Report generation + approval + print
Sprint 5: Auth + RLS lock-down
Sprint 6: History + export + polish
```
