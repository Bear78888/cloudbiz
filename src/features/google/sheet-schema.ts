/**
 * The spreadsheet's shape (§14.7, §14.8).
 *
 * This file is a contract, not a layout. Whatever the owner wires into Make,
 * Zapier or n8n reads these columns by position, so §14.8 is explicit: column
 * order and names do not change without a migration strategy. Adding a column
 * at the end is safe; inserting one in the middle silently breaks every
 * external automation pointed at the sheet. `SHEET_SCHEMA_VERSION` is what a
 * future migration would key off, and it is written into the Read Me tab so a
 * human can see it too.
 */

export const SHEET_SCHEMA_VERSION = 1;

export type TabKey = "jobs" | "customers" | "readme";

export interface TabDefinition {
  key: TabKey;
  /** Tab title, bilingual per §14.7. Renamed by the user at their own risk — */
  /** we address tabs by numeric sheetId (§14.8), so a rename does not break sync. */
  title: { en: string; es: string };
  headers: { en: string; es: string }[];
}

/**
 * Only the tabs whose data exists today. §14.7 also specifies Estimates,
 * Calls, Follow-Ups and Lead Refunds — those tools arrive in later stages, and
 * creating empty tabs now would promise the owner something the product does
 * not do yet. They are added by the stage that fills them, which is also when
 * their columns can be got right.
 */
export const TABS: TabDefinition[] = [
  {
    key: "jobs",
    title: { en: "Jobs", es: "Trabajos" },
    headers: [
      { en: "HandyAlliance Job ID", es: "ID de trabajo HandyAlliance" },
      { en: "Status", es: "Estado" },
      { en: "Created", es: "Creado" },
      { en: "Updated", es: "Actualizado" },
      { en: "Customer", es: "Cliente" },
      { en: "Phone", es: "Teléfono" },
      { en: "Email", es: "Email" },
      { en: "Language", es: "Idioma" },
      { en: "Service", es: "Servicio" },
      { en: "Description", es: "Descripción" },
      { en: "Lead Source", es: "Fuente" },
      { en: "Priority", es: "Prioridad" },
      { en: "Address", es: "Dirección" },
      { en: "Scheduled Date", es: "Fecha programada" },
      { en: "Estimate Amount", es: "Presupuesto" },
      { en: "Job Total", es: "Total" },
      { en: "Materials Cost", es: "Materiales" },
      { en: "Payment Status", es: "Estado de pago" },
      { en: "Assigned To", es: "Asignado a" },
      { en: "Last Follow-Up", es: "Último seguimiento" },
      { en: "Review Requested", es: "Reseña solicitada" },
      { en: "Notes", es: "Notas" },
      { en: "HandyAlliance Link", es: "Enlace HandyAlliance" },
      { en: "Deleted", es: "Eliminado" },
    ],
  },
  {
    key: "customers",
    title: { en: "Customers", es: "Clientes" },
    headers: [
      { en: "Customer ID", es: "ID de cliente" },
      { en: "Name", es: "Nombre" },
      { en: "Phone", es: "Teléfono" },
      { en: "Email", es: "Email" },
      { en: "Preferred Language", es: "Idioma preferido" },
      { en: "Address", es: "Dirección" },
      { en: "Lead Source", es: "Fuente" },
      { en: "First Job Date", es: "Primer trabajo" },
      { en: "Last Job Date", es: "Último trabajo" },
      { en: "Total Jobs", es: "Total de trabajos" },
      { en: "Total Revenue", es: "Ingresos totales" },
      { en: "Notes", es: "Notas" },
      { en: "Updated", es: "Actualizado" },
    ],
  },
  {
    key: "readme",
    title: { en: "Read Me", es: "Léeme" },
    headers: [
      { en: "HandyAlliance", es: "HandyAlliance" },
      { en: "", es: "" },
    ],
  },
];

/** The id column is always first: §14.8 syncs by UUID, never by customer name. */
export const ID_COLUMN_INDEX = 0;

export function tabTitle(key: TabKey, locale: "en" | "es"): string {
  const tab = TABS.find((candidate) => candidate.key === key);
  if (!tab) throw new Error(`unknown tab: ${key}`);
  return tab.title[locale];
}

export function headerRow(key: TabKey, locale: "en" | "es"): string[] {
  const tab = TABS.find((candidate) => candidate.key === key);
  if (!tab) throw new Error(`unknown tab: ${key}`);
  return tab.headers.map((header) => header[locale]);
}

/** §14.6. */
export function spreadsheetTitle(businessName: string): string {
  return `HandyAlliance — ${businessName}`;
}

export interface ReadMeInput {
  locale: "en" | "es";
  dashboardUrl: string;
  lastSyncedAt: string | null;
}

/**
 * The Read Me tab (§14.7.7). It carries the §14.3 warning, because the sheet
 * is a mirror: a user who edits it will lose their edit on the next sync, and
 * the only fair place to say so is inside the sheet itself.
 */
export function readMeRows({ locale, dashboardUrl, lastSyncedAt }: ReadMeInput): string[][] {
  const synced = lastSyncedAt ?? (locale === "es" ? "Aún no" : "Not yet");
  if (locale === "es") {
    return [
      ["HandyAlliance — Hoja de sincronización", ""],
      ["", ""],
      ["Edita los trabajos en HandyAlliance. Esta hoja se actualiza automáticamente.", ""],
      ["", ""],
      ["Última sincronización", synced],
      ["Estado", "Activo"],
      ["Versión del esquema", String(SHEET_SCHEMA_VERSION)],
      ["Panel", dashboardUrl],
      ["", ""],
      ["Pestañas", ""],
      ["Trabajos", "Todos tus trabajos, uno por fila."],
      ["Clientes", "Tus clientes y sus totales."],
      ["", ""],
      [
        "Para conectar otras herramientas (Make, Zapier, n8n): usa esta hoja como fuente. Las columnas no cambian de orden.",
        "",
      ],
    ];
  }
  return [
    ["HandyAlliance — Sync sheet", ""],
    ["", ""],
    ["Edit jobs in HandyAlliance. This sheet updates automatically.", ""],
    ["", ""],
    ["Last synced", synced],
    ["Status", "Active"],
    ["Schema version", String(SHEET_SCHEMA_VERSION)],
    ["Dashboard", dashboardUrl],
    ["", ""],
    ["Tabs", ""],
    ["Jobs", "Every job you have, one per row."],
    ["Customers", "Your customers and their totals."],
    ["", ""],
    [
      "To connect other tools (Make, Zapier, n8n): use this sheet as the source. Column order does not change.",
      "",
    ],
  ];
}
