# Security

## Secret Handling
- `OPENAI_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` stored in Vercel environment variables only.
- All AI calls made from Next.js API routes (server-side). The browser never sees any key.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` is the only key exposed to the client — it is governed by RLS.

## Permission Model
- **v1 (demo):** Open RLS policies — all rows readable and writable without login. Suitable for internal demo only.
- **Lock-down sprint:** Replace open policies with `auth.uid() = user_id` owner-scoped policies. Anonymous access removed.
- Agent actions inherit the current session's Supabase client — no elevated service-role calls from the browser.

## Approved Tools Rule
Only the five named tools in `AGENTIC_LAYER.md` may be called by the agent. No raw SQL execution, no dynamic function invocation, no undeclared HTTP calls.

## Audit Principle
Every state-changing action (file upload, risk flag review, report approval, any edit) writes a row to `audit_logs` before returning success to the UI. If the audit write fails, the action is rolled back.

## Data in Transit
All traffic over HTTPS (Vercel + Supabase enforce this). No Finance data is logged to Vercel log drains or third-party analytics.

## Stop and Get a Human
Any change to RLS policies, service-role key rotation, or deletion of approved report data must be performed by a human administrator — never automated.
