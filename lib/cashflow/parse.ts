import * as XLSX from "xlsx";
import type { CashCategory, Subcategory } from "@/lib/db/types";

export interface ParsedItem {
  description: string;
  category: CashCategory;
  subcategory: Subcategory;
  week_offset: number;
  forecast_amount: number;
  actual_amount: number | null;
  currency: string;
  mapping_confidence: number;
  mapping_source: string;
}

export interface ParseResult {
  items: ParsedItem[];
  rowsSeen: number;
  warnings: string[];
}

const SUBCATS: Subcategory[] = [
  "accounts_receivable",
  "accounts_payable",
  "payroll",
  "loan_repayment",
  "tax",
  "other",
];

// Which flow direction a subcategory defaults to when category is missing.
const SUBCAT_DIRECTION: Record<Subcategory, CashCategory> = {
  accounts_receivable: "inflow",
  accounts_payable: "outflow",
  payroll: "outflow",
  loan_repayment: "outflow",
  tax: "outflow",
  other: "inflow",
};

// Header synonyms → canonical field. Matched case-insensitively as substrings.
const HEADER_MAP: { field: string; patterns: string[] }[] = [
  { field: "description", patterns: ["description", "item", "line", "detail", "narrative", "particular", "name"] },
  { field: "category", patterns: ["category", "direction", "flow", "type", "in/out", "inout"] },
  { field: "subcategory", patterns: ["subcategory", "sub category", "sub-category", "account", "gl", "bucket", "class"] },
  { field: "week_offset", patterns: ["week_offset", "week offset", "offset", "wk", "week"] },
  { field: "forecast_amount", patterns: ["forecast", "budget", "plan", "expected", "projected", "estimate"] },
  { field: "actual_amount", patterns: ["actual", "real", "received", "paid", "reported"] },
  { field: "currency", patterns: ["currency", "ccy", "curr"] },
];

function normalizeHeader(raw: string): string | null {
  const h = raw.toLowerCase().trim();
  if (!h) return null;
  // exact/priority pass for the two amount columns so "forecast" doesn't swallow "week"
  for (const { field, patterns } of HEADER_MAP) {
    for (const p of patterns) {
      if (h === p) return field;
    }
  }
  for (const { field, patterns } of HEADER_MAP) {
    for (const p of patterns) {
      if (h.includes(p)) return field;
    }
  }
  return null;
}

function parseNumber(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return isNaN(v) ? null : v;
  let s = String(v).trim();
  if (!s) return null;
  const negative = /^\(.*\)$/.test(s) || s.startsWith("-");
  s = s.replace(/[()$£€,\s]/g, "").replace(/-/g, "");
  const n = parseFloat(s);
  if (isNaN(n)) return null;
  return negative ? -Math.abs(n) : n;
}

function normalizeCategory(raw: unknown): CashCategory | null {
  if (raw == null) return null;
  const s = String(raw).toLowerCase().trim();
  if (!s) return null;
  if (["inflow", "in", "income", "receipt", "credit", "receivable", "revenue"].some((k) => s.includes(k)))
    return "inflow";
  if (["outflow", "out", "expense", "payment", "debit", "payable", "cost"].some((k) => s.includes(k)))
    return "outflow";
  return null;
}

function normalizeSubcategory(raw: unknown): Subcategory | null {
  if (raw == null) return null;
  const s = String(raw).toLowerCase().trim().replace(/[\s-]+/g, "_");
  if (!s) return null;
  const direct = SUBCATS.find((c) => c === s);
  if (direct) return direct;
  if (s.includes("receiv") || s.includes("ar") || s.includes("collection") || s.includes("customer")) return "accounts_receivable";
  if (s.includes("payab") || s.includes("ap") || s.includes("supplier") || s.includes("vendor")) return "accounts_payable";
  if (s.includes("payroll") || s.includes("salar") || s.includes("wage") || s.includes("staff")) return "payroll";
  if (s.includes("loan") || s.includes("debt") || s.includes("repay") || s.includes("interest")) return "loan_repayment";
  if (s.includes("tax") || s.includes("gst") || s.includes("vat") || s.includes("duty")) return "tax";
  return null;
}

