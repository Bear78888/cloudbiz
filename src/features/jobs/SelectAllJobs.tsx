"use client";

import { useEffect, useState } from "react";

/**
 * "Select all" for the bulk status change (§13.8).
 *
 * It renders only after mount: without JavaScript the checkbox could not do
 * anything, and a control that silently does nothing is worse than one that
 * is not there. The per-row checkboxes are plain form fields either way, so
 * bulk changes still work — one row at a time — before the script loads.
 */
export function SelectAllJobs({ label }: { label: string }) {
  const [mounted, setMounted] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return (
    <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => {
          const next = event.target.checked;
          setChecked(next);
          const form = event.target.closest("form");
          form
            ?.querySelectorAll<HTMLInputElement>('input[name="job_ids"]')
            .forEach((input) => {
              input.checked = next;
            });
        }}
        className="h-5 w-5 rounded border-slate-400 text-brand-600 focus:ring-brand-500"
      />
      {label}
    </label>
  );
}
