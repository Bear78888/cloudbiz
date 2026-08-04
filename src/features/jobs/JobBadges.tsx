import type { Dict } from "@/lib/i18n";
import type { JobPriority, JobStatus, PaymentStatus } from "./model";

/**
 * Status colour is meaning, not decoration: money owed reads amber, closed
 * work reads grey, active work reads blue. Every badge also carries its text,
 * so colour is never the only signal (§8.3).
 */

const STATUS_TONES: Record<JobStatus, string> = {
  new_lead: "bg-sky-100 text-sky-900",
  contacted: "bg-sky-100 text-sky-900",
  estimate_draft: "bg-violet-100 text-violet-900",
  estimate_sent: "bg-violet-100 text-violet-900",
  estimate_accepted: "bg-emerald-100 text-emerald-900",
  scheduled: "bg-brand-100 text-brand-900",
  in_progress: "bg-brand-100 text-brand-900",
  completed: "bg-emerald-100 text-emerald-900",
  paid: "bg-emerald-200 text-emerald-950",
  lost: "bg-slate-200 text-slate-700",
  canceled: "bg-slate-200 text-slate-700",
};

const PAYMENT_TONES: Record<PaymentStatus, string> = {
  unpaid: "bg-amber-100 text-amber-900",
  partial: "bg-amber-100 text-amber-900",
  paid: "bg-emerald-100 text-emerald-900",
  refunded: "bg-slate-200 text-slate-700",
};

const badgeBase = "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold";

export function StatusBadge({ status, dict }: { status: JobStatus; dict: Dict }) {
  return (
    <span className={`${badgeBase} ${STATUS_TONES[status]}`}>
      {dict.platform.jobs.statuses[status]}
    </span>
  );
}

export function PaymentBadge({ status, dict }: { status: PaymentStatus; dict: Dict }) {
  return (
    <span className={`${badgeBase} ${PAYMENT_TONES[status]}`}>
      {dict.platform.jobs.paymentStatuses[status]}
    </span>
  );
}

export function PriorityBadge({ priority, dict }: { priority: JobPriority; dict: Dict }) {
  if (priority !== "urgent") return null;
  return (
    <span className={`${badgeBase} bg-red-100 text-red-900`}>
      {dict.platform.jobs.priorities.urgent}
    </span>
  );
}

export function DeletedBadge({ dict }: { dict: Dict }) {
  return (
    <span className={`${badgeBase} bg-slate-800 text-white`}>{dict.platform.jobs.deletedBadge}</span>
  );
}
