import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Shared UI primitives. Mobile-first, large touch targets, high contrast
 * (spec §8.1, §8.3).
 */

const buttonBase =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-6 py-3 text-base font-semibold transition-colors";

export const buttonStyles = {
  primary: `${buttonBase} bg-accent-500 text-slate-950 hover:bg-accent-400 active:bg-accent-600`,
  secondary: `${buttonBase} border-2 border-brand-200 bg-white text-brand-800 hover:border-brand-400 hover:bg-brand-50`,
  onDark: `${buttonBase} border-2 border-white/40 bg-white/10 text-white hover:bg-white/20`,
};

export function ButtonLink({
  href,
  variant = "primary",
  children,
  className = "",
}: {
  href: string;
  variant?: keyof typeof buttonStyles;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link href={href} className={`${buttonStyles[variant]} ${className}`}>
      {children}
    </Link>
  );
}

export function Section({
  children,
  className = "",
  id,
  tone = "white",
}: {
  children: ReactNode;
  className?: string;
  id?: string;
  tone?: "white" | "gray" | "dark";
}) {
  const tones = {
    white: "bg-white",
    gray: "bg-slate-50",
    dark: "bg-brand-950 text-white",
  };
  return (
    <section id={id} className={`${tones[tone]} ${className}`}>
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">{children}</div>
    </section>
  );
}

export function SectionHeading({
  title,
  sub,
  center = true,
  dark = false,
}: {
  title: string;
  sub?: string;
  center?: boolean;
  dark?: boolean;
}) {
  return (
    <div className={`${center ? "text-center" : ""} mb-10 sm:mb-12`}>
      <h2 className={`text-3xl font-bold tracking-tight sm:text-4xl ${dark ? "text-white" : "text-slate-900"}`}>
        {title}
      </h2>
      {sub ? (
        <p className={`mx-auto mt-4 max-w-2xl text-lg ${dark ? "text-brand-100" : "text-slate-600"}`}>
          {sub}
        </p>
      ) : null}
    </div>
  );
}

export function Badge({ children, tone = "green" }: { children: ReactNode; tone?: "green" | "blue" | "amber" }) {
  const tones = {
    green: "bg-emerald-100 text-emerald-800",
    blue: "bg-brand-100 text-brand-800",
    amber: "bg-accent-500/15 text-accent-700",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function CheckList({ items, dark = false }: { items: string[]; dark?: boolean }) {
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-3">
          <span
            className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
              dark ? "bg-white/15 text-accent-300" : "bg-emerald-100 text-emerald-700"
            }`}
            aria-hidden="true"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
              <path d="m5 13 4 4L19 7" />
            </svg>
          </span>
          <span className={dark ? "text-brand-50" : "text-slate-700"}>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function FaqList({ items }: { items: { q: string; a: string }[] }) {
  return (
    <div className="mx-auto max-w-3xl divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white">
      {items.map((item) => (
        <details key={item.q} className="group px-6 py-5">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left text-lg font-semibold text-slate-900 [&::-webkit-details-marker]:hidden">
            {item.q}
            <span className="text-brand-600 transition-transform group-open:rotate-45" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="h-5 w-5">
                <path d="M12 5v14" />
                <path d="M5 12h14" />
              </svg>
            </span>
          </summary>
          <p className="mt-3 pr-9 text-slate-600">{item.a}</p>
        </details>
      ))}
    </div>
  );
}
