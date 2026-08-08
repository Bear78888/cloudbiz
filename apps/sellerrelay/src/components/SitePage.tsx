import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Box,
  Boxes,
  Building2,
  Camera,
  Check,
  CircleDollarSign,
  ClipboardCheck,
  Clock3,
  FileCheck2,
  Globe2,
  Handshake,
  Languages,
  MapPin,
  PackageCheck,
  PackageOpen,
  RefreshCw,
  ScanLine,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Tags,
  Truck,
  Warehouse,
} from "lucide-react";
import { copy, routeLabel, type Locale, type PageSlug } from "@/lib/content";
import { FlowIllustration } from "@/components/FlowIllustration";
import { LeadForm } from "@/components/LeadForm";
import { QuoteForm } from "@/components/QuoteForm";
import { ThankYou } from "@/components/ThankYou";

const serviceIcons = [PackageOpen, ClipboardCheck, Tags, Box, Boxes, Warehouse, Truck, RefreshCw];
const standardIcons = [FileCheck2, PackageCheck, ScanLine, ShieldAlert, Camera, Truck];

function QuoteLink({ locale, children, intent = "custom_quote", secondary = false, event }: { locale: Locale; children: React.ReactNode; intent?: string; secondary?: boolean; event?: string }) {
  return <Link href={`/${locale}/get-a-quote?intent=${intent}`} className={`button${secondary ? " button-secondary" : ""}`} data-event={event || (intent === "pilot_shipment" ? "pilot_shipment_click" : "custom_quote_click")}>{children}<ArrowRight aria-hidden="true" /></Link>;
}

function Breadcrumbs({ locale, slug }: { locale: Locale; slug: PageSlug }) {
  if (!slug) return null;
  const ru = locale === "ru";
  return (
    <nav className="breadcrumbs shell" aria-label={ru ? "Хлебные крошки" : "Breadcrumbs"}>
      <Link href={`/${locale}`}>{routeLabel[locale][""]}</Link><span aria-hidden="true">/</span><span aria-current="page">{routeLabel[locale][slug]}</span>
    </nav>
  );
}

function InnerHero({ eyebrow, title, text, children }: { eyebrow: string; title: string; text: string; children?: React.ReactNode }) {
  return (
    <section className="inner-hero">
      <div className="shell narrow">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="lead">{text}</p>
        {children}
      </div>
    </section>
  );
}

function Warning({ children }: { children: React.ReactNode }) {
  return <div className="critical-alert"><ShieldAlert aria-hidden="true" /><strong>{children}</strong></div>;
}

function FaqList({ locale, limit }: { locale: Locale; limit?: number }) {
  const c = copy[locale];
  const faqs = limit ? c.faqs.slice(0, limit) : c.faqs;
  return <div className="faq-list">{faqs.map((faq, index) => <details key={faq.question} data-event="faq_expand"><summary><span>{String(index + 1).padStart(2, "0")}</span>{faq.question}<b aria-hidden="true">+</b></summary><div><p>{faq.answer}</p></div></details>)}</div>;
}

