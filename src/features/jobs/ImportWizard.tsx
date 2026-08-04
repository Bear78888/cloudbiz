"use client";

import Link from "next/link";
import { useCallback, useMemo, useState, useTransition } from "react";

import { fmt, type Dict } from "@/lib/i18n";
import type { Locale } from "@/lib/routes";
import {
  IMPORT_FIELDS,
  MAX_IMPORT_BYTES,
  MAX_IMPORT_ROWS,
  buildImportRows,
  detectMapping,
  isDuplicate,
  markExistingDuplicates,
  parseCsv,
  selectRowsToImport,
  type ColumnMapping,
  type ImportField,
  type ImportRow,
} from "./csv";
import { checkImportDuplicatesAction, importJobsAction } from "./import-actions";

/**
 * CSV import wizard (§14.15): choose a file → map the columns → preview and
 * check duplicates → confirm.
 *
 * The file is read and validated in the browser; nothing is sent to the server
 * until the owner confirms, and then only the rows they approved. Parsing is
 * the pure module in `csv.ts`, so the same rules are unit-tested.
 */

type Step = "file" | "map" | "preview" | "done";

const PREVIEW_ROWS = 8;

const selectClass =
  "min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200";

export function ImportWizard({
  locale,
  dict,
  timeZone,
}: {
  locale: Locale;
  dict: Dict;
  timeZone: string;
}) {
  const j = dict.platform.jobs;
  const t = j.import;

  const [step, setStep] = useState<Step>("file");
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [fileError, setFileError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [summary, setSummary] = useState<{ jobs: number; created: number; matched: number } | null>(
    null,
  );
  const [pending, startTransition] = useTransition();

  const fieldLabels: Record<ImportField, string> = useMemo(
    () => ({
      customer_name: j.form.customerName,
      customer_phone: j.form.phone,
      customer_email: j.form.email,
      customer_locale: j.form.preferredLanguage,
      title: j.form.jobTitle,
      service: j.form.service,
      description: j.form.description,
      source: j.form.leadSource,
      status: j.form.status,
      priority: j.form.priority,
      address: j.form.address,
      scheduled_start: j.form.scheduledStart,
      estimate_amount: j.form.estimateAmount,
      job_total: j.form.jobTotal,
      materials_cost: j.form.materialsCost,
      payment_status: j.form.paymentStatus,
      notes: j.form.notes,
    }),
    [j],
  );

  const onFile = useCallback(
    async (file: File) => {
      setFileError(null);
      if (file.size > MAX_IMPORT_BYTES) {
        setFileError(fmt(t.errorTooBig, { limit: Math.round(MAX_IMPORT_BYTES / 1024 / 1024) }));
        return;
      }
      const text = await file.text();
      const parsed = parseCsv(text);
      if (parsed.headers.length === 0 || parsed.rows.length === 0) {
        setFileError(t.errorEmpty);
        return;
      }
      setFileName(file.name);
      setHeaders(parsed.headers);
      setCsvRows(parsed.rows);
      setMapping(detectMapping(parsed.headers));
      setStep("map");
    },
    [t],
  );

  const goToPreview = useCallback(() => {
    const built = buildImportRows(csvRows, mapping, timeZone);
    setRows(built.rows);
    setStep("preview");

    // Ask the server which customers it already knows (§14.15 step 4).
    startTransition(async () => {
      const candidates = built.rows.map((row) => ({
        phone: row.raw.customer_phone ?? null,
        email: row.raw.customer_email ?? null,
        name: row.raw.customer_name ?? null,
      }));
      const check = await checkImportDuplicatesAction(candidates);
      if (check.error === null) {
        setRows(markExistingDuplicates(built.rows, check.existingKeys).rows);
      }
    });
  }, [csvRows, mapping, timeZone]);

  const selected = useMemo(() => selectRowsToImport(rows, skipDuplicates), [rows, skipDuplicates]);
  const errorCount = rows.filter((r) => Object.keys(r.errors).length > 0).length;
  const duplicateCount = rows.filter(isDuplicate).length;
  const mappedName = Object.values(mapping).includes("customer_name");
  const mappedTitle =
    Object.values(mapping).includes("title") || Object.values(mapping).includes("service");

  const runImport = useCallback(() => {
    setImportError(null);
    startTransition(async () => {
      const payload = selected
        .map((row) => row.value)
        .filter((value): value is NonNullable<typeof value> => value !== null);
      const result = await importJobsAction(locale, payload);
      if (result.error) {
        setImportError(result.error === "too_many" ? fmt(t.errorTooMany, { max: MAX_IMPORT_ROWS }) : t.errorGeneric);
        return;
      }
      setSummary({
        jobs: result.jobs,
        created: result.customersCreated,
        matched: result.customersMatched,
      });
      setStep("done");
    });
  }, [locale, selected, t]);

  // -------------------------------------------------------------------------

  if (step === "done" && summary) {
    return (
      <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center">
        <h2 className="text-xl font-bold text-slate-900">{t.doneTitle}</h2>
        <p className="mt-2 text-slate-700">
          {fmt(t.doneBody, {
            jobs: summary.jobs,
            created: summary.created,
            matched: summary.matched,
          })}
        </p>
        <Link
          href={`/${locale}/app/jobs`}
          className="mt-5 inline-flex min-h-12 items-center rounded-xl bg-brand-600 px-6 font-semibold text-white hover:bg-brand-700"
        >
          {t.doneCta}
        </Link>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <ol className="flex flex-wrap gap-2 text-sm font-semibold">
        {(["file", "map", "preview"] as const).map((s, index) => (
          <li
            key={s}
            aria-current={step === s ? "step" : undefined}
            className={`rounded-full px-4 py-1.5 ${
              step === s ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600"
            }`}
          >
            {index + 1}. {t.steps[s]}
          </li>
        ))}
      </ol>

      {step === "file" ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-bold text-slate-900">{t.fileTitle}</h2>
          <p className="mt-1 text-slate-600">{t.fileBody}</p>
          <label htmlFor="csv-file" className="mt-4 block text-sm font-semibold text-slate-700">
            {t.fileLabel}
          </label>
          <input
            id="csv-file"
            type="file"
            accept=".csv,text/csv,text/plain"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void onFile(file);
            }}
            className="mt-1.5 block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 file:mr-4 file:rounded-lg file:border-0 file:bg-brand-50 file:px-4 file:py-2 file:font-semibold file:text-brand-800"
          />
          {fileError ? (
            <p role="alert" className="mt-3 text-sm font-medium text-red-700">
              {fileError}
            </p>
          ) : null}
          <p className="mt-4 text-xs text-slate-500">{fmt(t.fileHint, { max: MAX_IMPORT_ROWS })}</p>
        </section>
      ) : null}

      {step === "map" ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-bold text-slate-900">{t.mapTitle}</h2>
          <p className="mt-1 text-slate-600">
            {fmt(t.mapBody, { file: fileName, rows: csvRows.length })}
          </p>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-600">
                <tr>
                  <th scope="col" className="py-2 pr-4 font-semibold">{t.mapColumn}</th>
                  <th scope="col" className="py-2 pr-4 font-semibold">{t.mapSample}</th>
                  <th scope="col" className="py-2 font-semibold">{t.mapField}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {headers.map((header, index) => (
                  <tr key={`${header}-${index}`}>
                    <td className="py-2 pr-4 font-medium text-slate-800">{header || `#${index + 1}`}</td>
                    <td className="py-2 pr-4 text-slate-500">{csvRows[0]?.[index] ?? ""}</td>
                    <td className="py-2">
                      <label className="sr-only" htmlFor={`map-${index}`}>
                        {fmt(t.mapFieldFor, { column: header || `#${index + 1}` })}
                      </label>
                      <select
                        id={`map-${index}`}
                        value={mapping[index] ?? ""}
                        onChange={(event) =>
                          setMapping((prev) => ({
                            ...prev,
                            [index]: event.target.value as ImportField | "",
                          }))
                        }
                        className={selectClass}
                      >
                        <option value="">{t.mapSkip}</option>
                        {IMPORT_FIELDS.map((field) => (
                          <option key={field} value={field}>
                            {fieldLabels[field]}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!mappedName || !mappedTitle ? (
            <p role="alert" className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
              {t.mapRequired}
            </p>
          ) : null}

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={!mappedName || !mappedTitle}
              onClick={goToPreview}
              className="min-h-12 rounded-xl bg-brand-600 px-6 font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {t.mapContinue}
            </button>
            <button
              type="button"
              onClick={() => setStep("file")}
              className="min-h-12 font-semibold text-slate-600 hover:text-slate-900"
            >
              {t.back}
            </button>
          </div>
        </section>
      ) : null}

      {step === "preview" ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-bold text-slate-900">{t.previewTitle}</h2>
          <p className="mt-1 text-slate-600" aria-live="polite">
            {fmt(t.previewSummary, {
              total: rows.length,
              ready: selected.length,
              errors: errorCount,
              duplicates: duplicateCount,
            })}
          </p>

          {duplicateCount > 0 ? (
            <label className="mt-4 flex items-start gap-3 rounded-xl bg-slate-50 p-4">
              <input
                type="checkbox"
                checked={skipDuplicates}
                onChange={(event) => setSkipDuplicates(event.target.checked)}
                className="mt-0.5 h-5 w-5 rounded border-slate-400 text-brand-600 focus:ring-brand-500"
              />
              <span>
                <span className="block text-sm font-semibold text-slate-800">{t.skipDuplicates}</span>
                <span className="mt-0.5 block text-xs text-slate-600">{t.skipDuplicatesHint}</span>
              </span>
            </label>
          ) : null}

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-600">
                <tr>
                  <th scope="col" className="py-2 pr-4 font-semibold">{t.previewRow}</th>
                  <th scope="col" className="py-2 pr-4 font-semibold">{j.form.customerName}</th>
                  <th scope="col" className="py-2 pr-4 font-semibold">{j.form.jobTitle}</th>
                  <th scope="col" className="py-2 font-semibold">{t.previewState}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.slice(0, PREVIEW_ROWS).map((row) => {
                  const rowErrors = Object.entries(row.errors);
                  return (
                    <tr key={row.line}>
                      <td className="py-2 pr-4 text-slate-500">{row.line}</td>
                      <td className="py-2 pr-4 text-slate-800">{row.raw.customer_name ?? "—"}</td>
                      <td className="py-2 pr-4 text-slate-800">
                        {row.raw.title ?? row.raw.service ?? "—"}
                      </td>
                      <td className="py-2">
                        {rowErrors.length > 0 ? (
                          <span className="text-red-700">
                            {rowErrors
                              .map(([field, code]) => `${fieldLabels[field as ImportField]}: ${j.fieldErrors[code]}`)
                              .join(" ")}
                          </span>
                        ) : isDuplicate(row) ? (
                          <span className="text-amber-800">
                            {row.duplicateOfLine !== null
                              ? fmt(t.duplicateInFile, { line: row.duplicateOfLine })
                              : t.duplicateExisting}
                          </span>
                        ) : (
                          <span className="text-emerald-800">{t.previewOk}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {rows.length > PREVIEW_ROWS ? (
            <p className="mt-2 text-xs text-slate-500">
              {fmt(t.previewMore, { more: rows.length - PREVIEW_ROWS })}
            </p>
          ) : null}

          {errorCount > 0 ? (
            <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
              {t.errorRowsSkipped}
            </p>
          ) : null}
          {importError ? (
            <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
              {importError}
            </p>
          ) : null}

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={runImport}
              disabled={pending || selected.length === 0}
              className="min-h-12 rounded-xl bg-brand-600 px-6 font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {pending ? t.importing : fmt(t.confirm, { count: selected.length })}
            </button>
            <button
              type="button"
              onClick={() => setStep("map")}
              className="min-h-12 font-semibold text-slate-600 hover:text-slate-900"
            >
              {t.back}
            </button>
          </div>
          <p className="mt-4 text-xs text-slate-500">{t.consentNote}</p>
        </section>
      ) : null}
    </div>
  );
}
