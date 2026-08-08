"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, FileText, LoaderCircle, ShieldCheck, UploadCloud, X } from "lucide-react";
import type { Locale } from "@/lib/content";
import { trackEvent } from "@/components/Analytics";
import { TurnstileWidget } from "@/components/TurnstileWidget";

type QuoteState = {
  contact: {
    firstName: string; lastName: string; company: string; email: string; phone: string; messenger: string; country: string; preferredLanguage: Locale; timezone: string;
  };
  selling: {
    amazonStatus: string; marketplaces: string[]; monthlyVolume: string; numberOfSkus: string; firstUSShipment: string; currentPrepCenter: string; readiness: string;
  };
  product: {
    category: string; description: string; brand: string; manufactureCountry: string; supplierCountry: string; totalUnits: string; numberOfSkus: string; cartonsPallets: string; unitDimensions: string; unitWeight: string; cartonDimensions: string; arrivalDate: string;
  };
  services: string[];
  flags: string[];
  final: {
    heardFrom: string; message: string; contactMethod: string; callRequested: boolean; intent: "custom_quote" | "pilot_shipment" | "agency"; accurate: boolean; approvalUnderstood: boolean; termsAccepted: boolean;
  };
  tracking: {
    utmSource: string; utmMedium: string; utmCampaign: string; utmContent: string; utmTerm: string; referrer: string; landingPage: string; language: Locale; timestamp: string; deviceCategory: string; consentVersion: string; turnstileToken: string; website: string;
  };
};

type ErrorMap = Record<string, string>;

const STORAGE_KEY = "sellerrelay:quote-progress:v1";
const CONSENT_VERSION = "2026-08-05";

function initialState(locale: Locale, intent: QuoteState["final"]["intent"]): QuoteState {
  return {
    contact: { firstName: "", lastName: "", company: "", email: "", phone: "", messenger: "", country: "", preferredLanguage: locale, timezone: "" },
    selling: { amazonStatus: "", marketplaces: [], monthlyVolume: "", numberOfSkus: "", firstUSShipment: "", currentPrepCenter: "", readiness: "" },
    product: { category: "", description: "", brand: "", manufactureCountry: "", supplierCountry: "", totalUnits: "", numberOfSkus: "", cartonsPallets: "", unitDimensions: "", unitWeight: "", cartonDimensions: "", arrivalDate: "" },
    services: [],
    flags: [],
    final: { heardFrom: "", message: "", contactMethod: "", callRequested: false, intent, accurate: false, approvalUnderstood: false, termsAccepted: false },
    tracking: { utmSource: "", utmMedium: "", utmCampaign: "", utmContent: "", utmTerm: "", referrer: "", landingPage: "", language: locale, timestamp: new Date().toISOString(), deviceCategory: "", consentVersion: CONSENT_VERSION, turnstileToken: "", website: "" },
  };
}

const englishSteps = ["Contact", "Selling Status", "Product", "Services", "Product Flags", "Files", "Final Details"];
const russianSteps = ["Контакт", "Статус продаж", "Товар", "Услуги", "Особенности", "Файлы", "Финальные сведения"];

function required(locale: Locale) { return locale === "ru" ? "Обязательное поле" : "Required field"; }

function Field({ label, error, hint, children, requiredField = false }: { label: string; error?: string; hint?: string; children: React.ReactNode; requiredField?: boolean }) {
  return (
    <label className={`form-field ${error ? "has-error" : ""}`}>
      <span>{label}{requiredField && <span aria-hidden="true"> *</span>}</span>
      {children}
      {hint && <small>{hint}</small>}
      {error && <small className="field-error" role="alert">{error}</small>}
    </label>
  );
}

