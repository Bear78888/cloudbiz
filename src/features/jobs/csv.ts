/**
 * One-time CSV import (§14.15) — pure: parsing, column mapping, row
 * validation and duplicate detection, with no I/O and no framework.
 *
 * The people importing here are moving off a spreadsheet they have kept for
 * years, so the rules are forgiving by design: any of the three common
 * delimiters, headers in English or Spanish, statuses written as labels
 * rather than codes, money with currency signs, dates in the shapes a US
 * spreadsheet produces. What cannot be understood is reported per row and
 * per field — never silently coerced.
 */

import {
  JOB_PRIORITIES,
  JOB_STATUSES,
  LEAD_SOURCES,
  PAYMENT_STATUSES,
  customerMatchKey,
  type JobStatus,
} from "./model";
import { parseJobForm, type FieldErrorCode, type JobFormInput } from "./schema";

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

export interface ParsedCsv {
  headers: string[];
  rows: string[][];
  delimiter: string;
}

export const MAX_IMPORT_ROWS = 1000;
export const MAX_IMPORT_BYTES = 2 * 1024 * 1024;

const DELIMITERS = [",", ";", "\t"] as const;

/** The delimiter that yields the most columns on the header line wins. */
function detectDelimiter(text: string): string {
  const firstLine = text.slice(0, text.indexOf("\n") === -1 ? text.length : text.indexOf("\n"));
  let best = ",";
  let bestCount = 0;
  for (const candidate of DELIMITERS) {
    const count = splitLine(firstLine, candidate).length;
    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  }
  return best;
}

function splitLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (quoted) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === delimiter) {
      cells.push(cell);
      cell = "";
    } else {
      cell += char;
    }
  }
  cells.push(cell);
  return cells;
}

/**
 * RFC 4180-shaped parser: quoted fields may contain the delimiter, newlines
 * and doubled quotes. Excel's UTF-8 BOM is stripped, and both CRLF and LF
 * line endings work.
 */
export function parseCsv(text: string): ParsedCsv {
  const clean = text.replace(/^﻿/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const delimiter = detectDelimiter(clean);

  // Split into logical lines, honouring newlines inside quoted fields.
  const lines: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < clean.length; i += 1) {
    const char = clean[i];
    if (char === '"') {
      quoted = clean[i + 1] === '"' && quoted ? quoted : !quoted;
      if (clean[i + 1] === '"' && quoted) {
        current += '""';
        i += 1;
        continue;
      }
      current += char;
      continue;
    }
    if (char === "\n" && !quoted) {
      lines.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  if (current.trim() !== "") lines.push(current);

  const nonEmpty = lines.filter((line) => line.trim() !== "");
  if (nonEmpty.length === 0) return { headers: [], rows: [], delimiter };

  const headers = splitLine(nonEmpty[0], delimiter).map((h) => h.trim());
  const rows = nonEmpty
    .slice(1, MAX_IMPORT_ROWS + 1)
    .map((line) => {
      const cells = splitLine(line, delimiter).map((c) => c.trim());
      // Pad short rows so column indexes always line up with the header.
      while (cells.length < headers.length) cells.push("");
      return cells;
    })
    .filter((cells) => cells.some((cell) => cell !== ""));

  return { headers, rows, delimiter };
}

// ---------------------------------------------------------------------------
// Column mapping
// ---------------------------------------------------------------------------

export const IMPORT_FIELDS = [
  "customer_name",
  "customer_phone",
  "customer_email",
  "customer_locale",
  "title",
  "service",
  "description",
  "source",
  "status",
  "priority",
  "address",
  "scheduled_start",
  "estimate_amount",
  "job_total",
  "materials_cost",
  "payment_status",
  "notes",
] as const;

export type ImportField = (typeof IMPORT_FIELDS)[number];

/** Column index → field, or "" for "don't import this column". */
export type ColumnMapping = Record<number, ImportField | "">;

/**
 * Header aliases, English and Spanish, matching the tab layout of §14.7 and
 * the wording a handyman's own spreadsheet is likely to use.
 */
const HEADER_ALIASES: Record<ImportField, string[]> = {
  customer_name: ["customer", "customer name", "client", "name", "cliente", "nombre"],
  customer_phone: ["phone", "phone number", "mobile", "cell", "telefono", "teléfono", "celular"],
  customer_email: ["email", "e-mail", "email address", "correo", "correo electronico"],
  customer_locale: ["language", "preferred language", "idioma", "idioma preferido"],
  title: ["job", "job title", "work", "trabajo", "titulo", "título"],
  service: ["service", "service type", "type", "servicio", "tipo de servicio"],
  description: ["description", "job description", "details", "descripcion", "descripción"],
  source: ["source", "lead source", "fuente", "origen"],
  status: ["status", "estado"],
  priority: ["priority", "prioridad"],
  address: ["address", "job address", "location", "direccion", "dirección"],
  scheduled_start: [
    "scheduled",
    "scheduled date",
    "date",
    "appointment",
    "fecha",
    "fecha programada",
  ],
  estimate_amount: ["estimate", "estimate amount", "quote", "presupuesto"],
  job_total: ["total", "job total", "amount", "price", "total del trabajo"],
  materials_cost: ["materials", "materials cost", "materiales", "costo de materiales"],
  payment_status: ["payment", "payment status", "paid", "pago", "estado de pago"],
  notes: ["notes", "note", "comments", "notas", "comentarios"],
};

function normalizeHeader(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .replace(/[_\-/]+/g, " ")
    .replace(/\s+/g, " ");
}

/** Best-guess mapping so the common case needs no manual work at all. */
export function detectMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const taken = new Set<ImportField>();

  headers.forEach((header, index) => {
    const normalized = normalizeHeader(header);
    mapping[index] = "";
    if (normalized === "") return;

    for (const field of IMPORT_FIELDS) {
      if (taken.has(field)) continue;
      if (HEADER_ALIASES[field].includes(normalized)) {
        mapping[index] = field;
        taken.add(field);
        return;
      }
    }
  });

  return mapping;
}

// ---------------------------------------------------------------------------
// Value coercion
// ---------------------------------------------------------------------------

/** `New Lead`, `new-lead`, `NEW_LEAD` all normalize to the stable code. */
function codify(raw: string): string {
  return raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

const SPANISH_ALIASES: Record<string, string> = {
  // statuses
  nuevo_contacto: "new_lead",
  contactado: "contacted",
  presupuesto_en_borrador: "estimate_draft",
  presupuesto_enviado: "estimate_sent",
  presupuesto_aceptado: "estimate_accepted",
  programado: "scheduled",
  en_proceso: "in_progress",
  completado: "completed",
  pagado: "paid",
  perdido: "lost",
  cancelado: "canceled",
  // priorities
  urgente: "urgent",
  // payment
  sin_pagar: "unpaid",
  pago_parcial: "partial",
  reembolsado: "refunded",
  // lead sources
  llamada: "phone_call",
  sitio_web: "website",
  recomendacion: "referral",
  recomendación: "referral",
  otro: "other",
};

function coerceRegistry(raw: string, registry: readonly string[]): string | null {
  const code = codify(raw);
  if (registry.includes(code)) return code;
  const aliased = SPANISH_ALIASES[code];
  if (aliased && registry.includes(aliased)) return aliased;
  return null;
}

function coerceLocale(raw: string): string | null {
  const code = codify(raw);
  if (["en", "english", "ingles", "inglés"].includes(code)) return "en";
  if (["es", "spanish", "espanol", "español"].includes(code)) return "es";
  return null;
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2})(?::\d{2})?)?/;
const US_DATE = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:[ ,]+(\d{1,2}):(\d{2}))?\s*(am|pm)?/i;

