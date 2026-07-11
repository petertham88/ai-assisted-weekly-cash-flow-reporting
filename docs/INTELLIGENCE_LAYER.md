# Intelligence Layer

## Messy Input
A Finance spreadsheet upload: irregular column names, mixed date formats, merged cells, partial actuals, sometimes missing subcategory labels.

## Auto-Structure Schema (applied at parse time)
```json
{
  "row_raw": "Acme Corp Collections, 180000, 152000",
  "mapped": {
    "description": "Customer Collections — Acme Corp",
    "category": "inflow",
    "subcategory": "accounts_receivable",
    "week_offset": 0,
    "forecast_amount": 180000,
    "actual_amount": 152000
  },
  "mapping_confidence": 0.91,
  "mapping_source": "column-header-match",
  "review_status": "unreviewed"
}
```

## Events That Trigger AI
| Event | Action |
|-------|--------|
| File upload complete | Parse → consolidate → run risk scoring |
| Risk scoring done | GPT-4o generates risk flag descriptions + recommended actions |
| Risk flags saved | GPT-4o generates 4-section management report narrative |
| User edits a section | Inline edit saved; AI badge shows "edited" |

## Rule-Based Risk Scoring (runs first, no AI required)
- Variance > ±10% on any line item → flag severity = medium
- Variance > ±20% → flag severity = high
- Any forecast_week closing_balance < $250,000 → low_balance_risk flag = high
- Payroll actual > forecast by any amount → payroll_overrun flag = medium

## What Gets Ranked
Risk flags sorted by: severity desc → ai_confidence desc → variance magnitude desc.

## v1 vs Later
- **v1:** Rule-based floor + GPT-4o narrative and confidence scores
- **Later:** Fine-tuned model on company-specific variance history; AI predicts customer payment timing