function HomePage({ locale }: { locale: Locale }) {
  const c = copy[locale];
  const ru = locale === "ru";
  return (
    <>
      <section className="home-hero">
        <div className="hero-noise" aria-hidden="true" />
        <div className="shell hero-grid">
          <div className="hero-copy">
            <p className="eyebrow light">{c.hero.eyebrow}</p>
            <h1>{c.hero.title}</h1>
            <p className="hero-lead">{c.hero.subtitle}</p>
            <div className="button-row"><QuoteLink locale={locale}>{ru ? "Получить персональный расчёт" : "Get a Custom Quote"}</QuoteLink><QuoteLink locale={locale} intent="pilot_shipment" secondary>{c.common.startPilot}</QuoteLink></div>
            <ul className="trust-list">{c.hero.trust.map((item) => <li key={item}><Check aria-hidden="true" />{item}</li>)}</ul>
          </div>
          <FlowIllustration labels={c.flow} />
        </div>
      </section>

      <section className="process-ribbon" aria-label={ru ? "Путь товара" : "Inventory flow"}>
        <div className="shell process-ribbon-inner">{c.flow.map((item, index) => <div key={item}><span>{index + 1}</span><strong>{item}</strong>{index < c.flow.length - 1 && <ArrowRight aria-hidden="true" />}</div>)}</div>
      </section>

      <section className="section" id="about">
        <div className="shell">
          <div className="section-heading split"><div><p className="eyebrow">{ru ? "ФИЗИЧЕСКАЯ РАБОТА В США" : "THE PHYSICAL U.S. WORKFLOW"}</p><h2>{c.intro.title}</h2></div><p>{c.intro.text}</p></div>
          <div className="three-column process-columns">{c.intro.columns.map((column, index) => <article key={column.title}><span className="number-tag">0{index + 1}</span><h3>{column.title}</h3><ul className="check-list">{column.bullets.map((item) => <li key={item}><Check aria-hidden="true" />{item}</li>)}</ul></article>)}</div>
        </div>
      </section>

      <section className="section section-muted" id="services">
        <div className="shell">
          <div className="section-heading centered"><p className="eyebrow">{ru ? "ПОЛНЫЙ PREP-ПРОЦЕСС" : "COMPLETE PREP WORKFLOW"}</p><h2>{c.servicesTitle}</h2><p>{ru ? "От приёмки до отправки и обработки возвратов — один согласованный процесс и одна точка коммуникации." : "From receiving through outbound forwarding and returns — one approved workflow and one point of communication."}</p></div>
          <div className="service-grid">{c.services.map((service, index) => { const Icon = serviceIcons[index]; return <article className="service-card" key={service.id}><div className="icon-tile"><Icon aria-hidden="true" /></div><h3>{service.title}</h3><p>{service.short}</p><Link href={`/${locale}/services#${service.id}`}>{c.common.learnMore}<ArrowRight aria-hidden="true" /></Link></article>; })}</div>
        </div>
      </section>

      <section className="section dark-section">
        <div className="shell">
          <div className="section-heading centered light"><p className="eyebrow light">{ru ? "ПОНЯТНЫЙ ПРОЦЕСС" : "A CLEAR PROCESS"}</p><h2>{c.sixStepsTitle}</h2></div>
          <div className="steps-grid">{c.sixSteps.map((item, index) => <article key={item.title}><span>{String(index + 1).padStart(2, "0")}</span><h3>{item.title}</h3><p>{item.text}</p></article>)}</div>
          <Warning>{c.common.noShipWarning}</Warning>
          <div className="button-row centered"><QuoteLink locale={locale}>{c.common.getQuote}</QuoteLink><Link className="text-link light-link" href={`/${locale}/how-it-works`}>{ru ? "Посмотреть весь процесс" : "See the complete workflow"}<ArrowRight aria-hidden="true" /></Link></div>
        </div>
      </section>

      <section className="section language-section">
        <div className="shell two-column align-center">
          <div className="language-visual" aria-hidden="true"><div><Languages /><span>EN</span><span>RU</span></div><div className="message-bubble one">SKU · FNSKU · prep</div><div className="message-bubble two">{ru ? "Понятные инструкции" : "Clear instructions"}</div></div>
          <div><p className="eyebrow">{ru ? "БЕЗ ЯЗЫКОВОГО БАРЬЕРА" : "NO LANGUAGE BARRIER"}</p><h2>{c.language.title}</h2><p className="lead-small">{c.language.text}</p><ul className="check-list two-col-list">{c.language.bullets.map((item) => <li key={item}><Check aria-hidden="true" />{item}</li>)}</ul><QuoteLink locale={locale}>{c.language.cta}</QuoteLink></div>
        </div>
      </section>

      <section className="section section-muted geography-section">
        <div className="shell two-column align-center">
          <div><p className="eyebrow">{ru ? "КАЛИФОРНИЯ → МЕЖДУНАРОДНЫЕ ПРОДАВЦЫ" : "CALIFORNIA → INTERNATIONAL SELLERS"}</p><h2>{c.geography.title}</h2><p className="lead-small">{c.geography.text}</p><Link className="text-link" href={`/${locale}/international-sellers`}>{ru ? "Для международных продавцов" : "Explore international seller support"}<ArrowRight aria-hidden="true" /></Link></div>
          <div className="world-card"><Globe2 aria-hidden="true" /><div className="california-pin"><MapPin aria-hidden="true" /><strong>California</strong><span>SellerRelay operations</span></div><div className="world-lines" aria-hidden="true"><i /><i /><i /></div></div>
        </div>
      </section>

      <section className="section">
        <div className="shell">
          <div className="section-heading centered"><p className="eyebrow">{ru ? "СТАНДАРТ КАЖДОЙ ПАРТИИ" : "EVERY APPROVED SHIPMENT"}</p><h2>{c.standards.title}</h2></div>
          <div className="standards-grid">{c.standards.cards.map((card, index) => { const Icon = standardIcons[index]; return <article key={card.title}><Icon aria-hidden="true" /><h3>{card.title}</h3><p>{card.text}</p></article>; })}</div>
        </div>
      </section>

      <section className="section pilot-section">
        <div className="shell pilot-card"><div><p className="eyebrow light">{ru ? "НАЧНИТЕ С МАЛОГО" : "START SMALL"}</p><h2>{c.pilot.title}</h2><p>{c.pilot.subtitle}</p><ul>{c.pilot.bullets.map((item) => <li key={item}><Check aria-hidden="true" />{item}</li>)}</ul><small>{c.pilot.note}</small></div><div className="pilot-box-stack" aria-hidden="true"><Box /><Box /><Sparkles /></div><QuoteLink locale={locale} intent="pilot_shipment">{c.pilot.cta}</QuoteLink></div>
      </section>

      <section className="section section-muted">
        <div className="shell">
          <div className="section-heading split"><div><p className="eyebrow">{ru ? "ДЛЯ АГЕНТСТВ" : "FOR AGENCIES"}</p><h2>{c.agenciesTeaser.title}</h2></div><p>{c.agenciesTeaser.subtitle}</p></div>
          <div className="three-column model-cards">{c.agenciesTeaser.models.map((model, index) => <article key={model.title}><span>0{index + 1}</span><h3>{model.title}</h3><p>{model.text}</p></article>)}</div>
          <div className="button-row centered"><Link href={`/${locale}/agencies`} className="button">{c.agenciesTeaser.cta}<ArrowRight aria-hidden="true" /></Link></div>
        </div>
      </section>

      <section className="section">
        <div className="shell narrow-large"><div className="section-heading centered"><p className="eyebrow">FAQ</p><h2>{c.faqTitle}</h2></div><FaqList locale={locale} limit={8} /><div className="button-row centered"><Link href={`/${locale}/faq`} className="text-link">{c.common.viewAll}<ArrowRight aria-hidden="true" /></Link></div></div>
      </section>

      <section className="final-cta"><div className="shell final-cta-inner"><div><p className="eyebrow light">{ru ? "ПОЛУЧИТЕ ПЕРСОНАЛЬНЫЙ ПРОЦЕСС" : "MAP YOUR U.S. WORKFLOW"}</p><h2>{c.finalCta.title}</h2><p>{c.finalCta.text}</p><small>{c.finalCta.note}</small></div><QuoteLink locale={locale}>{c.common.getQuote}</QuoteLink></div></section>
    </>
  );
}

