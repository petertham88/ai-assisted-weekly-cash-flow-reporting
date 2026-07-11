create table if not exists weekly_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  report_date date not null,
  week_label text not null,
  status text not null default 'draft',
  created_at timestamptz not null default now()
);
alter table weekly_reports enable row level security;
drop policy if exists "weekly_reports_v1_read" on weekly_reports;
create policy "weekly_reports_v1_read" on weekly_reports for select using (true);
drop policy if exists "weekly_reports_v1_write" on weekly_reports;
create policy "weekly_reports_v1_write" on weekly_reports for all using (true) with check (true);

create table if not exists cash_flow_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  weekly_report_id uuid references weekly_reports(id) on delete cascade,
  category text not null,
  subcategory text,
  description text not null,
  week_offset integer not null default 0,
  forecast_amount numeric not null default 0,
  actual_amount numeric,
  variance numeric generated always as (coalesce(actual_amount, 0) - forecast_amount) stored,
  currency text not null default 'USD',
  source_file text,
  created_at timestamptz not null default now()
);
alter table cash_flow_items enable row level security;
drop policy if exists "cash_flow_items_v1_read" on cash_flow_items;
create policy "cash_flow_items_v1_read" on cash_flow_items for select using (true);
drop policy if exists "cash_flow_items_v1_write" on cash_flow_items;
create policy "cash_flow_items_v1_write" on cash_flow_items for all using (true) with check (true);

create table if not exists forecast_weeks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  weekly_report_id uuid references weekly_reports(id) on delete cascade,
  week_offset integer not null,
  week_label text not null,
  opening_balance numeric not null default 0,
  total_inflows numeric not null default 0,
  total_outflows numeric not null default 0,
  closing_balance numeric not null default 0,
  forecast_closing_balance numeric not null default 0,
  variance numeric generated always as (closing_balance - forecast_closing_balance) stored,
  created_at timestamptz not null default now()
);
alter table forecast_weeks enable row level security;
drop policy if exists "forecast_weeks_v1_read" on forecast_weeks;
create policy "forecast_weeks_v1_read" on forecast_weeks for select using (true);
drop policy if exists "forecast_weeks_v1_write" on forecast_weeks;
create policy "forecast_weeks_v1_write" on forecast_weeks for all using (true) with check (true);

create table if not exists risk_flags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  weekly_report_id uuid references weekly_reports(id) on delete cascade,
  cash_flow_item_id uuid references cash_flow_items(id) on delete set null,
  flag_type text not null,
  description text not null,
  recommended_action text,
  severity text not null default 'medium',
  review_status text not null default 'unreviewed',
  ai_value text,
  ai_source text,
  ai_confidence numeric,
  reviewer_note text,
  created_at timestamptz not null default now()
);
alter table risk_flags enable row level security;
drop policy if exists "risk_flags_v1_read" on risk_flags;
create policy "risk_flags_v1_read" on risk_flags for select using (true);
drop policy if exists "risk_flags_v1_write" on risk_flags;
create policy "risk_flags_v1_write" on risk_flags for all using (true) with check (true);

create table if not exists report_outputs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  weekly_report_id uuid references weekly_reports(id) on delete cascade,
  executive_summary text,
  executive_summary_source text,
  executive_summary_confidence numeric,
  executive_summary_review_status text not null default 'unreviewed',
  key_variances_narrative text,
  key_variances_narrative_source text,
  key_variances_narrative_confidence numeric,
  key_variances_narrative_review_status text not null default 'unreviewed',
  risk_narrative text,
  risk_narrative_source text,
  risk_narrative_confidence numeric,
  risk_narrative_review_status text not null default 'unreviewed',
  recommended_actions text,
  recommended_actions_source text,
  recommended_actions_confidence numeric,
  recommended_actions_review_status text not null default 'unreviewed',
  overall_review_status text not null default 'draft',
  approved_at timestamptz,
  created_at timestamptz not null default now()
);
alter table report_outputs enable row level security;
drop policy if exists "report_outputs_v1_read" on report_outputs;
create policy "report_outputs_v1_read" on report_outputs for select using (true);
drop policy if exists "report_outputs_v1_write" on report_outputs;
create policy "report_outputs_v1_write" on report_outputs for all using (true) with check (true);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  actor_label text,
  action text not null,
  target_table text,
  target_id uuid,
  detail jsonb,
  created_at timestamptz not null default now()
);
alter table audit_logs enable row level security;
drop policy if exists "audit_logs_v1_read" on audit_logs;
create policy "audit_logs_v1_read" on audit_logs for select using (true);
drop policy if exists "audit_logs_v1_write" on audit_logs;
create policy "audit_logs_v1_write" on audit_logs for all using (true) with check (true);

insert into weekly_reports (id, report_date, week_label, status) values
  ('a1000000-0000-0000-0000-000000000001', '2025-07-14', 'Week of 14 Jul 2025', 'approved'),
  ('a1000000-0000-0000-0000-000000000002', '2025-07-07', 'Week of 7 Jul 2025', 'approved'),
  ('a1000000-0000-0000-0000-000000000003', '2025-06-30', 'Week of 30 Jun 2025', 'approved')
on conflict (id) do nothing;

