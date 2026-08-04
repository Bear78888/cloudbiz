import Link from "next/link";
import { PRODUCTS, type PaidProductCode, type TradeCode } from "@/lib/config";
import { fmt, type Dict } from "@/lib/i18n";
import { bundleVars, toolVars } from "@/lib/pricing";
import { hrefFor, type Locale } from "@/lib/routes";
import { ArrowRightIcon, TableIcon, ToolIcon } from "./icons";
import { CtaBanner, SheetMock, TrackerCards } from "./home";
import { Badge, ButtonLink, CheckList, FaqList, Section, SectionHeading } from "./ui";

/* ---------- Tools index (§7.1 /tools) ---------- */

export function ToolsIndexPage({ locale, dict }: { locale: Locale; dict: Dict }) {
  return (
    <>
      <Section tone="gray">
        <SectionHeading title={dict.nav.tools} sub={dict.toolsSection.subheading} />
        <div className="mx-auto max-w-4xl space-y-4">
          {PRODUCTS.map((p) => {
            const t = dict.tools[p.code];
            return (
              <Link
                key={p.code}
                href={hrefFor(`tool:${p.code}`, locale)}
                className="group flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 transition-shadow hover:shadow-md sm:flex-row sm:items-center"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
                  <ToolIcon code={p.code} className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-bold text-slate-900">{t.name}</h2>
                  <p className="mt-1 text-slate-600">{t.tagline}</p>
                </div>
                <div className="flex items-center gap-3 sm:flex-col sm:items-end sm:gap-1">
                  <p className="font-bold text-slate-900">{fmt(t.priceLine, toolVars(p.code))}</p>
                  <span className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700">
                    {dict.common.learnMore}
                    <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </span>
                </div>
              </Link>
            );
          })}

          <Link
            href={hrefFor("jobTracker", locale)}
            className="group flex flex-col gap-4 rounded-2xl border-2 border-emerald-200 bg-emerald-50/60 p-6 transition-shadow hover:shadow-md sm:flex-row sm:items-center"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <TableIcon className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
                {dict.jobTracker.name}
                <Badge tone="green">{dict.jobTracker.badge}</Badge>
              </h2>
              <p className="mt-1 text-slate-600">{dict.jobTracker.tagline}</p>
            </div>
            <p className="font-bold text-emerald-700">{dict.common.free}</p>
          </Link>
        </div>
      </Section>
      <CtaBanner locale={locale} dict={dict} />
    </>
  );
}

/* ---------- Tool detail (§7.1 /tools/:slug) ---------- */