function ServicesPage({ locale }: { locale: Locale }) {
  const c = copy[locale]; const ru = locale === "ru";
  const headings = ru ? ["Что входит", "Что предоставляет клиент", "Что вы получаете", "Дополнительные операции", "Требует согласования"] : ["What is included", "What the client provides", "What you receive", "Additional operations", "Requires prior approval"];
  return <><InnerHero eyebrow={ru ? "УСЛУГИ" : "SERVICES"} title={c.servicesTitle} text={ru ? "Каждая услуга включается в письменный план работ для конкретной согласованной партии. Итоговый объём зависит от товара, документов и требований направления." : "Every service is placed into a written plan for a specific approved shipment. Final scope depends on the product, documentation, and destination requirements."}><QuoteLink locale={locale}>{c.common.requestQuote}</QuoteLink></InnerHero><section className="section"><div className="shell service-detail-list">{c.services.map((service, index) => { const Icon = serviceIcons[index]; const blocks = [service.includes, service.clientProvides, service.result, service.extras, service.approval]; return <article id={service.id} key={service.id} className="service-detail"><div className="service-detail-heading"><div className="icon-tile large"><Icon aria-hidden="true" /></div><div><span>0{index + 1}</span><h2>{service.title}</h2><p>{service.short}</p></div></div><div className="service-detail-grid">{blocks.map((items, blockIndex) => <div key={headings[blockIndex]}><h3>{headings[blockIndex]}</h3><ul className="check-list">{items.map((item) => <li key={item}><Check aria-hidden="true" />{item}</li>)}</ul></div>)}</div><QuoteLink locale={locale}>{c.common.requestQuote}</QuoteLink></article>; })}<div className="recommendation-card"><Sparkles aria-hidden="true" /><div><h2>{ru ? "Не уверены, какие операции нужны?" : "Not sure which services you need?"}</h2><p>{ru ? "Отправьте информацию о товаре и требования маркетплейса — мы предложим подходящий процесс." : "Send us your product details and current marketplace requirements. We will recommend the appropriate workflow."}</p></div><QuoteLink locale={locale}>{c.common.getQuote}</QuoteLink></div></div></section></>;
}

