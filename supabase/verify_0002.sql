-- Verification for 0002_auth_rls.sql — run in the Supabase SQL editor AFTER applying it.
-- 1) Confirm the open v1 policies are gone and owner policies exist.
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('weekly_reports','cash_flow_items','forecast_weeks','risk_flags','report_outputs','audit_logs')
order by tablename, cmd;

-- Expected: four *_owner_{select,insert,update,delete} policies per table,
-- and NO *_v1_read / *_v1_write policies remaining.

-- 2) Cross-user isolation smoke test (DoD). Replace the UUIDs with two real auth user ids.
-- Run each SET LOCAL in its own transaction via the REST API with each user's JWT, or use:
--   select set_config('request.jwt.claim.sub', '<USER_A_UUID>', true);
--   select count(*) from weekly_reports;                 -- only User A's + demo(null)
--   select set_config('request.jwt.claim.sub', '<USER_B_UUID>', true);
--   select count(*) from weekly_reports where user_id = '<USER_A_UUID>';  -- must be 0
