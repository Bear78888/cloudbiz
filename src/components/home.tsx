import Link from "next/link";
import { PRODUCTS } from "@/lib/config";
import { fmt, type Dict } from "@/lib/i18n";
import { bundleVars, toolVars } from "@/lib/pricing";
import { hrefFor, type Locale } from "@/lib/routes";
import { ArrowRightIcon, SheetIcon, TableIcon, ToolIcon } from "./icons";
import { Badge, ButtonLink, CheckList, FaqList, Section, SectionHeading } from "./ui";

/* ---------- shared demo widgets ---------- */

function statusTone(status: string, dict: Dict): string {
  const s = dict.trackerSample.statuses;
  if (status === s.completed || status === s.paid) return "bg-emerald-100 text-emerald-800";
  if (status === s.scheduled) return "bg-brand-100 text-brand-800";
  return "bg-accent-500/15 text-accent-700";
}

export function TrackerCards({ dict }: { dict: Dict }) {
  return (
    <div className="space-y-3" role="img" aria-label={dict.jobTracker.page.sampleTitle}>
      {dict.trackerSample.rows.map((row) => (
        <div key={row.customer} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="font-semibold text-slate-900">{row.customer}</p>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusTone(row.status, dict)}`}>
              {row.status}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-600">{row.service}</p>
          <div className="mt-3 flex items-center justify-between text-sm">
            <span className="font-bold text-slate-900">{row.amount}</span>
            <span className="text-slate-500">{row.date}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function SheetMock({ dict }: { dict: Dict }) {
  const c = dict.trackerSample.columns;
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
      <div className="flex items-center gap-2 border-b border-slate-200 bg-emerald-600 px-4 py-2.5 text-white">
        <SheetIcon className="h-4 w-4" />
        <p className="truncate text-sm font-semibold">HandyAlliance — Mike&apos;s Plumbing</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-md text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <th scope="col" className="px-4 py-2 font-semibold">{c.customer}</th>
              <th scope="col" className="px-4 py-2 font-semibold">{c.service}</th>
              <th scope="col" className="px-4 py-2 font-semibold">{c.status}</th>
              <th scope="col" className="px-4 py-2 font-semibold">{c.amount}</th>
            </tr>
          </thead>
          <tbody>
            {dict.trackerSample.rows.map((row) => (
              <tr key={row.customer} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-2.5 font-medium text-slate-800">{row.customer}</td>
                <td className="px-4 py-2.5 text-slate-600">{row.service}</td>
                <td className="px-4 py-2.5">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusTone(row.status, dict)}`}>
                    {row.status}
                  </span>
                </td>
                <td className="px-4 py-2.5 font-semibold text-slate-800">{row.amount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-4 py-2.5">
        <p className="text-xs text-slate-500">{dict.sheets.sheetNote}</p>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
          {dict.sheets.lastSynced}
        </span>
      </div>
    </div>
  );
}

/* ---------- home sections ---------- */

function Hero({ locale, dict }: { locale: Locale; dict: Dict }) {
  return (
    <Section tone="dark" className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 opacity-20" aria-hidden="true">
        <div className="absolute -top-24 right-0 h-96 w-96 rounded-full bg-brand-500 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-72 w-72 rounded-full bg-accent-500 blur-3xl" />
      </div>
      <div className="relative grid items-center gap-12 lg:grid-cols-2">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">{dict.hero.title}</h1>
          <p className="mt-5 max-w-xl text-lg text-brand-100 sm:text-xl">{dict.hero.subtitle}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href={hrefFor("tools", locale)}>{dict.hero.ctaPrimary}</ButtonLink>
            <ButtonLink href={hrefFor("pricing", locale)} variant="onDark">
              {dict.hero.ctaSecondary}
            </ButtonLink>
          </div>
          <p className="mt-5 text-sm text-brand-200">{dict.hero.note}</p>
          <ul className="mt-6 flex flex-wrap gap-2">
            {dict.hero.badges.map((badge) => (
              <li key={badge} className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-sm text-brand-50">
                {badge}
              </li>
            ))}
          </ul>
        </div>
        <div className="mx-auto w-full max-w-sm lg:max-w-md">
          <TrackerCards dict={dict} />
        </div>
      </div>
    </Section>
  );
}

function ToolsGrid({ locale, dict }: { locale: Locale; dict: Dict }) {
  return (
    <Section id="tools">
      <SectionHeading title={dict.toolsSection.heading} sub={dict.toolsSection.subheading} />
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {PRODUCTS.map((p) => {
          const t = dict.tools[p.code];
          return (
            <article key={p.code} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
                <ToolIcon code={p.code} className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-xl font-bold text-slate-900">{t.name}</h3>
              <p className="mt-2 flex-1 text-slate-600">{t.tagline}</p>
              <p className="mt-4 text-lg font-bold text-slate-900">{fmt(t.priceLine, toolVars(p.code))}</p>
              <p className="mt-1 text-sm text-slate-500">{dict.common.includedInBundle}</p>
              <Link
                href={hrefFor(`tool:${p.code}`, locale)}
                className="mt-5 inline-flex min-h-11 items-center gap-2 font-semibold text-brand-700 hover:text-brand-800"
              >
                {t.cta}
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
            </article>
          );
        })}

        <article className="flex flex-col rounded-2xl border-2 border-emerald-200 bg-emerald-50/60 p-6">
          <div className="flex items-center justify-between">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <TableIcon className="h-6 w-6" />
            </div>
            <Badge tone="green">{dict.jobTracker.badge}</Badge>
          </div>
          <h3 className="mt-4 text-xl font-bold text-slate-900">{dict.jobTracker.name}</h3>
          <p className="mt-2 flex-1 text-slate-600">{dict.jobTracker.tagline}</p>
          <p className="mt-4 text-lg font-bold text-emerald-700">{dict.common.free}</p>
          <Link
            href={hrefFor("jobTracker", locale)}
            className="mt-5 inline-flex min-h-11 items-center gap-2 font-semibold text-emerald-700 hover:text-emerald-800"
          >
            {dict.jobTracker.cta}
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
        </article>
      </div>
    </Section>
  );
}

function JobTrackerSection({ locale, dict }: { locale: Locale; dict: Dict }) {
  return (
    <Section tone="gray">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <div>
          <Badge tone="green">{dict.jobTracker.badge}</Badge>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            {dict.jobTracker.homeHeading}
          </h2>
          <p className="mt-4 text-lg text-slate-600">{dict.jobTracker.homeSub}</p>
          <div className="mt-8">
            <ButtonLink href={hrefFor("jobTracker", locale)} variant="secondary">
              {dict.common.learnMore}
            </ButtonLink>
          </div>
        </div>
        <div className="mx-auto w-full max-w-sm">
          <TrackerCards dict={dict} />
        </div>
      </div>
    </Section>
  );
}

function SheetsSection({ dict }: { dict: Dict }) {
  return (
    <Section>
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <div className="order-2 lg:order-1">
          <SheetMock dict={dict} />
        </div>
        <div className="order-1 lg:order-2">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">{dict.sheets.heading}</h2>
          <p className="mt-4 text-lg font-medium text-brand-800">{dict.sheets.promise}</p>
          <div className="mt-6">
            <CheckList items={dict.sheets.points} />
          </div>
        </div>
      </div>
    </Section>
  );
}

function SetupOnceSection({ dict }: { dict: Dict }) {
  return (
    <Section tone="gray">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">{dict.setupOnce.heading}</h2>
        <p className="mt-4 text-lg text-slate-600">{dict.setupOnce.sub}</p>
        <ul className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:flex-wrap">
          {dict.setupOnce.points.map((point) => (
            <li key={point} className="rounded-full border border-brand-200 bg-white px-4 py-2 text-sm font-medium text-brand-800">
              {point}
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}

function PricingPreview({ locale, dict }: { locale: Locale; dict: Dict }) {
  return (
    <Section>
      <SectionHeading title={dict.pricingPreview.heading} sub={dict.pricingPreview.sub} />
      <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-8">
          <h3 className="text-xl font-bold text-slate-900">{dict.pricingPage.freeCard.name}</h3>
          <p className="mt-3 text-3xl font-bold text-emerald-700">{dict.pricingPage.freeCard.priceLine}</p>
          <p className="mt-3 text-slate-600">{dict.pricingPage.freeCard.blurb}</p>
        </div>
        <div className="rounded-2xl border-2 border-accent-500 bg-brand-950 p-8 text-white">
          <h3 className="text-xl font-bold">{dict.pricingPage.bundle.name}</h3>
          <p className="mt-3 text-3xl font-bold text-accent-400">
            {fmt(dict.pricingPage.bundle.priceLine, bundleVars)}
          </p>
          <p className="mt-3 text-brand-100">{dict.pricingPage.bundle.blurb}</p>
        </div>
      </div>
      <div className="mt-10 text-center">
        <ButtonLink href={hrefFor("pricing", locale)} variant="secondary">
          {dict.pricingPreview.cta}
        </ButtonLink>
      </div>
    </Section>
  );
}

export function TradesGrid({ locale, dict, heading = true }: { locale: Locale; dict: Dict; heading?: boolean }) {
  const entries = Object.entries(dict.trades.items) as [keyof Dict["trades"]["items"], Dict["trades"]["items"]["handyman"]][];
  return (
    <Section tone="gray" id="trades">
      {heading ? <SectionHeading title={dict.trades.heading} sub={dict.trades.sub} /> : null}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {entries.map(([code, trade]) => (
          <Link
            key={code}
            href={hrefFor(`trade:${code}`, locale)}
            className="group rounded-2xl border border-slate-200 bg-white p-6 transition-shadow hover:shadow-md"
          >
            <h3 className="flex items-center justify-between text-lg font-bold text-slate-900">
              {trade.name}
              <ArrowRightIcon className="h-5 w-5 text-brand-600 transition-transform group-hover:translate-x-1" />
            </h3>
            <p className="mt-2 text-sm text-slate-600">{trade.blurb}</p>
          </Link>
        ))}
      </div>
    </Section>
  );
}

function DemoSection({ dict }: { dict: Dict }) {
  return (
    <Section>
      <div className="mx-auto max-w-3xl rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
        <h2 className="text-2xl font-bold text-slate-900">{dict.demo.heading}</h2>
        <p className="mt-3 text-slate-600">{dict.demo.sub}</p>
      </div>
    </Section>
  );
}

function FaqSection({ dict }: { dict: Dict }) {
  return (
    <Section tone="gray">
      <SectionHeading title={dict.faq.heading} />
      <FaqList items={dict.faq.items} />
    </Section>
  );
}

export function CtaBanner({ locale, dict }: { locale: Locale; dict: Dict }) {
  return (
    <Section tone="dark">
      <div className="text-center">
        <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">{dict.ctaBanner.title}</h2>
        <p className="mx-auto mt-4 max-w-xl text-lg text-brand-100">{dict.ctaBanner.sub}</p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <ButtonLink href={hrefFor("tools", locale)}>{dict.ctaBanner.ctaPrimary}</ButtonLink>
          <ButtonLink href={hrefFor("pricing", locale)} variant="onDark">
            {dict.ctaBanner.ctaSecondary}
          </ButtonLink>
        </div>
      </div>
    </Section>
  );
}

/* ---------- assembled home page (block order per spec §7.4) ---------- */

export function HomePage({ locale, dict }: { locale: Locale; dict: Dict }) {
  return (
    <>
      <Hero locale={locale} dict={dict} />
      <ToolsGrid locale={locale} dict={dict} />
      <JobTrackerSection locale={locale} dict={dict} />
      <SheetsSection dict={dict} />
      <SetupOnceSection dict={dict} />
      <PricingPreview locale={locale} dict={dict} />
      <TradesGrid locale={locale} dict={dict} />
      <DemoSection dict={dict} />
      <FaqSection dict={dict} />
      <CtaBanner locale={locale} dict={dict} />
    </>
  );
}
