-- Sprint 5 — Lock it down: replace v1 open RLS with per-user owner-scoped policies.
--
-- Ownership model:
--   * Real rows are owned by auth.uid() (the app stamps user_id on every insert).
--   * Seed/demo rows have user_id IS NULL and stay PUBLICLY READABLE but not
--     writable — this is the explicit "demo mode" exception (see /demo).
--
-- Effect:
--   SELECT : your own rows + demo(null) rows
--   INSERT : only rows you own (user_id = auth.uid())
--   UPDATE : only your own rows (demo rows are read-only to everyone)
--   DELETE : only your own rows
--
-- DoD (docs/TEST_PLAN.md): User B querying User A's rows with User B's JWT returns 0 rows.
--
-- NOTE: This is a HUMAN-APPLIED migration (docs/SECURITY.md: RLS changes must be
-- performed by an administrator). Run it in the Supabase SQL editor.

do $$
declare
  t text;
  tables text[] := array[
    'weekly_reports', 'cash_flow_items', 'forecast_weeks',
    'risk_flags', 'report_outputs', 'audit_logs'
  ];
begin
  foreach t in array tables loop
    -- Drop the v1 open policies.
    execute format('drop policy if exists %I on %I', t || '_v1_read', t);
    execute format('drop policy if exists %I on %I', t || '_v1_write', t);
    -- Drop owner policies if re-running.
    execute format('drop policy if exists %I on %I', t || '_owner_select', t);
    execute format('drop policy if exists %I on %I', t || '_owner_insert', t);
    execute format('drop policy if exists %I on %I', t || '_owner_update', t);
    execute format('drop policy if exists %I on %I', t || '_owner_delete', t);

    execute format($f$
      create policy %I on %I
      for select using (auth.uid() = user_id or user_id is null)
    $f$, t || '_owner_select', t);

    execute format($f$
      create policy %I on %I
      for insert with check (auth.uid() = user_id)
    $f$, t || '_owner_insert', t);

    execute format($f$
      create policy %I on %I
      for update using (auth.uid() = user_id) with check (auth.uid() = user_id)
    $f$, t || '_owner_update', t);

    execute format($f$
      create policy %I on %I
      for delete using (auth.uid() = user_id)
    $f$, t || '_owner_delete', t);
  end loop;
end $$;