function CheckboxGroup({ legend, options, values, onChange, error, columns = 2 }: { legend: string; options: string[]; values: string[]; onChange: (next: string[]) => void; error?: string; columns?: number }) {
  return (
    <fieldset className={`choice-fieldset ${error ? "has-error" : ""}`}>
      <legend>{legend}</legend>
      <div className={`choice-grid columns-${columns}`}>
        {options.map((option) => (
          <label className="choice-card" key={option}>
            <input type="checkbox" checked={values.includes(option)} onChange={() => onChange(values.includes(option) ? values.filter((v) => v !== option) : [...values, option])} />
            <span className="choice-check"><Check aria-hidden="true" /></span>
            <span>{option}</span>
          </label>
        ))}
      </div>
      {error && <p className="field-error" role="alert">{error}</p>}
    </fieldset>
  );
}

export function QuoteForm({ locale, initialIntent = "custom_quote" }: { locale: Locale; initialIntent?: QuoteState["final"]["intent"] }) {
  const router = useRouter();
  const [state, setState] = useState<QuoteState>(() => initialState(locale, initialIntent));
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<ErrorMap>({});
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [serverMessage, setServerMessage] = useState("");
  const started = useRef(false);
  const submitted = useRef(false);
  const t = locale === "en";
  const steps = t ? englishSteps : russianSteps;

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<QuoteState>;
        setState((current) => ({
          ...current,
          ...parsed,
          contact: { ...current.contact, ...parsed.contact, preferredLanguage: locale },
          final: { ...current.final, ...parsed.final, intent: initialIntent },
          tracking: { ...current.tracking, ...parsed.tracking, language: locale },
        }));
      }
      const params = new URLSearchParams(window.location.search);
      setState((current) => ({
        ...current,
        tracking: {
          ...current.tracking,
          utmSource: params.get("utm_source") || current.tracking.utmSource,
          utmMedium: params.get("utm_medium") || current.tracking.utmMedium,
          utmCampaign: params.get("utm_campaign") || current.tracking.utmCampaign,
          utmContent: params.get("utm_content") || current.tracking.utmContent,
          utmTerm: params.get("utm_term") || current.tracking.utmTerm,
          referrer: document.referrer,
          landingPage: window.location.href,
          timestamp: new Date().toISOString(),
          deviceCategory: window.innerWidth < 768 ? "mobile" : window.innerWidth < 1100 ? "tablet" : "desktop",
        },
      }));
    } catch { /* corrupted session data is ignored */ }
  }, [initialIntent, locale]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const safeState = { ...state, tracking: { ...state.tracking, turnstileToken: "", website: "" } };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(safeState));
    }, 150);
    return () => window.clearTimeout(timer);
  }, [state]);

  useEffect(() => {
    const onPageHide = () => {
      if (started.current && !submitted.current) trackEvent("form_abandonment", { step: step + 1, intent: state.final.intent });
    };
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, [state.final.intent, step]);

  const markStarted = () => {
    if (!started.current) {
      started.current = true;
      trackEvent("quote_start", { intent: state.final.intent, language: locale });
    }
  };

  const updateSection = <K extends keyof QuoteState>(section: K, values: Partial<QuoteState[K]>) => {
    markStarted();
    setState((current) => ({ ...current, [section]: { ...(current[section] as object), ...values } }));
  };

  const validateStep = useCallback((index: number) => {
    const next: ErrorMap = {};
    if (index === 0) {
      if (!state.contact.firstName.trim()) next.firstName = required(locale);
      if (!state.contact.lastName.trim()) next.lastName = required(locale);
      if (!/^\S+@\S+\.\S+$/.test(state.contact.email)) next.email = t ? "Enter a valid email" : "Укажите корректный email";
      if (!state.contact.phone.trim()) next.phone = required(locale);
      if (!state.contact.country.trim()) next.country = required(locale);
    }
    if (index === 1) {
      if (!state.selling.amazonStatus) next.amazonStatus = required(locale);
      if (!state.selling.marketplaces.length) next.marketplaces = t ? "Select at least one marketplace" : "Выберите минимум один маркетплейс";
      if (!state.selling.monthlyVolume) next.monthlyVolume = required(locale);
      if (!state.selling.numberOfSkus) next.sellingSkus = required(locale);
      if (!state.selling.firstUSShipment) next.firstUSShipment = required(locale);
      if (!state.selling.currentPrepCenter) next.currentPrepCenter = required(locale);
      if (!state.selling.readiness) next.readiness = required(locale);
    }
    if (index === 2) {
      if (!state.product.category.trim()) next.category = required(locale);
      if (!state.product.description.trim()) next.description = required(locale);
      if (!state.product.manufactureCountry.trim()) next.manufactureCountry = required(locale);
      if (!state.product.supplierCountry.trim()) next.supplierCountry = required(locale);
      if (!state.product.totalUnits.trim()) next.totalUnits = required(locale);
      if (!state.product.numberOfSkus.trim()) next.productSkus = required(locale);
    }
    if (index === 3 && !state.services.length) next.services = t ? "Select at least one service" : "Выберите минимум одну услугу";
    if (index === 4 && !state.flags.length) next.flags = t ? "Select “None of the above” when no flags apply" : "Выберите «Ничего из перечисленного», если особенностей нет";
    if (index === 6) {
      if (!state.final.contactMethod) next.contactMethod = required(locale);
      if (!state.final.accurate) next.accurate = t ? "Confirmation is required" : "Нужно подтверждение";
      if (!state.final.approvalUnderstood) next.approvalUnderstood = t ? "Confirmation is required" : "Нужно подтверждение";
      if (!state.final.termsAccepted) next.termsAccepted = t ? "Accept the Privacy Policy and Terms" : "Примите Политику конфиденциальности и Условия";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }, [locale, state, t]);

  const nextStep = () => {
    if (!validateStep(step)) {
      document.querySelector(".has-error")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    trackEvent("quote_step_complete", { step: step + 1, intent: state.final.intent });
    setStep((current) => Math.min(current + 1, steps.length - 1));
    setErrors({});
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const previousStep = () => {
    setStep((current) => Math.max(0, current - 1));
    setErrors({});
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleFiles = (incoming: FileList | null) => {
    markStarted();
    if (!incoming) return;
    const accepted = Array.from(incoming).slice(0, 5);
    setFiles(accepted);
    trackEvent("file_upload", { count: accepted.length });
  };

  const submit = async () => {
    if (!validateStep(6) || submitting) return;
    setSubmitting(true);
    setServerMessage("");
    try {
      const body = new FormData();
      body.append("payload", JSON.stringify(state));
      files.forEach((file) => body.append("files", file));
      const response = await fetch("/api/quote", { method: "POST", body });
      const result = (await response.json()) as { ok?: boolean; message?: string; requestNumber?: string; contactMethod?: string };
      if (!response.ok || !result.ok || !result.requestNumber) throw new Error(result.message || (t ? "Unable to save the request." : "Не удалось сохранить заявку."));
      submitted.current = true;
      trackEvent("quote_submit", { intent: state.final.intent, language: locale, services: state.services.length });
      sessionStorage.removeItem(STORAGE_KEY);
      sessionStorage.setItem("sellerrelay:lastSubmission", JSON.stringify({ requestNumber: result.requestNumber, contactMethod: result.contactMethod, category: state.product.category, totalUnits: state.product.totalUnits, services: state.services, intent: state.final.intent }));
      router.push(`/${locale}/thank-you?request=${encodeURIComponent(result.requestNumber)}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : (t ? "Unable to save the request." : "Не удалось сохранить заявку.");
      setServerMessage(message);
      trackEvent("quote_error", { step: 7, message: message.slice(0, 120) });
    } finally {
      setSubmitting(false);
    }
  };

  const progress = ((step + 1) / steps.length) * 100;
  const serviceOptions = t
    ? ["Receiving", "Count verification", "Visual inspection", "Sample inspection", "Photo report", "FNSKU labeling", "Polybagging", "Bubble wrap", "Bundling", "Kitting", "Repackaging", "Storage", "FBA forwarding", "Removal orders", "Returns processing", "DTC fulfillment", "Not sure — recommend a workflow"]
    : ["Приёмка", "Проверка количества", "Визуальная инспекция", "Выборочная инспекция", "Фотоотчёт", "Маркировка FNSKU", "Polybagging", "Bubble wrap", "Наборы", "Комплектация", "Переупаковка", "Хранение", "Отправка на FBA", "Removal orders", "Обработка возвратов", "DTC fulfillment", "Не уверен — предложите процесс"];
  const flagOptions = t
    ? ["Batteries", "Liquids", "Aerosols", "Food", "Supplements", "Cosmetics", "Medical claims", "Children’s products", "Chemicals", "Hazardous or regulated materials", "Branded resale inventory", "High-value products", "None of the above"]
    : ["Батареи", "Жидкости", "Аэрозоли", "Еда", "БАДы", "Косметика", "Медицинские заявления", "Детские товары", "Химикаты", "Опасные или регулируемые материалы", "Branded resale inventory", "Дорогие товары", "Ничего из перечисленного"];

  const riskSelected = useMemo(() => state.flags.some((flag) => !flag.toLowerCase().includes("none") && !flag.toLowerCase().includes("ничего")), [state.flags]);
  const handleTurnstileToken = useCallback((token: string) => {
    setState((current) => ({ ...current, tracking: { ...current.tracking, turnstileToken: token } }));
  }, []);

  return (
    <div className="quote-shell" onFocusCapture={markStarted}>
      <div className="quote-progress" aria-label={t ? "Form progress" : "Прогресс формы"}>
        <div className="progress-heading"><span>{t ? `Step ${step + 1} of ${steps.length}` : `Шаг ${step + 1} из ${steps.length}`}</span><strong>{steps[step]}</strong></div>
        <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
        <ol>{steps.map((label, index) => <li key={label} className={index === step ? "current" : index < step ? "complete" : ""}><span>{index < step ? <Check aria-hidden="true" /> : index + 1}</span><small>{label}</small></li>)}</ol>
      </div>

      <div className="quote-card">
        {step === 0 && (
          <section aria-labelledby="quote-step-contact">
            <div className="form-section-heading"><span>01</span><div><h2 id="quote-step-contact">{t ? "Contact" : "Контакт"}</h2><p>{t ? "Who should receive the quote and shipment questions?" : "Кому отправить расчёт и вопросы по поставке?"}</p></div></div>
            <div className="form-grid two">
              <Field label={t ? "First name" : "Имя"} error={errors.firstName} requiredField><input value={state.contact.firstName} onChange={(e) => updateSection("contact", { firstName: e.target.value })} autoComplete="given-name" /></Field>
              <Field label={t ? "Last name" : "Фамилия"} error={errors.lastName} requiredField><input value={state.contact.lastName} onChange={(e) => updateSection("contact", { lastName: e.target.value })} autoComplete="family-name" /></Field>
              <Field label={t ? "Company" : "Компания"}><input value={state.contact.company} onChange={(e) => updateSection("contact", { company: e.target.value })} autoComplete="organization" /></Field>
              <Field label={t ? "Work email" : "Email"} error={errors.email} requiredField><input type="email" value={state.contact.email} onChange={(e) => updateSection("contact", { email: e.target.value })} autoComplete="email" inputMode="email" /></Field>
              <Field label={t ? "Phone" : "Телефон"} error={errors.phone} requiredField><input type="tel" value={state.contact.phone} onChange={(e) => updateSection("contact", { phone: e.target.value })} autoComplete="tel" /></Field>
              <Field label={t ? "WhatsApp or Telegram" : "WhatsApp или Telegram"}><input value={state.contact.messenger} onChange={(e) => updateSection("contact", { messenger: e.target.value })} /></Field>
              <Field label={t ? "Country" : "Страна"} error={errors.country} requiredField><input value={state.contact.country} onChange={(e) => updateSection("contact", { country: e.target.value })} autoComplete="country-name" /></Field>
              <Field label={t ? "Preferred language" : "Предпочитаемый язык"} requiredField><select value={state.contact.preferredLanguage} onChange={(e) => updateSection("contact", { preferredLanguage: e.target.value as Locale })}><option value="en">English</option><option value="ru">Русский</option></select></Field>
              <Field label={t ? "Time zone" : "Часовой пояс"} hint={t ? "Optional — for easier scheduling" : "Необязательно — для удобной связи"}><input value={state.contact.timezone} onChange={(e) => updateSection("contact", { timezone: e.target.value })} placeholder="UTC+4 / Pacific Time" /></Field>
            </div>
          </section>
        )}

        {step === 1 && (
          <section aria-labelledby="quote-step-selling">
            <div className="form-section-heading"><span>02</span><div><h2 id="quote-step-selling">{t ? "Selling status" : "Статус продаж"}</h2><p>{t ? "This helps us understand your marketplace workflow and readiness." : "Это помогает понять ваш процесс и готовность к отправке."}</p></div></div>
            <div className="form-grid two">
              <Field label={t ? "Do you currently sell on Amazon?" : "Вы уже продаёте на Amazon?"} error={errors.amazonStatus} requiredField><select value={state.selling.amazonStatus} onChange={(e) => updateSection("selling", { amazonStatus: e.target.value })}><option value="">—</option><option>Yes</option><option>No</option><option>Account in progress</option></select></Field>
              <Field label={t ? "Monthly unit volume" : "Единиц в месяц"} error={errors.monthlyVolume} requiredField><select value={state.selling.monthlyVolume} onChange={(e) => updateSection("selling", { monthlyVolume: e.target.value })}><option value="">—</option><option>1–100</option><option>101–500</option><option>501–2,000</option><option>2,001–10,000</option><option>10,000+</option><option>{t ? "Not selling yet" : "Пока не продаю"}</option></select></Field>
              <Field label={t ? "Number of SKUs" : "Количество SKU"} error={errors.sellingSkus} requiredField><input value={state.selling.numberOfSkus} onChange={(e) => updateSection("selling", { numberOfSkus: e.target.value })} inputMode="numeric" /></Field>
              <Field label={t ? "Is this your first U.S. shipment?" : "Это первая поставка в США?"} error={errors.firstUSShipment} requiredField><select value={state.selling.firstUSShipment} onChange={(e) => updateSection("selling", { firstUSShipment: e.target.value })}><option value="">—</option><option>Yes</option><option>No</option></select></Field>
              <Field label={t ? "Do you currently use a U.S. prep center?" : "Сейчас используете prep-центр в США?"} error={errors.currentPrepCenter} requiredField><select value={state.selling.currentPrepCenter} onChange={(e) => updateSection("selling", { currentPrepCenter: e.target.value })}><option value="">—</option><option>Yes</option><option>No</option></select></Field>
              <Field label={t ? "When are you ready to ship?" : "Когда готовы отправить?"} error={errors.readiness} requiredField><select value={state.selling.readiness} onChange={(e) => updateSection("selling", { readiness: e.target.value })}><option value="">—</option><option>Within 2 weeks</option><option>Within 30 days</option><option>Within 60–90 days</option><option>Researching only</option></select></Field>
            </div>
            <CheckboxGroup legend={t ? "Marketplaces *" : "Маркетплейсы *"} options={["Amazon", "Walmart", "Shopify", "eBay", "Etsy", "TikTok Shop", t ? "Other" : "Другое"]} values={state.selling.marketplaces} onChange={(marketplaces) => updateSection("selling", { marketplaces })} error={errors.marketplaces} columns={3} />
          </section>
        )}

        {step === 2 && (
          <section aria-labelledby="quote-step-product">
            <div className="form-section-heading"><span>03</span><div><h2 id="quote-step-product">{t ? "Product and shipment" : "Товар и поставка"}</h2><p>{t ? "Give us enough detail to screen the product and estimate the workflow." : "Укажите данные для проверки товара и оценки процесса."}</p></div></div>
            <div className="form-grid two">
              <Field label={t ? "Product category" : "Категория товара"} error={errors.category} requiredField><input value={state.product.category} onChange={(e) => updateSection("product", { category: e.target.value })} /></Field>
              <Field label={t ? "Brand name" : "Бренд"}><input value={state.product.brand} onChange={(e) => updateSection("product", { brand: e.target.value })} /></Field>
              <Field label={t ? "Country of manufacture" : "Страна производства"} error={errors.manufactureCountry} requiredField><input value={state.product.manufactureCountry} onChange={(e) => updateSection("product", { manufactureCountry: e.target.value })} /></Field>
              <Field label={t ? "Supplier country" : "Страна поставщика"} error={errors.supplierCountry} requiredField><input value={state.product.supplierCountry} onChange={(e) => updateSection("product", { supplierCountry: e.target.value })} /></Field>
              <Field label={t ? "Total units" : "Всего единиц"} error={errors.totalUnits} requiredField><input value={state.product.totalUnits} onChange={(e) => updateSection("product", { totalUnits: e.target.value })} inputMode="numeric" /></Field>
              <Field label={t ? "Number of SKUs" : "Количество SKU"} error={errors.productSkus} requiredField><input value={state.product.numberOfSkus} onChange={(e) => updateSection("product", { numberOfSkus: e.target.value })} inputMode="numeric" /></Field>
              <Field label={t ? "Cartons or pallets" : "Коробки или паллеты"}><input value={state.product.cartonsPallets} onChange={(e) => updateSection("product", { cartonsPallets: e.target.value })} /></Field>
              <Field label={t ? "Estimated arrival date" : "Ожидаемая дата поступления"}><input type="date" value={state.product.arrivalDate} onChange={(e) => updateSection("product", { arrivalDate: e.target.value })} /></Field>
              <Field label={t ? "Unit dimensions" : "Размер единицы"} hint={t ? "Recommended: L × W × H and unit" : "Рекомендуется: Д × Ш × В и единица"}><input value={state.product.unitDimensions} onChange={(e) => updateSection("product", { unitDimensions: e.target.value })} placeholder="20 × 10 × 5 cm" /></Field>
              <Field label={t ? "Unit weight" : "Вес единицы"} hint={t ? "Recommended" : "Рекомендуется указать"}><input value={state.product.unitWeight} onChange={(e) => updateSection("product", { unitWeight: e.target.value })} placeholder="0.8 kg" /></Field>
              <Field label={t ? "Carton dimensions" : "Размер коробки"} hint={t ? "Recommended" : "Рекомендуется указать"}><input value={state.product.cartonDimensions} onChange={(e) => updateSection("product", { cartonDimensions: e.target.value })} /></Field>
            </div>
            <Field label={t ? "Product description" : "Описание товара"} error={errors.description} requiredField><textarea rows={6} value={state.product.description} onChange={(e) => updateSection("product", { description: e.target.value })} placeholder={t ? "What is the product, how is it packaged, and what should we check?" : "Что это за товар, как он упакован и что нужно проверить?"} /></Field>
          </section>
        )}

        {step === 3 && (
          <section aria-labelledby="quote-step-services">
            <div className="form-section-heading"><span>04</span><div><h2 id="quote-step-services">{t ? "Required services" : "Необходимые услуги"}</h2><p>{t ? "Select everything you may need. We will recommend a final workflow after review." : "Выберите всё, что может понадобиться. Финальный процесс предложим после проверки."}</p></div></div>
            <CheckboxGroup legend={t ? "Services *" : "Услуги *"} options={serviceOptions} values={state.services} onChange={(services) => { updateSection("tracking", {}); setState((current) => ({ ...current, services })); }} error={errors.services} columns={2} />
          </section>
        )}

        {step === 4 && (
          <section aria-labelledby="quote-step-flags">
            <div className="form-section-heading"><span>05</span><div><h2 id="quote-step-flags">{t ? "Product flags" : "Особенности товара"}</h2><p>{t ? "These categories may require documentation or separate written approval." : "Для этих категорий могут потребоваться документы или отдельное письменное согласование."}</p></div></div>
            <CheckboxGroup legend={t ? "Select all that apply *" : "Выберите всё подходящее *"} options={flagOptions} values={state.flags} onChange={(flags) => { markStarted(); const none = flags.find((value) => value.toLowerCase().includes("none") || value.toLowerCase().includes("ничего")); setState((current) => ({ ...current, flags: none ? [none] : flags.filter((value) => !value.toLowerCase().includes("none") && !value.toLowerCase().includes("ничего")) })); }} error={errors.flags} columns={2} />
            {riskSelected && <div className="form-notice"><ShieldCheck aria-hidden="true" /><p>{t ? "This category may require additional review and documentation. You can still submit the request." : "Эта категория может потребовать дополнительной проверки и документов. Вы всё равно можете отправить заявку."}</p></div>}
          </section>
        )}

        {step === 5 && (
          <section aria-labelledby="quote-step-files">
            <div className="form-section-heading"><span>06</span><div><h2 id="quote-step-files">{t ? "Supporting files" : "Файлы"}</h2><p>{t ? "Optional files can make the first review more accurate." : "Необязательные файлы помогут точнее провести первичную проверку."}</p></div></div>
            <label className="upload-zone">
              <UploadCloud aria-hidden="true" />
              <strong>{t ? "Upload product photos or documents" : "Загрузите фото товара или документы"}</strong>
              <span>{t ? "PDF, JPG, PNG, XLSX, CSV, DOCX — up to 10 MB each, maximum 5 files" : "PDF, JPG, PNG, XLSX, CSV, DOCX — до 10 МБ каждый, максимум 5 файлов"}</span>
              <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.xlsx,.csv,.docx" onChange={(e) => handleFiles(e.target.files)} />
            </label>
            {files.length > 0 && <div className="file-list">{files.map((file, index) => <div key={`${file.name}-${file.lastModified}`}><FileText aria-hidden="true" /><span><strong>{file.name}</strong><small>{(file.size / 1024 / 1024).toFixed(2)} MB</small></span><button type="button" onClick={() => setFiles((current) => current.filter((_, i) => i !== index))} aria-label={t ? `Remove ${file.name}` : `Удалить ${file.name}`}><X aria-hidden="true" /></button></div>)}</div>}
            <div className="form-notice neutral"><ShieldCheck aria-hidden="true" /><p>{t ? "Do not upload passports, bank documents, passwords, executable files, or information unrelated to the shipment." : "Не загружайте паспорта, банковские документы, пароли, исполняемые файлы или данные, не относящиеся к поставке."}</p></div>
          </section>
        )}

        {step === 6 && (
          <section aria-labelledby="quote-step-final">
            <div className="form-section-heading"><span>07</span><div><h2 id="quote-step-final">{t ? "Final details" : "Финальные сведения"}</h2><p>{t ? "Choose how to continue after the shipment review." : "Выберите, как продолжить после проверки поставки."}</p></div></div>
            <div className="form-grid two">
              <Field label={t ? "How did you hear about us?" : "Как вы узнали о нас?"}><select value={state.final.heardFrom} onChange={(e) => updateSection("final", { heardFrom: e.target.value })}><option value="">—</option><option>Google</option><option>Social media</option><option>Referral</option><option>Agency</option><option>Community</option><option>Other</option></select></Field>
              <Field label={t ? "Preferred contact method" : "Предпочтительный способ связи"} error={errors.contactMethod} requiredField><select value={state.final.contactMethod} onChange={(e) => updateSection("final", { contactMethod: e.target.value })}><option value="">—</option><option>Email</option><option>Phone</option><option>WhatsApp</option><option>Telegram</option></select></Field>
            </div>
            <Field label={t ? "Additional message" : "Дополнительное сообщение"}><textarea rows={5} value={state.final.message} onChange={(e) => updateSection("final", { message: e.target.value })} /></Field>
            <label className="switch-row"><input type="checkbox" checked={state.final.callRequested} onChange={(e) => updateSection("final", { callRequested: e.target.checked })} /><span className="switch" /><span>{t ? "I would like a 15-minute call" : "Я хочу 15-минутный звонок"}</span></label>
            <div className="consent-list">
              <label className={errors.accurate ? "has-error" : ""}><input type="checkbox" checked={state.final.accurate} onChange={(e) => updateSection("final", { accurate: e.target.checked })} /><span>{t ? "I confirm that the information provided is accurate." : "Я подтверждаю, что предоставленная информация верна."}</span>{errors.accurate && <small className="field-error">{errors.accurate}</small>}</label>
              <label className={errors.approvalUnderstood ? "has-error" : ""}><input type="checkbox" checked={state.final.approvalUnderstood} onChange={(e) => updateSection("final", { approvalUnderstood: e.target.checked })} /><span>{t ? "I understand that the shipment must be approved before it is sent." : "Я понимаю, что поставку необходимо согласовать до отправки."}</span>{errors.approvalUnderstood && <small className="field-error">{errors.approvalUnderstood}</small>}</label>
              <label className={errors.termsAccepted ? "has-error" : ""}><input type="checkbox" checked={state.final.termsAccepted} onChange={(e) => updateSection("final", { termsAccepted: e.target.checked })} /><span>{t ? <>I agree to the <a href={`/${locale}/privacy`} target="_blank">Privacy Policy</a> and <a href={`/${locale}/terms`} target="_blank">Terms of Service</a>.</> : <>Я принимаю <a href={`/${locale}/privacy`} target="_blank">Политику конфиденциальности</a> и <a href={`/${locale}/terms`} target="_blank">Условия обслуживания</a>.</>}</span>{errors.termsAccepted && <small className="field-error">{errors.termsAccepted}</small>}</label>
            </div>
            <div className="honeypot" aria-hidden="true"><label>Website<input tabIndex={-1} autoComplete="off" value={state.tracking.website} onChange={(e) => updateSection("tracking", { website: e.target.value })} /></label></div>
            <TurnstileWidget locale={locale} onToken={handleTurnstileToken} />
            {serverMessage && <div className="form-server-error" role="alert">{serverMessage}</div>}
            <div className="submit-security"><ShieldCheck aria-hidden="true" /><span>{t ? "Your request is sent through a server-validated endpoint. Files are accepted only in approved formats." : "Заявка отправляется через endpoint с серверной проверкой. Файлы принимаются только в разрешённых форматах."}</span></div>
          </section>
        )}

        <div className="form-navigation">
          {step > 0 ? <button type="button" className="button button-secondary" onClick={previousStep}><ArrowLeft aria-hidden="true" />{t ? "Back" : "Назад"}</button> : <span />}
          {step < steps.length - 1 ? <button type="button" className="button" onClick={nextStep}>{t ? "Continue" : "Продолжить"}<ArrowRight aria-hidden="true" /></button> : <button type="button" className="button" disabled={submitting} onClick={submit}>{submitting ? <><LoaderCircle className="spin" aria-hidden="true" />{t ? "Saving…" : "Сохраняем…"}</> : <>{t ? "Request My Quote" : "Получить мой расчёт"}<ArrowRight aria-hidden="true" /></>}</button>}
        </div>
      </div>
    </div>
  );
}