/**
 * Normalizes the date shapes a US spreadsheet produces into the
 * `datetime-local` string the rest of the code already understands.
 * Slash dates are read as month/day — this is a US-market product (§4).
 */
export function normalizeCsvDateTime(raw: string): string | null {
  const value = raw.trim();
  if (value === "") return null;

  const iso = ISO_DATE.exec(value);
  if (iso) {
    const [, y, m, d, hh = "00", mm = "00"] = iso;
    return `${y}-${m}-${d}T${hh.padStart(2, "0")}:${mm}`;
  }

  const us = US_DATE.exec(value);
  if (us) {
    const [, m, d, rawYear, rawHour, mm = "00", meridiem] = us;
    const year = rawYear.length === 2 ? `20${rawYear}` : rawYear;
    let hour = Number(rawHour ?? "0");
    if (meridiem) {
      const lower = meridiem.toLowerCase();
      if (lower === "pm" && hour < 12) hour += 12;
      if (lower === "am" && hour === 12) hour = 0;
    }
    if (Number(m) < 1 || Number(m) > 12 || Number(d) < 1 || Number(d) > 31) return null;
    return `${year}-${m.padStart(2, "0")}-${d.padStart(2, "0")}T${String(hour).padStart(2, "0")}:${mm}`;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Row building
// ---------------------------------------------------------------------------

export type ImportRowErrors = Partial<Record<ImportField, FieldErrorCode>>;

export interface ImportRow {
  /** 1-based position in the file, so the message can name the row. */
  line: number;
  raw: Partial<Record<ImportField, string>>;
  /** Present only when the row is valid. */
  value: JobFormInput | null;
  errors: ImportRowErrors;
  /** Customer identity (§14.15 step 4); null when the row names nobody. */
  matchKey: string | null;
  /** Line number of the earlier row this one duplicates, if any. */
  duplicateOfLine: number | null;
  /** True once the caller marks it against customers already in the tracker. */
  duplicateOfExisting: boolean;
}

export interface BuildResult {
  rows: ImportRow[];
  validCount: number;
  errorCount: number;
  duplicateCount: number;
}

/**
 * Maps, coerces and validates every row. Validation runs through the same
 * `parseJobForm` the UI form uses, so the import cannot accept anything the
 * form would reject.
 */
export function buildImportRows(
  csvRows: string[][],
  mapping: ColumnMapping,
  timeZone: string,
): BuildResult {
  const seen = new Map<string, number>();
  const rows: ImportRow[] = [];

  csvRows.forEach((cells, index) => {
    const line = index + 1;
    const raw: Partial<Record<ImportField, string>> = {};
    for (const [columnIndex, field] of Object.entries(mapping)) {
      if (!field) continue;
      const cell = cells[Number(columnIndex)] ?? "";
      if (cell.trim() !== "") raw[field] = cell.trim();
    }

    const errors: ImportRowErrors = {};

    // Registry columns arrive as human labels far more often than as codes.
    const coerced: Record<string, string | undefined> = { ...raw };
    const registries: [ImportField, readonly string[]][] = [
      ["status", JOB_STATUSES],
      ["priority", JOB_PRIORITIES],
      ["payment_status", PAYMENT_STATUSES],
      ["source", LEAD_SOURCES],
    ];
    for (const [field, registry] of registries) {
      const value = raw[field];
      if (value === undefined) continue;
      const code = coerceRegistry(value, registry);
      if (code === null) errors[field] = "invalid_choice";
      else coerced[field] = code;
    }

    if (raw.customer_locale !== undefined) {
      const locale = coerceLocale(raw.customer_locale);
      if (locale === null) errors.customer_locale = "invalid_choice";
      else coerced.customer_locale = locale;
    }

    if (raw.scheduled_start !== undefined) {
      const normalized = normalizeCsvDateTime(raw.scheduled_start);
      if (normalized === null) errors.scheduled_start = "invalid_date";
      else coerced.scheduled_start = normalized;
    }

    // A spreadsheet row usually names the job in a column the tracker calls
    // "service"; falling back keeps a whole file from failing on a title.
    if (!coerced.title && coerced.service) coerced.title = coerced.service;

    const parsed = parseJobForm(coerced, timeZone);
    if (!parsed.ok) {
      for (const [field, code] of Object.entries(parsed.errors)) {
        if ((IMPORT_FIELDS as readonly string[]).includes(field)) {
          errors[field as ImportField] = code;
        }
      }
    }

    const matchKey = customerMatchKey({
      phone: raw.customer_phone ?? null,
      email: raw.customer_email ?? null,
      name: raw.customer_name ?? null,
    });

    let duplicateOfLine: number | null = null;
    if (matchKey) {
      const firstSeen = seen.get(matchKey);
      if (firstSeen !== undefined) duplicateOfLine = firstSeen;
      else seen.set(matchKey, line);
    }

    rows.push({
      line,
      raw,
      value: parsed.ok && Object.keys(errors).length === 0 ? parsed.value : null,
      errors,
      matchKey,
      duplicateOfLine,
      duplicateOfExisting: false,
    });
  });

  return summarize(rows);
}

/** Flags rows whose customer is already in the tracker (§14.15 step 4). */
export function markExistingDuplicates(
  rows: ImportRow[],
  existingKeys: readonly string[],
): BuildResult {
  const existing = new Set(existingKeys);
  return summarize(
    rows.map((row) => ({
      ...row,
      duplicateOfExisting: row.matchKey !== null && existing.has(row.matchKey),
    })),
  );
}

function summarize(rows: ImportRow[]): BuildResult {
  return {
    rows,
    validCount: rows.filter((r) => r.value !== null).length,
    errorCount: rows.filter((r) => Object.keys(r.errors).length > 0).length,
    duplicateCount: rows.filter((r) => r.duplicateOfLine !== null || r.duplicateOfExisting).length,
  };
}

export function isDuplicate(row: ImportRow): boolean {
  return row.duplicateOfLine !== null || row.duplicateOfExisting;
}

/** The rows an import actually writes, given the owner's duplicate choice. */
export function selectRowsToImport(rows: ImportRow[], skipDuplicates: boolean): ImportRow[] {
  return rows.filter((row) => row.value !== null && !(skipDuplicates && isDuplicate(row)));
}

// ---------------------------------------------------------------------------
// Export (§13.8)
// ---------------------------------------------------------------------------

export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  // A leading =, +, - or @ makes a spreadsheet treat the cell as a formula;
  // prefixing an apostrophe keeps an exported note from executing on open.
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(headers: string[], rows: (string | number | null)[][]): string {
  const lines = [headers.map(csvCell).join(",")];
  for (const row of rows) lines.push(row.map(csvCell).join(","));
  return `${lines.join("\r\n")}\r\n`;
}

export type { JobStatus };