function toRows(file: Buffer, filename: string): Record<string, unknown>[] {
  const wb = XLSX.read(file, { type: "buffer", cellDates: false, raw: false });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return [];
  // Read as array-of-arrays first so we can find the real header row.
  const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false, defval: "" });
  if (grid.length === 0) return [];

  // Find the header row: the row with the most cells that map to a known field.
  let headerRowIdx = 0;
  let bestScore = -1;
  for (let i = 0; i < Math.min(grid.length, 10); i++) {
    const score = grid[i].filter((c) => normalizeHeader(String(c ?? ""))).length;
    if (score > bestScore) {
      bestScore = score;
      headerRowIdx = i;
    }
  }
  const headerCells = grid[headerRowIdx].map((c) => String(c ?? ""));
  const rows: Record<string, unknown>[] = [];
  for (let i = headerRowIdx + 1; i < grid.length; i++) {
    const row: Record<string, unknown> = {};
    let hasValue = false;
    grid[i].forEach((cell, ci) => {
      const key = headerCells[ci] ?? `col_${ci}`;
      row[key] = cell;
      if (cell !== "" && cell != null) hasValue = true;
    });
    if (hasValue) rows.push(row);
  }
  return rows;
}

/**
 * parse_upload_file tool — server-side CSV/Excel parse and column mapping.
 * Maps irregular finance-sheet columns onto typed cash flow items.
 */
export function parseUploadFile(file: Buffer, filename: string): ParseResult {
  const rows = toRows(file, filename);
  const warnings: string[] = [];
  const items: ParsedItem[] = [];

  // Build a header → field map from the first row's keys.
  const sampleKeys = rows.length ? Object.keys(rows[0]) : [];
  const fieldToKey: Record<string, string> = {};
  for (const key of sampleKeys) {
    const field = normalizeHeader(key);
    if (field && !fieldToKey[field]) fieldToKey[field] = key;
  }

  for (const row of rows) {
    const get = (field: string) => (fieldToKey[field] ? row[fieldToKey[field]] : undefined);

    const description = String(get("description") ?? "").trim();
    const forecast = parseNumber(get("forecast_amount"));
    const actual = parseNumber(get("actual_amount"));

    // Skip rows with neither a description nor any amount.
    if (!description && forecast == null && actual == null) continue;

    let subcategory = normalizeSubcategory(get("subcategory"));
    if (!subcategory) subcategory = normalizeSubcategory(description) ?? "other";

    let category = normalizeCategory(get("category"));
    let source = "column-header-match";
    let confidence = 0.9;
    if (!category) {
      category = SUBCAT_DIRECTION[subcategory];
      source = "inferred-from-subcategory";
      confidence = 0.7;
    }

    let weekOffset = parseNumber(get("week_offset"));
    if (weekOffset == null || weekOffset < 0) weekOffset = 0;
    weekOffset = Math.min(3, Math.round(Math.abs(weekOffset)));

    const forecastAmount = forecast != null ? Math.abs(forecast) : actual != null ? Math.abs(actual) : 0;
    const actualAmount = actual != null ? Math.abs(actual) : null;
    const currency = String(get("currency") ?? "USD").trim().toUpperCase().slice(0, 6) || "USD";

    items.push({
      description: description || `${subcategory} (${category})`,
      category,
      subcategory,
      week_offset: weekOffset,
      forecast_amount: forecastAmount,
      actual_amount: actualAmount,
      currency,
      mapping_confidence: confidence,
      mapping_source: source,
    });
  }

  if (rows.length > 0 && items.length === 0) {
    warnings.push("no_parseable_rows");
  }

  return { items, rowsSeen: rows.length, warnings };
}
