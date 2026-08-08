import { DAYS, telHref } from "@/features/profile/model";
import { type Dict } from "@/lib/i18n";
import type { Locale } from "@/lib/routes";

import type { SiteBlock } from "./model";
import { serviceAreaLine, type RenderableSite } from "./render";
import { layoutFor, paletteFor } from "./theme";

/**
 * The contractor's website (§19.4).
 *
 * The rule that governs every line of this file: **this page carries the
 * tradesperson's brand and nothing of ours.** No "HandyAlliance", no "Job
 * Tracker", no link to our sign-in, no footer credit, no badge. The same rule
 * the customer's copy of an estimate follows (§5f) and for the same reason —
 * it is their business's page, sent to their customer, and an advertisement
 * stapled to it is one we did not ask permission to run.
 *
 * The second rule is §19.8: nothing on this page is invented. A block with no
 * content does not appear at all (`visibleBlocks` decided that already), rather
 * than appearing filled with plausible words about licences, reviews or areas
 * the business never claimed.
 */
export function SiteView({
  site,
  dict,
  /** Where the language switch points. Absent in the preview, which has no public URLs. */
  hrefForLocale,
}: {
  site: RenderableSite;
  dict: Dict;
  hrefForLocale?: (locale: Locale) => string;
}) {
  const p = dict.publicSite;
  const palette = paletteFor(site.colorPreset);
  const layout = layoutFor(site.template);
  const has = (block: SiteBlock) => site.blocks.includes(block);

  const areaLine = serviceAreaLine(site.serviceArea);
  const dayNames = dict.platform.businessProfile.days;

  return (
    <div className="mx-auto w-full max-w-3xl">
      {/* Hero (§19.4 block 1). The business's name is the masthead — there is
          no other brand on this page. */}
      <header className={`${palette.band} ${palette.bandText} ${layout.heroPadding} ${layout.heroAlign}`}>
        <p className="text-sm font-semibold uppercase tracking-widest opacity-90">
          {site.businessName}
        </p>
        <h1 className={`mt-3 ${layout.heroTitle}`}>{site.headline}</h1>
        {site.subheadline ? (
          <p className={`mt-3 text-lg ${palette.bandMuted}`}>{site.subheadline}</p>
        ) : null}

        <div
          className={`mt-6 flex flex-wrap gap-3 ${layout.heroAlign === "text-center" ? "justify-center" : ""}`}
        >
          <a
            href="#contact"
            className={`inline-flex min-h-12 items-center rounded-xl px-6 font-semibold ${palette.button}`}
          >
            {site.ctaText ?? p.defaultCta}
          </a>
          {/* Call button (§19.4 block 10). Absent entirely when there is no
              number — a button that dials nothing is worse than no button. */}
          {has("call_button") && site.phone ? (
            <a
              href={telHref(site.phone)}
              className="inline-flex min-h-12 items-center rounded-xl bg-white/95 px-6 font-semibold text-slate-900 hover:bg-white"
            >
              {p.callNow}: {site.phone}
            </a>
          ) : null}
        </div>

        {/* Language switch (§19.5). Only ever to a language this site is
            actually offered in. */}
        {hrefForLocale && site.otherLocales.length > 0 ? (
          <nav aria-label={p.languageLabel} className="mt-6 flex flex-wrap gap-3 text-sm">
            {site.otherLocales.map((other) => (
              <a
                key={other}
                href={hrefForLocale(other)}
                lang={other === "es" ? "es-US" : "en-US"}
                className={`underline ${palette.bandMuted} hover:opacity-80`}
              >
                {p.localeNames[other]}
              </a>
            ))}
          </nav>
        ) : null}
      </header>

      <main>
        {has("services") ? (
          <section className={layout.sectionPadding} aria-labelledby="services-heading">
            <h2 id="services-heading" className={`text-xl font-bold ${palette.heading}`}>
              {p.servicesTitle}
            </h2>
            <ul className={`mt-4 ${layout.servicesGrid}`}>
              {site.services.map((service) => (
                <li key={service} className={`${layout.serviceItem} ${palette.border} ${palette.heading}`}>
                  {service}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {has("why_choose_us") ? (
          <section className={`${palette.panel} ${layout.sectionPadding}`} aria-labelledby="why-heading">
            <h2 id="why-heading" className={`text-xl font-bold ${palette.heading}`}>
              {p.whyTitle}
            </h2>
            <ul className="mt-4 space-y-2">
              {site.whyChooseUs.map((reason) => (
                <li key={reason} className="flex gap-3 text-slate-800">
                  <span aria-hidden="true">•</span>
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {has("about") && site.aboutText ? (
          <section className={layout.sectionPadding} aria-labelledby="about-heading">
            <h2 id="about-heading" className={`text-xl font-bold ${palette.heading}`}>
              {p.aboutTitle}
            </h2>
            {/* Paragraphs preserved as typed. Rendered as text nodes, never as
                markup: this is owner-supplied content on a public page. */}
            {site.aboutText.split(/\n{2,}/).map((paragraph, index) => (
              <p key={index} className="mt-3 whitespace-pre-line text-slate-800">
                {paragraph}
              </p>
            ))}
          </section>
        ) : null}

        {has("reviews") && site.googleReviewUrl ? (
          <section className={`${palette.panel} ${layout.sectionPadding}`} aria-labelledby="reviews-heading">
            <h2 id="reviews-heading" className={`text-xl font-bold ${palette.heading}`}>
              {p.reviewsTitle}
            </h2>
            {/* No review text, no star count, no testimonial. §19.8 forbids
                fabricated reviews, and the only honest thing we hold is a link
                to where the real ones live. */}
            <p className="mt-3 text-slate-800">{p.reviewsBody}</p>
            <a
              href={site.googleReviewUrl}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className={`mt-4 inline-flex min-h-12 items-center rounded-xl px-6 font-semibold ${palette.buttonOutline}`}
            >
              {p.reviewsCta}
            </a>
          </section>
        ) : null}

        {has("service_area") && areaLine !== "" ? (
          <section className={layout.sectionPadding} aria-labelledby="area-heading">
            <h2 id="area-heading" className={`text-xl font-bold ${palette.heading}`}>
              {p.serviceAreaTitle}
            </h2>
            <p className="mt-3 text-slate-800">{areaLine}</p>
            {site.serviceAreaNote ? (
              <p className="mt-2 text-slate-600">{site.serviceAreaNote}</p>
            ) : null}
          </section>
        ) : null}

        {has("faq") ? (
          <section className={`${palette.panel} ${layout.sectionPadding}`} aria-labelledby="faq-heading">
            <h2 id="faq-heading" className={`text-xl font-bold ${palette.heading}`}>
              {p.faqTitle}
            </h2>
            <dl className="mt-4 space-y-4">
              {site.faq.map((entry) => (
                <div key={entry.question}>
                  <dt className="font-semibold text-slate-900">{entry.question}</dt>
                  <dd className="mt-1 whitespace-pre-line text-slate-800">{entry.answer}</dd>
                </div>
              ))}
            </dl>
          </section>
        ) : null}

        {/* Contact (§19.4 block 9). The lead form itself arrives with §19.7;
            until then this block is the contact details, which is what the
            block is *for* — an empty form would be the invented content this
            page is careful about. */}
        {has("contact_form") ? (
          <section id="contact" className={layout.sectionPadding} aria-labelledby="contact-heading">
            <h2 id="contact-heading" className={`text-xl font-bold ${palette.heading}`}>
              {p.contactTitle}
            </h2>
            <ul className="mt-4 space-y-3 text-slate-800">
              {site.phone ? (
                <li>
                  <a href={telHref(site.phone)} className="font-semibold underline">
                    {site.phone}
                  </a>
                </li>
              ) : null}
              {site.email ? (
                <li>
                  <a href={`mailto:${site.email}`} className="font-semibold underline">
                    {site.email}
                  </a>
                </li>
              ) : null}
            </ul>

            {DAYS.some((day) => site.hours[day] !== undefined) ? (
              <>
                <h3 className="mt-6 text-sm font-bold uppercase tracking-wide text-slate-500">
                  {p.hoursTitle}
                </h3>
                <dl className="mt-2 space-y-1 text-sm text-slate-800">
                  {DAYS.filter((day) => site.hours[day] !== undefined).map((day) => {
                    const hours = site.hours[day];
                    return (
                      <div key={day} className="flex justify-between gap-4">
                        <dt>{dayNames[day]}</dt>
                        <dd>{hours ? `${hours.open} – ${hours.close}` : p.closed}</dd>
                      </div>
                    );
                  })}
                </dl>
              </>
            ) : null}
          </section>
        ) : null}
      </main>

      {/* Footer (§19.4 block 11). The business's own name and year. No credit,
          no badge, no link back to us — see the note at the top of this file. */}
      <footer className={`${palette.band} ${palette.bandText} px-4 py-8 text-sm`}>
        <p className="font-semibold">{site.businessName}</p>
        {site.ownerName ? <p className={`mt-1 ${palette.bandMuted}`}>{site.ownerName}</p> : null}
        {areaLine !== "" ? <p className={`mt-1 ${palette.bandMuted}`}>{areaLine}</p> : null}
        <p className={`mt-3 ${palette.bandMuted}`}>© {new Date().getFullYear()} {site.businessName}</p>
      </footer>
    </div>
  );
}