export function ToolDetailPage({
  locale,
  dict,
  code,
}: {
  locale: Locale;
  dict: Dict;
  code: PaidProductCode;
}) {
  const t = dict.tools[code];
  const vars = toolVars(code);
  const priceExtra = "priceLineExtra" in t ? t.priceLineExtra : undefined;

  return (
    <>
      <Section tone="dark">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-accent-400">
            <ToolIcon code={code} className="h-8 w-8" />
          </div>
          <h1 className="mt-6 text-4xl font-bold tracking-tight text-white sm:text-5xl">{t.name}</h1>
          <p className="mt-5 text-lg text-brand-100 sm:text-xl">{t.detail.promise}</p>
          <p className="mt-6 text-2xl font-bold text-accent-400">
            {fmt(t.priceLine, vars)}
            {priceExtra ? (
              <span className="ml-2 text-base font-medium text-brand-100">{fmt(priceExtra, vars)}</span>
            ) : null}
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <ButtonLink href={hrefFor("signUp", locale)}>{dict.common.getStarted}</ButtonLink>
            <ButtonLink href={hrefFor("pricing", locale)} variant="onDark">
              {dict.common.seePricing}
            </ButtonLink>
          </div>
          <p className="mt-4 text-sm text-brand-200">{dict.common.includedInBundle}</p>
        </div>
      </Section>

      <Section>
        <SectionHeading title={t.detail.howTitle} />
        <ol className="mx-auto grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {t.detail.steps.map((step, i) => (
            <li key={step} className="rounded-2xl border border-slate-200 bg-white p-6">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-700 text-sm font-bold text-white" aria-hidden="true">
                {i + 1}
              </span>
              <p className="mt-4 text-slate-700">{step}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section tone="gray">
        <div className="mx-auto grid max-w-5xl items-start gap-10 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <h2 className="text-2xl font-bold text-slate-900">{t.detail.featuresTitle}</h2>
            <div className="mt-6">
              <CheckList items={t.detail.features} />
            </div>
          </div>
          <div className="space-y-6 lg:col-span-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <h2 className="text-lg font-bold text-slate-900">{t.detail.limitsTitle}</h2>
              <ul className="mt-4 space-y-2 text-slate-700">
                {t.detail.limits.map((limit) => (
                  <li key={limit} className="flex items-start gap-2">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" aria-hidden="true" />
                    {fmt(limit, vars)}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-accent-500/40 bg-accent-500/10 p-6">
              <h2 className="text-lg font-bold text-slate-900">{t.detail.honestyTitle}</h2>
              <ul className="mt-4 space-y-2 text-slate-700">
                {t.detail.honesty.map((line) => (
                  <li key={line} className="flex items-start gap-2">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-600" aria-hidden="true" />
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </Section>

      <Section>
        <SectionHeading title={dict.faq.heading} />
        <FaqList items={t.detail.faq} />
      </Section>

      <CtaBanner locale={locale} dict={dict} />
    </>
  );
}

/* ---------- Job Tracker (§7.1 /job-tracker) ---------- */

export function JobTrackerPage({ locale, dict }: { locale: Locale; dict: Dict }) {
  const p = dict.jobTracker.page;
  return (
    <>
      <Section tone="dark">
        <div className="mx-auto max-w-3xl text-center">
          <Badge tone="green">{dict.jobTracker.badge}</Badge>
          <h1 className="mt-5 text-4xl font-bold tracking-tight text-white sm:text-5xl">{p.heroTitle}</h1>
          <p className="mt-5 text-lg text-brand-100 sm:text-xl">{p.heroSub}</p>
          <div className="mt-8">
            <ButtonLink href={hrefFor("signUp", locale)}>{dict.jobTracker.cta}</ButtonLink>
          </div>
        </div>
      </Section>

      <Section>
        <SectionHeading title={p.flowTitle} />
        <ol className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-2">
          {p.flow.map((step, i) => (
            <li key={step} className="flex items-center gap-2">
              <span className="rounded-full border border-brand-200 bg-brand-50 px-4 py-2 text-sm font-semibold text-brand-800">
                {step}
              </span>
              {i < p.flow.length - 1 ? (
                <ArrowRightIcon className="h-4 w-4 text-slate-400" />
              ) : null}
            </li>
          ))}
        </ol>
      </Section>

      <Section tone="gray">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{p.featuresTitle}</h2>
            <div className="mt-6">
              <CheckList items={p.features} />
            </div>
          </div>
          <div className="mx-auto w-full max-w-sm">
            <p className="mb-4 text-center text-sm font-semibold uppercase tracking-wide text-slate-500">
              {p.sampleTitle}
            </p>
            <TrackerCards dict={dict} />
          </div>
        </div>
      </Section>

      <Section>
        <div className="mx-auto max-w-3xl rounded-2xl border border-brand-200 bg-brand-50 p-8 text-center">
          <h2 className="text-2xl font-bold text-slate-900">{p.voiceTitle}</h2>
          <blockquote className="mx-auto mt-4 max-w-xl text-lg text-slate-700 italic">{p.voiceExample}</blockquote>
          <p className="mt-4 text-sm font-medium text-brand-800">{p.voiceNote}</p>
        </div>
      </Section>

      <Section tone="gray">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{p.syncTitle}</h2>
            <p className="mt-4 text-lg text-slate-600">{p.syncText}</p>
            <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6">
              <h3 className="text-lg font-bold text-slate-900">{p.notCrmTitle}</h3>
              <p className="mt-2 text-slate-600">{p.notCrm}</p>
            </div>
          </div>
          <SheetMock dict={dict} />
        </div>
      </Section>

      <CtaBanner locale={locale} dict={dict} />
    </>
  );
}

/* ---------- Pricing (§7.1 /pricing) ---------- */

export function PricingPage({ locale, dict }: { locale: Locale; dict: Dict }) {
  return (
    <>
      <Section tone="gray">
        <SectionHeading title={dict.pricingPage.title} sub={dict.pricingPage.sub} />

        <div className="mx-auto max-w-5xl">
          <h2 className="sr-only">{dict.pricingPage.bundleHeading}</h2>
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-emerald-200 bg-white p-8">
              <Badge tone="green">{dict.jobTracker.badge}</Badge>
              <h3 className="mt-4 text-xl font-bold text-slate-900">{dict.pricingPage.freeCard.name}</h3>
              <p className="mt-3 text-3xl font-bold text-emerald-700">{dict.pricingPage.freeCard.priceLine}</p>
              <p className="mt-3 text-slate-600">{dict.pricingPage.freeCard.blurb}</p>
              <div className="mt-6">
                <ButtonLink href={hrefFor("signUp", locale)} variant="secondary" className="w-full">
                  {dict.pricingPage.freeCard.cta}
                </ButtonLink>
              </div>
            </div>

            <div className="rounded-2xl border-2 border-accent-500 bg-brand-950 p-8 text-white">
              <Badge tone="amber">{dict.pricingPage.bundleHeading}</Badge>
              <h3 className="mt-4 text-xl font-bold">{dict.pricingPage.bundle.name}</h3>
              <p className="mt-3 text-3xl font-bold text-accent-400">
                {fmt(dict.pricingPage.bundle.priceLine, bundleVars)}
              </p>
              <p className="mt-3 text-brand-100">{dict.pricingPage.bundle.blurb}</p>
              <div className="mt-5">
                <CheckList items={dict.pricingPage.bundle.includes.map((s) => fmt(s, bundleVars))} dark />
              </div>
              <div className="mt-6">
                <ButtonLink href={hrefFor("signUp", locale)} className="w-full">
                  {dict.pricingPage.bundle.cta}
                </ButtonLink>
              </div>
            </div>
          </div>

          <h2 className="mt-14 text-center text-2xl font-bold text-slate-900">
            {dict.pricingPage.perToolHeading}
          </h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {PRODUCTS.map((p) => {
              const t = dict.tools[p.code];
              const vars = toolVars(p.code);
              const priceExtra = "priceLineExtra" in t ? t.priceLineExtra : undefined;
              return (
                <div key={p.code} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
                    <ToolIcon code={p.code} className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-lg font-bold text-slate-900">{t.name}</h3>
                  <p className="mt-2 text-2xl font-bold text-slate-900">{fmt(t.priceLine, vars)}</p>
                  {priceExtra ? <p className="mt-1 text-sm text-slate-500">{fmt(priceExtra, vars)}</p> : null}
                  <ul className="mt-4 flex-1 space-y-1.5 text-sm text-slate-600">
                    {t.detail.limits.map((limit) => (
                      <li key={limit} className="flex items-start gap-2">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" aria-hidden="true" />
                        {fmt(limit, vars)}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={hrefFor(`tool:${p.code}`, locale)}
                    className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-brand-700 hover:text-brand-800"
                  >
                    {dict.common.learnMore}
                    <ArrowRightIcon className="h-4 w-4" />
                  </Link>
                </div>
              );
            })}
          </div>

          <p className="mx-auto mt-10 max-w-2xl text-center text-sm text-slate-500">
            {dict.pricingPage.limitsNote}
          </p>
        </div>
      </Section>

      <Section>
        <SectionHeading title={dict.faq.heading} />
        <FaqList items={dict.pricingPage.faq} />
      </Section>

      <CtaBanner locale={locale} dict={dict} />
    </>
  );
}

/* ---------- Trade pages (§7.1 /for/:trade) ---------- */

export function TradePage({
  locale,
  dict,
  trade,
}: {
  locale: Locale;
  dict: Dict;
  trade: TradeCode;
}) {
  const t = dict.trades.items[trade];
  const page = dict.trades.page;

  return (
    <>
      <Section tone="dark">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
            {fmt(page.heroTitleTpl, { trade: t.name })}
          </h1>
          <p className="mt-5 text-lg text-brand-100 sm:text-xl">{t.blurb}</p>
          <div className="mt-8">
            <ButtonLink href={hrefFor("signUp", locale)}>{dict.common.getStarted}</ButtonLink>
          </div>
        </div>
      </Section>

      <Section>
        <SectionHeading title={page.templatesTitle} sub={page.templatesSub} />
        <ul className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-3">
          {t.examples.map((example) => (
            <li key={example} className="rounded-full border border-brand-200 bg-brand-50 px-5 py-2.5 font-medium text-brand-800">
              {example}
            </li>
          ))}
        </ul>
      </Section>

      <Section tone="gray">
        <SectionHeading title={page.toolsTitle} sub={page.toolsSub} />
        <div className="mx-auto grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {PRODUCTS.map((p) => {
            const tool = dict.tools[p.code];
            return (
              <Link
                key={p.code}
                href={hrefFor(`tool:${p.code}`, locale)}
                className="group rounded-2xl border border-slate-200 bg-white p-6 transition-shadow hover:shadow-md"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
                  <ToolIcon code={p.code} className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-bold text-slate-900">{tool.name}</h3>
                <p className="mt-2 text-sm text-slate-600">{tool.tagline}</p>
              </Link>
            );
          })}
          <Link
            href={hrefFor("jobTracker", locale)}
            className="group rounded-2xl border-2 border-emerald-200 bg-emerald-50/60 p-6 transition-shadow hover:shadow-md"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <TableIcon className="h-5 w-5" />
            </div>
            <h3 className="mt-4 flex items-center gap-2 font-bold text-slate-900">
              {dict.jobTracker.name}
              <Badge tone="green">{dict.jobTracker.badge}</Badge>
            </h3>
            <p className="mt-2 text-sm text-slate-600">{dict.jobTracker.tagline}</p>
          </Link>
        </div>
      </Section>

      <Section>
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold text-slate-900">{page.ctaTitle}</h2>
          <p className="mt-4 text-lg text-slate-600">{page.ctaSub}</p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <ButtonLink href={hrefFor("signUp", locale)}>{dict.ctaBanner.ctaPrimary}</ButtonLink>
            <ButtonLink href={hrefFor("pricing", locale)} variant="secondary">
              {dict.common.seePricing}
            </ButtonLink>
          </div>
        </div>
      </Section>
    </>
  );
}

/* ---------- Auth previews (§7.1 /sign-in, /sign-up) ---------- */

function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <Section tone="gray" className="min-h-[70vh]">
      <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">{children}</div>
    </Section>
  );
}

function DisabledField({ label, type }: { label: string; type: string }) {
  const id = `field-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-slate-700">
        {label}
      </label>
      <input
        id={id}
        type={type}
        disabled
        className="mt-1.5 block w-full cursor-not-allowed rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-500"
      />
    </div>
  );
}

export function SignInPage({ locale, dict }: { locale: Locale; dict: Dict }) {
  const a = dict.auth.signIn;
  return (
    <AuthShell>
      <h1 className="text-2xl font-bold text-slate-900">{a.title}</h1>
      <p className="mt-2 text-slate-600">{a.sub}</p>
      <p className="mt-4 rounded-xl bg-brand-50 px-4 py-3 text-sm font-medium text-brand-800">{a.note}</p>
      <form className="mt-6 space-y-4" aria-disabled="true">
        <DisabledField label={a.email} type="email" />
        <DisabledField label={a.password} type="password" />
        <button type="button" disabled className="w-full cursor-not-allowed rounded-xl bg-slate-300 px-6 py-3 font-semibold text-slate-600">
          {a.submit}
        </button>
      </form>
      <div className="my-5 flex items-center gap-3 text-sm text-slate-400">
        <span className="h-px flex-1 bg-slate-200" aria-hidden="true" />
        {a.divider}
        <span className="h-px flex-1 bg-slate-200" aria-hidden="true" />
      </div>
      <button type="button" disabled className="w-full cursor-not-allowed rounded-xl border border-slate-300 bg-slate-50 px-6 py-3 font-semibold text-slate-500">
        {a.google}
      </button>
      <button type="button" disabled className="mt-3 w-full cursor-not-allowed rounded-xl border border-slate-300 bg-slate-50 px-6 py-3 font-semibold text-slate-500">
        {a.magic}
      </button>
      <p className="mt-6 text-center text-sm text-slate-600">
        {a.noAccount}{" "}
        <Link href={hrefFor("signUp", locale)} className="font-semibold text-brand-700 hover:text-brand-800">
          {a.switchLink}
        </Link>
      </p>
    </AuthShell>
  );
}

export function SignUpPage({ locale, dict }: { locale: Locale; dict: Dict }) {
  const a = dict.auth.signUp;
  return (
    <AuthShell>
      <h1 className="text-2xl font-bold text-slate-900">{a.title}</h1>
      <p className="mt-2 text-slate-600">{a.sub}</p>
      <ul className="mt-4 space-y-1.5">
        {a.perks.map((perk) => (
          <li key={perk} className="flex items-center gap-2 text-sm text-slate-700">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
            {perk}
          </li>
        ))}
      </ul>
      <p className="mt-4 rounded-xl bg-brand-50 px-4 py-3 text-sm font-medium text-brand-800">{a.note}</p>
      <form className="mt-6 space-y-4" aria-disabled="true">
        <DisabledField label={a.email} type="email" />
        <DisabledField label={a.password} type="password" />
        <button type="button" disabled className="w-full cursor-not-allowed rounded-xl bg-slate-300 px-6 py-3 font-semibold text-slate-600">
          {a.submit}
        </button>
      </form>
      <div className="my-5 flex items-center gap-3 text-sm text-slate-400">
        <span className="h-px flex-1 bg-slate-200" aria-hidden="true" />
        {a.divider}
        <span className="h-px flex-1 bg-slate-200" aria-hidden="true" />
      </div>
      <button type="button" disabled className="w-full cursor-not-allowed rounded-xl border border-slate-300 bg-slate-50 px-6 py-3 font-semibold text-slate-500">
        {a.google}
      </button>
      <p className="mt-6 text-center text-sm text-slate-600">
        {a.hasAccount}{" "}
        <Link href={hrefFor("signIn", locale)} className="font-semibold text-brand-700 hover:text-brand-800">
          {a.switchLink}
        </Link>
      </p>
    </AuthShell>
  );
}
