import "server-only";

import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";

import { formatDate, formatMoney } from "@/lib/datetime";

/**
 * The estimate as a PDF (§16.9).
 *
 * Same reason as the email template (`email/templates/estimate.ts`): a pure
 * function from facts to bytes, so what a customer can save, print or forward
 * is decided by a test reading the rendered document, not by opening a file
 * by hand after every change. `@react-pdf/renderer` builds the PDF with no
 * browser and no native binary — it runs the same in this repo's serverless
 * routes as it does in a test.
 *
 * Written in the estimate's own language (§16.7), same as the email and the
 * web link. A PDF is the one artifact of the three a customer might keep or
 * forward without the context of who sent it, so the language decision
 * matters here as much as anywhere.
 */

export interface EstimatePdfItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface EstimatePdfInput {
  locale: "en" | "es";
  businessName: string;
  currency: string;
  title: string;
  scope: string | null;
  terms: string | null;
  items: EstimatePdfItem[];
  subtotal: number;
  tax: number;
  taxRate: number;
  total: number;
  sentAt: string | null;
  expiresAt: string | null;
}

const COPY = {
  en: {
    scopeHeading: "Scope of work",
    itemsHeading: "Line items",
    qty: "Qty",
    unitPrice: "Unit price",
    subtotal: "Subtotal",
    tax: "Tax",
    total: "Total",
    terms: "Terms",
    sentOn: (date: string) => `Sent ${date}`,
    goodUntil: (date: string) => `Good until ${date}`,
  },
  es: {
    scopeHeading: "Alcance del trabajo",
    itemsHeading: "Detalle",
    qty: "Cant.",
    unitPrice: "Precio unitario",
    subtotal: "Subtotal",
    tax: "Impuesto",
    total: "Total",
    terms: "Condiciones",
    sentOn: (date: string) => `Enviado ${date}`,
    goodUntil: (date: string) => `Válido hasta ${date}`,
  },
} as const;

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: "#0f172a" },
  business: { fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase" },
  title: { fontSize: 20, fontWeight: 700, marginTop: 4 },
  meta: { fontSize: 9, color: "#64748b", marginTop: 4 },
  section: { marginTop: 18 },
  heading: {
    fontSize: 9,
    fontWeight: 700,
    color: "#64748b",
    textTransform: "uppercase",
    marginBottom: 6,
  },
  scopeText: { lineHeight: 1.5 },
  tableHeaderRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#cbd5e1",
    paddingBottom: 4,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    paddingVertical: 6,
  },
  colDescription: { flexGrow: 1, flexBasis: 0 },
  colQty: { width: 50, textAlign: "right" },
  colUnitPrice: { width: 80, textAlign: "right" },
  colTotal: { width: 80, textAlign: "right" },
  headerCell: { fontSize: 8, fontWeight: 700, color: "#64748b", textTransform: "uppercase" },
  totals: { marginTop: 12, alignItems: "flex-end" },
  totalsRow: { flexDirection: "row", justifyContent: "space-between", width: 220, paddingVertical: 2 },
  totalsLabel: { color: "#475569" },
  totalsValue: { fontWeight: 700 },
  grandTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: 220,
    paddingTop: 8,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: "#0f172a",
  },
  grandTotalLabel: { fontSize: 13, fontWeight: 700 },
  grandTotalValue: { fontSize: 15, fontWeight: 700 },
  termsBox: { marginTop: 18, backgroundColor: "#f8fafc", padding: 12, borderRadius: 6 },
  termsText: { lineHeight: 1.5 },
});

export function EstimateDocument({ estimate }: { estimate: EstimatePdfInput }) {
  const t = COPY[estimate.locale];
  const money = (amount: number) => formatMoney(amount, estimate.locale, estimate.currency);

  return (
    <Document title={`${estimate.businessName} — ${estimate.title}`}>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.business}>{estimate.businessName}</Text>
        <Text style={styles.title}>{estimate.title}</Text>
        {estimate.sentAt ? (
          <Text style={styles.meta}>
            {t.sentOn(formatDate(estimate.sentAt, estimate.locale, "UTC"))}
            {estimate.expiresAt
              ? ` · ${t.goodUntil(formatDate(estimate.expiresAt, estimate.locale, "UTC"))}`
              : ""}
          </Text>
        ) : null}

        {estimate.scope ? (
          <View style={styles.section}>
            <Text style={styles.heading}>{t.scopeHeading}</Text>
            <Text style={styles.scopeText}>{estimate.scope}</Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.heading}>{t.itemsHeading}</Text>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.colDescription, styles.headerCell]}></Text>
            <Text style={[styles.colQty, styles.headerCell]}>{t.qty}</Text>
            <Text style={[styles.colUnitPrice, styles.headerCell]}>{t.unitPrice}</Text>
            <Text style={[styles.colTotal, styles.headerCell]}>{t.total}</Text>
          </View>
          {estimate.items.map((item, index) => (
            // eslint-disable-next-line react/no-array-index-key -- line items have no stable id here; order is the identity
            <View key={index} style={styles.tableRow}>
              <Text style={styles.colDescription}>{item.description}</Text>
              <Text style={styles.colQty}>{item.quantity}</Text>
              <Text style={styles.colUnitPrice}>{money(item.unitPrice)}</Text>
              <Text style={styles.colTotal}>{money(item.total)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totals}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>{t.subtotal}</Text>
            <Text style={styles.totalsValue}>{money(estimate.subtotal)}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>
              {t.tax}
              {estimate.taxRate > 0 ? ` (${Math.round(estimate.taxRate * 10000) / 100}%)` : ""}
            </Text>
            <Text style={styles.totalsValue}>{money(estimate.tax)}</Text>
          </View>
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>{t.total}</Text>
            <Text style={styles.grandTotalValue}>{money(estimate.total)}</Text>
          </View>
        </View>

        {estimate.terms ? (
          <View style={styles.termsBox}>
            <Text style={styles.heading}>{t.terms}</Text>
            <Text style={styles.termsText}>{estimate.terms}</Text>
          </View>
        ) : null}
      </Page>
    </Document>
  );
}

/** Renders the document to bytes. The only I/O boundary in this file. */
export async function renderEstimatePdf(estimate: EstimatePdfInput): Promise<Buffer> {
  return renderToBuffer(<EstimateDocument estimate={estimate} />);
}