function HowPage({ locale }: { locale: Locale }) {
  const c = copy[locale]; const ru = locale === "ru";
  return <><InnerHero eyebrow={ru ? "КАК ЭТО РАБОТАЕТ" : "HOW IT WORKS"} title={c.howItWorks.title} text={c.howItWorks.intro}><QuoteLink locale={locale}>{c.common.getQuote}</QuoteLink></InnerHero><section className="section"><div className="shell narrow-large"><div className="long-timeline">{c.howItWorks.steps.map((item, index) => <div key={item.title} className="timeline-row"><span>{String(index + 1).padStart(2, "0")}</span><div><h2>{item.title}</h2><p>{item.text}</p>{[3, 7, 10].includes(index) && <QuoteLink locale={locale} secondary>{c.common.getQuote}</QuoteLink>}</div></div>)}</div><Warning>{c.common.noShipWarning}</Warning><div className="notes-card"><h2>{c.howItWorks.notesTitle}</h2><ul className="check-list">{c.howItWorks.notes.map((item) => <li key={item}><ShieldCheck aria-hidden="true" />{item}</li>)}</ul></div><div className="button-row centered"><QuoteLink locale={locale}>{c.common.getQuote}</QuoteLink></div></div></section></>;
}

function PricingPage({ locale }: { locale: Locale }) {
  const c = copy[locale]; const ru = locale === "ru";
  const icons = [PackageCheck, RefreshCw, Handshake];
  return <><InnerHero eyebrow={ru ? "СТОИМОСТЬ" : "PRICING"} title={c.pricing.title} text={c.pricing.intro} /><section className="section pricing-section" data-event="pricing_view"><div className="shell"><div className="pricing-grid">{c.pricing.plans.map((plan, index) => { const Icon = icons[index]; return <article className={index === 1 ? "featured" : ""} key={plan.name}><div className="pricing-icon"><Icon aria-hidden="true" /></div><h2>{plan.name}</h2><p>{plan.audience}</p><ul className="check-list">{plan.items.map((item) => <li key={item}><Check aria-hidden="true" />{item}</li>)}</ul><QuoteLink locale={locale} intent={plan.intent}>{plan.cta}</QuoteLink></article>; })}</div><div className="price-factors"><div><p className="eyebrow">{ru ? "ИНДИВИДУАЛЬНЫЙ РАСЧЁТ" : "CUSTOM QUOTATION"}</p><h2>{c.pricing.factorsTitle}</h2><p>{c.pricing.disclaimer}</p></div><div className="factor-cloud">{c.pricing.factors.map((factor) => <span key={factor}>{factor}</span>)}</div></div></div></section></>;
}

