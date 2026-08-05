/**
 * Database row → spreadsheet row (§14.7, §14.8).
 *
 * Pure functions: the awkward parts — a soft-deleted job, a missing customer,
 * a value that looks like a formula — are decided here and unit-tested, not
 * discovered inside a batch call to Google.
 */

export interface JobRowInput {
  id: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  customerName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  customerLocale: string | null;
  service: string | null;
  title: string;
  description: string | null;
  leadSource: string | null;
  priority: string;
  address: string | null;
  scheduledStart: string | null;
  estimateAmount: string | number | null;
  jobTotal: string | number | null;
  materialsCost: string | number | null;
  paymentStatus: string;
  assignedTo: string | null;
  lastFollowUpAt: string | null;
  reviewRequestedAt: string | null;
  notes: string | null;
  deletedAt: string | null;
}

export interface CustomerRowInput {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  preferredLocale: string | null;
  address: string | null;
  leadSource: string | null;
  firstJobDate: string | null;
  lastJobDate: string | null;
  /** Null until the Customers screen supplies aggregates (§14.7.2). */
  totalJobs: number | null;
  totalRevenue: string | number | null;
  notes: string | null;
  updatedAt: string;
}

/**
 * Google Sheets treats a leading =, +, - or @ as a formula. A customer named
 * "=Smith" or a note starting with "-" would become a broken formula, or worse
 * execute one — the same defusing the CSV export already does (§14.15).
 */
export function sheetCell(value: string | null | undefined): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) return `'${text}`;
  return text;
}

/** Money as a plain decimal string: the sheet formats it, we do not. */
function money(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  const numeric = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isFinite(numeric) ? numeric.toFixed(2) : "";
}

/**
 * Dates are written as `YYYY-MM-DD HH:mm` in the organization's time zone
 * (§25.1), deliberately not in the app's display format.
 *
 * Two reasons. A job scheduled for 2 PM local must not read as 9 PM because
 * the server runs in UTC — that is the difference between a sheet the owner
 * trusts and one they stop believing. And §14.2 makes this sheet a data source
 * for Make, Zapier and n8n: "Thu, Aug 7, 2:00 PM" sorts wrongly, parses badly,
 * and changes meaning with the reader's locale. A sortable, unambiguous stamp
 * is the one format that serves both a person scanning the tab and a tool
 * reading it.
 */
function zonedParts(value: string, timeZone: string): Record<string, string> | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  }).formatToParts(date);

  const found: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== "literal") found[part.type] = part.value;
  }
  return found;
}

function dateTime(value: string | null | undefined, timeZone: string): string {
  if (!value) return "";
  const p = zonedParts(value, timeZone);
  if (!p) return "";
  // Intl renders midnight as "24" in some environments; normalise it.
  const hour = p.hour === "24" ? "00" : p.hour;
  return `${p.year}-${p.month}-${p.day} ${hour}:${p.minute}`;
}

function dateOnly(value: string | null | undefined, timeZone: string): string {
  if (!value) return "";
  const p = zonedParts(value, timeZone);
  if (!p) return "";
  return `${p.year}-${p.month}-${p.day}`;
}

export interface RowContext {
  timeZone: string;
  locale: "en" | "es";
  /**
   * Absolute base for links leaving the app. Null when the deployment could
   * not be identified — the link column is then left empty rather than filled
   * with a guess that looks right and goes nowhere.
   */
  appUrl: string | null;
  /** Display labels for the stable codes (§13.6); the sheet shows words. */
  statusLabels: Record<string, string>;
  paymentStatusLabels: Record<string, string>;
  priorityLabels: Record<string, string>;
  leadSourceLabels: Record<string, string>;
}

/** Column order is the contract (§14.8). Do not reorder; append only. */
export function jobToRow(job: JobRowInput, context: RowContext): string[] {
  const label = (labels: Record<string, string>, code: string | null): string =>
    code ? (labels[code] ?? code) : "";

  return [
    job.id,
    label(context.statusLabels, job.status),
    dateTime(job.createdAt, context.timeZone),
    dateTime(job.updatedAt, context.timeZone),
    sheetCell(job.customerName),
    sheetCell(job.customerPhone),
    sheetCell(job.customerEmail),
    job.customerLocale ?? "",
    sheetCell(job.service ?? job.title),
    sheetCell(job.description),
    label(context.leadSourceLabels, job.leadSource),
    label(context.priorityLabels, job.priority),
    sheetCell(job.address),
    dateTime(job.scheduledStart, context.timeZone),
    money(job.estimateAmount),
    money(job.jobTotal),
    money(job.materialsCost),
    label(context.paymentStatusLabels, job.paymentStatus),
    sheetCell(job.assignedTo),
    dateOnly(job.lastFollowUpAt, context.timeZone),
    job.reviewRequestedAt ? "TRUE" : "FALSE",
    sheetCell(job.notes),
    context.appUrl ? `${context.appUrl}/${context.locale}/app/jobs/${job.id}` : "",
    // §14.12: a deleted job stays in the sheet, marked. Removing the row would
    // take away the record the owner may still be looking at.
    job.deletedAt ? "TRUE" : "FALSE",
  ];
}

export function customerToRow(customer: CustomerRowInput, context: RowContext): string[] {
  return [
    customer.id,
    sheetCell(customer.name),
    sheetCell(customer.phone),
    sheetCell(customer.email),
    customer.preferredLocale ?? "",
    sheetCell(customer.address),
    customer.leadSource
      ? (context.leadSourceLabels[customer.leadSource] ?? customer.leadSource)
      : "",
    dateOnly(customer.firstJobDate, context.timeZone),
    dateOnly(customer.lastJobDate, context.timeZone),
    // Empty, not "0". A column with no source behind it stays blank: zero
    // reads as a fact, and "this customer has had 0 jobs" is a claim we
    // cannot make while the aggregates do not exist (§14.7.2).
    customer.totalJobs === null ? "" : String(customer.totalJobs),
    money(customer.totalRevenue),
    sheetCell(customer.notes),
    dateTime(customer.updatedAt, context.timeZone),
  ];
}