insert into cash_flow_items (id, weekly_report_id, category, subcategory, description, week_offset, forecast_amount, actual_amount, currency) values
  ('b1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'inflow', 'accounts_receivable', 'Customer Collections — Acme Corp', 0, 180000, 152000, 'USD'),
  ('b1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', 'inflow', 'accounts_receivable', 'Customer Collections — Globex Ltd', 0, 95000, 98500, 'USD'),
  ('b1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000001', 'inflow', 'other', 'Rental Income — Warehouse Unit 3', 0, 12000, 12000, 'USD'),
  ('b1000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000001', 'outflow', 'accounts_payable', 'Supplier Payment — Horizon Supplies', 0, 64000, 64000, 'USD'),
  ('b1000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000001', 'outflow', 'payroll', 'Weekly Payroll Run', 0, 210000, 213500, 'USD'),
  ('b1000000-0000-0000-0000-000000000006', 'a1000000-0000-0000-0000-000000000001', 'outflow', 'loan_repayment', 'Term Loan — ANZ Bank', 0, 45000, 45000, 'USD'),
  ('b1000000-0000-0000-0000-000000000007', 'a1000000-0000-0000-0000-000000000001', 'outflow', 'tax', 'GST Quarterly Instalment', 0, 38000, 38000, 'USD'),
  ('b1000000-0000-0000-0000-000000000008', 'a1000000-0000-0000-0000-000000000001', 'inflow', 'accounts_receivable', 'Customer Collections — Acme Corp', 1, 160000, null, 'USD'),
  ('b1000000-0000-0000-0000-000000000009', 'a1000000-0000-0000-0000-000000000001', 'outflow', 'accounts_payable', 'Supplier Payment — FastFreight Co', 1, 29000, null, 'USD'),
  ('b1000000-0000-0000-0000-000000000010', 'a1000000-0000-0000-0000-000000000001', 'outflow', 'payroll', 'Weekly Payroll Run', 1, 210000, null, 'USD')
on conflict (id) do nothing;

insert into forecast_weeks (id, weekly_report_id, week_offset, week_label, opening_balance, total_inflows, total_outflows, closing_balance, forecast_closing_balance) values
  ('c1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 0, 'Wk 1 (14 Jul)', 520000, 262500, 360500, 422000, 450000),
  ('c1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', 1, 'Wk 2 (21 Jul)', 422000, 195000, 310000, 307000, 340000),
  ('c1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000001', 2, 'Wk 3 (28 Jul)', 307000, 220000, 295000, 232000, 260000),
  ('c1000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000001', 3, 'Wk 4 (4 Aug)', 232000, 310000, 280000, 262000, 275000)
on conflict (id) do nothing;

insert into risk_flags (id, weekly_report_id, cash_flow_item_id, flag_type, description, recommended_action, severity, review_status, ai_value, ai_source, ai_confidence) values
  ('d1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 'collection_shortfall', 'Acme Corp collections $28,000 below forecast (–15.6%). Payment may be delayed.', 'Contact Acme Corp AR team to confirm payment ETA. Consider adjusting Wk 2 forecast downward by $20,000.', 'high', 'unreviewed', 'Acme Corp collection variance –15.6% exceeds risk threshold; possible 7-day payment delay based on historical pattern.', 'gpt-4o', 0.82),
  ('d1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000005', 'payroll_overrun', 'Payroll $3,500 over forecast. Review headcount changes or overtime.', 'Obtain payroll breakdown from HR. Confirm whether overrun is one-off or recurring.', 'medium', 'unreviewed', 'Payroll actual $213,500 vs forecast $210,000 (+1.7%). Possible overtime or new starter cost.', 'gpt-4o', 0.76),
  ('d1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000001', null, 'low_balance_risk', 'Wk 3 projected closing balance $232,000 is within 10% of minimum operating threshold ($210,000).', 'Monitor AR collections closely in Wk 2. Arrange standby facility draw-down if Acme Corp payment does not clear.', 'high', 'unreviewed', 'Wk 3 closing balance projects within warning band. If Acme shortfall persists, balance may breach $210,000 floor.', 'gpt-4o', 0.88)
on conflict (id) do nothing;

insert into report_outputs (id, weekly_report_id, executive_summary, executive_summary_source, executive_summary_confidence, executive_summary_review_status, key_variances_narrative, key_variances_narrative_source, key_variances_narrative_confidence, key_variances_narrative_review_status, risk_narrative, risk_narrative_source, risk_narrative_confidence, risk_narrative_review_status, recommended_actions, recommended_actions_source, recommended_actions_confidence, recommended_actions_review_status, overall_review_status) values
  ('e1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001',
   'For the week ending 14 July 2025, the company''s opening bank balance was $520,000. Net cash outflows of $98,000 resulted in a closing balance of $422,000, which is $28,000 below the forecast of $450,000. The primary driver of the shortfall is a delayed collection from Acme Corp. The 4-week forward position remains adequate but requires close monitoring in Weeks 3–4.',
   'gpt-4o', 0.85, 'unreviewed',
   'AR collections came in $28,000 (–15.6%) below forecast, driven entirely by the Acme Corp account. All other inflows matched forecast within 3%. Payroll exceeded forecast by $3,500 (+1.7%); all other outflows were on plan.',
   'gpt-4o', 0.83, 'unreviewed',
   'Two high-severity risks are active: (1) Acme Corp collection shortfall threatens Week 3 balance approaching the $210,000 operating floor. (2) If the shortfall rolls into Week 2, the Week 3 closing balance may breach minimum liquidity. Payroll overrun is flagged medium-severity pending HR confirmation.',
   'gpt-4o', 0.87, 'unreviewed',
   '1. Finance to contact Acme Corp immediately to confirm payment date. 2. Revise Week 2 AR forecast downward by $20,000 pending confirmation. 3. Put standby credit facility on alert for potential Week 3 draw-down. 4. HR to provide payroll variance breakdown by end of day.',
   'gpt-4o', 0.80, 'unreviewed',
   'draft')
on conflict (id) do nothing;