function InternationalPage({ locale }: { locale: Locale }) {
  const c = copy[locale]; const ru = locale === "ru";
  const icons = [Globe2, ShieldCheck, Building2, CircleDollarSign, PackageCheck, Languages];
  return <><InnerHero eyebrow={ru ? "МЕЖДУНАРОДНЫМ ПРОДАВЦАМ" : "INTERNATIONAL SELLERS"} title={c.international.title} text={c.international.lead}><QuoteLink locale={locale}>{c.common.getQuote}</QuoteLink></InnerHero><section className="section"><div className="shell"><div className="point-grid">{c.international.points.map((point, index) => { const Icon = icons[index % icons.length]; return <article key={point.title}><Icon aria-hidden="true" /><h2>{point.title}</h2><p>{point.text}</p></article>; })}</div><div className="regions-card"><div><p className="eyebrow">{ru ? "ГЕОГРАФИЯ" : "REGIONS"}</p><h2>{c.international.regionsTitle}</h2><p>{c.common.availability}</p></div><div>{c.international.regions.map((region) => <span key={region}>{region}</span>)}</div></div><div className="account-control-card"><BadgeCheck aria-hidden="true" /><div><h2>{ru ? "Вы сохраняете контроль" : "You keep control"}</h2><p>{ru ? "Вы сохраняете контроль над аккаунтом продавца и выплатами маркетплейса. SellerRelay управляет физическим процессом работы с согласованным товаром в США." : "You keep control of your seller account and marketplace payouts. SellerRelay manages the physical U.S. workflow for approved inventory."}</p></div></div><div className="button-row centered"><QuoteLink locale={locale}>{c.common.getQuote}</QuoteLink></div></div></section></>;
}

function AgenciesPage({ locale }: { locale: Locale }) {
  const c = copy[locale]; const ru = locale === "ru"; const icons = [Handshake, Building2, Sparkles];
  return <><InnerHero eyebrow={ru ? "АГЕНТСТВАМ" : "FOR AGENCIES"} title={c.agencies.title} text={c.agencies.lead} /><section className="section section-muted"><div className="shell"><div className="agency-model-grid">{c.agencies.models.map((model, index) => { const Icon = icons[index]; return <article key={model.title}><Icon aria-hidden="true" /><h2>{model.title}</h2><p>{model.text}</p><ul className="check-list">{model.items.map((item) => <li key={item}><Check aria-hidden="true" />{item}</li>)}</ul></article>; })}</div></div></section><section className="section"><div className="shell narrow-large"><div className="section-heading centered"><p className="eyebrow">{ru ? "ПАРТНЁРСКИЙ ЗАПРОС" : "PARTNERSHIP REQUEST"}</p><h2>{c.agencies.formTitle}</h2><p>{ru ? "Опишите портфель клиентов и нужный формат — мы предложим операционную модель после проверки." : "Describe your client portfolio and preferred format. We will propose an operating model after review."}</p></div><LeadForm locale={locale} type="agency" /></div></section></>;
}

function FaqPage({ locale }: { locale: Locale }) {
  const c = copy[locale]; const ru = locale === "ru";
  return <><InnerHero eyebrow="FAQ" title={c.faqTitle} text={ru ? "Ответы описывают стандартный процесс. Возможность обслуживания конкретного продавца и товара подтверждается только после проверки." : "These answers describe the standard workflow. Availability for a specific seller and product is confirmed only after review."} /><section className="section"><div className="shell narrow-large"><FaqList locale={locale} /><div className="button-row centered"><QuoteLink locale={locale}>{c.common.getQuote}</QuoteLink></div></div></section></>;
}

function QuotePage({ locale, intent }: { locale: Locale; intent?: string }) {
  const c = copy[locale]; const ru = locale === "ru";
  const safeIntent = intent === "pilot_shipment" || intent === "agency" ? intent : "custom_quote";
  return <><InnerHero eyebrow={safeIntent === "pilot_shipment" ? (ru ? "ТЕСТОВАЯ ПАРТИЯ" : "PILOT SHIPMENT") : (ru ? "ПЕРСОНАЛЬНЫЙ РАСЧЁТ" : "CUSTOM QUOTE")} title={safeIntent === "pilot_shipment" ? c.pilot.title : (ru ? "Расскажите о товаре и предполагаемой поставке" : "Tell us about your product and planned shipment")} text={ru ? "Форма займёт несколько минут. Укажите доступные данные — размеры и вес можно дополнить после первичного обращения." : "The form takes a few minutes. Share the information available now; dimensions and weight can be added after the initial request."} /><section className="section quote-section"><div className="shell narrow-form"><QuoteForm locale={locale} initialIntent={safeIntent} /></div></section></>;
}

