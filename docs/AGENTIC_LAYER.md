# Agentic Layer

## Risk Levels

### Low — Auto-executed (no approval needed)
- Parse uploaded file and map to cash_flow_items
- Compute 4-week forecast_weeks rows
- Run rule-based risk scoring and create risk_flags
- Draft report_output sections (all stored as `review_status = 'draft'`)

### Medium — Requires Finance Executive review before saving
- Update a forecast_week closing_balance based on AI recommendation
- Change risk_flag severity after AI re-scores

### High — Always requires explicit approval
- Mark report_output `overall_review_status = 'approved'` (triggers audit log)
- Dismiss a high-severity risk flag (requires reviewer_note)

### Critical — Human only, no agent action
- Delete a weekly_report or approved report_output
- Any action that sends data outside the system (email, export to third-party)

## Named Tools (approved list)
| Tool | Purpose |
|------|---------|
| `parse_upload_file` | Server-side CSV/Excel parse and column mapping |
| `compute_forecast_weeks` | Aggregate cash_flow_items into forecast_weeks rows |
| `run_risk_scoring` | Rule-based variance checks → risk_flags |
| `generate_risk_narratives` | GPT-4o: enrich risk_flags with descriptions and recommended actions |
| `generate_report_sections` | GPT-4o: draft 4-section management report |

No `run_any`, `exec_sql`, or `send_any` tools are permitted.

## Audit Log Fields (every meaningful action)
`action` · `target_table` · `target_id` · `actor_label` · `detail (jsonb)` · `created_at`

Examples: `risk_flag.dismissed`, `report_output.approved`, `cash_flow_item.edited`, `file.uploaded`.

## v1 vs Later
- **v1:** All five named tools above
- **Later:** `send_report_email`, `export_to_pdf_service` (both high risk, require approval)