function ContactPage({ locale }: { locale: Locale }) {
  const c = copy[locale]; const ru = locale === "ru"; const contactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim();
  return <><InnerHero eyebrow={ru ? "КОНТАКТЫ" : "CONTACT"} title={c.contact.title} text={c.contact.intro} /><section className="section"><div className="shell contact-grid"><aside><div className="contact-card"><MapPin aria-hidden="true" /><h2>SellerRelay Logistics</h2><p>California, United States</p></div>{contactEmail && <div className="contact-card"><Languages aria-hidden="true" /><h2>{ru ? "Рабочий email" : "Working email"}</h2><a href={`mailto:${contactEmail}`} data-event="email_click">{contactEmail}</a></div>}<div className="contact-card"><ShieldCheck aria-hidden="true" /><h2>{ru ? "Адрес приёмки" : "Receiving address"}</h2><p>{ru ? "Выдаётся только после проверки и письменного согласования конкретной партии." : "Assigned only after a specific product and shipment are reviewed and approved in writing."}</p></div><p className="privacy-note">{c.contact.privacy}</p></aside><div><h2>{c.contact.formTitle}</h2><LeadForm locale={locale} type="contact" /></div></div></section></>;
}

function RestrictedPage({ locale }: { locale: Locale }) {
  const c = copy[locale]; const ru = locale === "ru";
  return <><InnerHero eyebrow={ru ? "ПРЕДВАРИТЕЛЬНАЯ ПРОВЕРКА" : "PRELIMINARY REVIEW"} title={c.restricted.title} text={c.restricted.intro}><QuoteLink locale={locale}>{c.common.getQuote}</QuoteLink></InnerHero><section className="section"><div className="shell narrow-large"><div className="restricted-grid">{c.restricted.categories.map((item) => <div key={item}><ShieldAlert aria-hidden="true" />{item}</div>)}</div><div className="review-card"><ClipboardCheck aria-hidden="true" /><div><h2>{c.restricted.reviewTitle}</h2><p>{c.restricted.reviewText}</p></div></div><div className="not-accepted"><h2>{c.restricted.notAcceptedTitle}</h2><ul>{c.restricted.notAccepted.map((item) => <li key={item}>{item}</li>)}</ul></div><Warning>{c.common.noShipWarning}</Warning></div></section></>;
}

function LegalPage({ locale, type }: { locale: Locale; type: "privacy" | "terms" }) {
  const c = copy[locale][type]; const ru = locale === "ru";
  return <><InnerHero eyebrow={ru ? "ЮРИДИЧЕСКИЙ ЧЕРНОВИК" : "LEGAL DRAFT"} title={c.title} text={c.updated} /><section className="section legal-section"><div className="shell narrow-large"><div className="legal-notice"><ShieldCheck aria-hidden="true" /><p>{ru ? "Этот рабочий текст описывает текущую модель MVP и требует проверки лицензированным специалистом перед масштабной рекламой или регулируемыми поставками." : "This working text reflects the current MVP model and requires review by licensed counsel before scaled advertising or regulated shipments."}</p></div>{c.sections.map((section) => <section key={section.title}><h2>{section.title}</h2>{section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}{section.bullets && <ul>{section.bullets.map((item) => <li key={item}>{item}</li>)}</ul>}</section>)}</div></section></>;
}

export function SitePage({ locale, slug, intent, requestNumber }: { locale: Locale; slug: PageSlug; intent?: string; requestNumber?: string }) {
  let page: React.ReactNode;
  switch (slug) {
    case "": page = <HomePage locale={locale} />; break;
    case "services": page = <ServicesPage locale={locale} />; break;
    case "how-it-works": page = <HowPage locale={locale} />; break;
    case "pricing": page = <PricingPage locale={locale} />; break;
    case "international-sellers": page = <InternationalPage locale={locale} />; break;
    case "agencies": page = <AgenciesPage locale={locale} />; break;
    case "faq": page = <FaqPage locale={locale} />; break;
    case "get-a-quote": page = <QuotePage locale={locale} intent={intent} />; break;
    case "contact": page = <ContactPage locale={locale} />; break;
    case "restricted-products": page = <RestrictedPage locale={locale} />; break;
    case "privacy": page = <LegalPage locale={locale} type="privacy" />; break;
    case "terms": page = <LegalPage locale={locale} type="terms" />; break;
    case "thank-you": page = <section className="section thank-you-section"><div className="shell narrow-large"><ThankYou locale={locale} requestNumber={requestNumber} /></div></section>; break;
  }
  return <><Breadcrumbs locale={locale} slug={slug} />{page}</>;
}
