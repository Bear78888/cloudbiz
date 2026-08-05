"use client";

import { useCallback, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, LoaderCircle, ShieldCheck } from "lucide-react";
import type { Locale } from "@/lib/content";
import { trackEvent } from "@/components/Analytics";
import { TurnstileWidget } from "@/components/TurnstileWidget";

type LeadType = "contact" | "agency";
type FieldErrors = Record<string, string>;

const agencyServiceOptions = [
  "Receiving",
  "Inspection",
  "FNSKU labeling",
  "Packaging",
  "Bundling & kitting",
  "Storage & replenishment",
  "FBA forwarding",
  "Removals & returns",
  "White-label reporting",
];

function tracking(locale: Locale, turnstileToken: string, website: string) {
  const params = typeof window === "undefined" ? new URLSearchParams() : new URLSearchParams(window.location.search);
  return {
    utmSource: params.get("utm_source") || "",
    utmMedium: params.get("utm_medium") || "",
    utmCampaign: params.get("utm_campaign") || "",
    referrer: typeof document === "undefined" ? "" : document.referrer,
    landingPage: typeof window === "undefined" ? "" : window.location.href,
    timestamp: new Date().toISOString(),
    turnstileToken,
    website,
    language: locale,
  };
}

export function LeadForm({ locale, type }: { locale: Locale; type: LeadType }) {
  const ru = locale === "ru";
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [successNumber, setSuccessNumber] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [turnstileToken, setTurnstileToken] = useState("");
  const [website, setWebsite] = useState("");
  const [contact, setContact] = useState({ name: "", email: "", topic: "", message: "", language: locale });
  const [agency, setAgency] = useState({
    agencyName: "", website: "", contactPerson: "", email: "", phone: "", countriesServed: "", activeSellers: "", monthlyUnits: "", requiredServices: [] as string[], partnershipModel: "", whiteLabel: "", message: "",
  });

  const required = ru ? "Обязательное поле" : "Required field";
  const serviceOptions = useMemo(
    () => ru
      ? ["Приёмка", "Инспекция", "Маркировка FNSKU", "Упаковка", "Наборы и комплектация", "Хранение и пополнение", "Отправка на FBA", "Removal orders и возвраты", "White-label отчётность"]
      : agencyServiceOptions,
    [ru],
  );
  const handleTurnstile = useCallback((token: string) => setTurnstileToken(token), []);

  function validate() {
    const next: FieldErrors = {};
    if (type === "contact") {
      if (!contact.name.trim()) next.name = required;
      if (!/^\S+@\S+\.\S+$/.test(contact.email)) next.email = ru ? "Укажите корректный email" : "Enter a valid email";
      if (!contact.topic) next.topic = required;
      if (!contact.message.trim()) next.message = required;
    } else {
      if (!agency.agencyName.trim()) next.agencyName = required;
      if (!agency.contactPerson.trim()) next.contactPerson = required;
      if (!/^\S+@\S+\.\S+$/.test(agency.email)) next.email = ru ? "Укажите корректный email" : "Enter a valid email";
      if (!agency.phone.trim()) next.phone = required;
      if (!agency.countriesServed.trim()) next.countriesServed = required;
      if (!agency.activeSellers) next.activeSellers = required;
      if (!agency.monthlyUnits) next.monthlyUnits = required;
      if (!agency.requiredServices.length) next.requiredServices = ru ? "Выберите минимум одну услугу" : "Select at least one service";
      if (!agency.partnershipModel) next.partnershipModel = required;
      if (!agency.whiteLabel) next.whiteLabel = required;
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || !validate()) return;
    setSubmitting(true);
    setMessage("");
    try {
      const payload = type === "contact"
        ? { type, locale, fields: contact, tracking: tracking(locale, turnstileToken, website) }
        : { type, locale, fields: agency, tracking: tracking(locale, turnstileToken, website) };
      const response = await fetch("/api/lead", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = (await response.json()) as { ok?: boolean; requestNumber?: string; message?: string };
      if (!response.ok || !result.ok || !result.requestNumber) throw new Error(result.message || (ru ? "Не удалось сохранить сообщение." : "Unable to save the message."));
      setSuccessNumber(result.requestNumber);
      trackEvent(type === "agency" ? "agency_form_submit" : "contact_form_submit", { language: locale });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : (ru ? "Не удалось сохранить сообщение." : "Unable to save the message."));
    } finally {
      setSubmitting(false);
    }
  }

  if (successNumber) {
    return (
      <div className="form-success" role="status" aria-live="polite">
        <CheckCircle2 aria-hidden="true" />
        <div>
          <h2>{ru ? "Сообщение получено" : "Message received"}</h2>
          <p>{ru ? "Ваш номер обращения:" : "Your request number:"} <strong>{successNumber}</strong></p>
          <p>{ru ? "Мы проверим информацию и свяжемся с вами по указанному email." : "We will review the information and contact you at the email provided."}</p>
        </div>
      </div>
    );
  }

  const fieldClass = (name: string) => `form-field ${errors[name] ? "has-error" : ""}`;
  const error = (name: string) => errors[name] ? <small className="field-error" role="alert">{errors[name]}</small> : null;

  return (
    <form className="lead-form" onSubmit={submit} noValidate>
      {type === "contact" ? (
        <>
          <div className="form-grid two">
            <label className={fieldClass("name")}><span>{ru ? "Имя" : "Name"} *</span><input value={contact.name} onChange={(e) => setContact((v) => ({ ...v, name: e.target.value }))} autoComplete="name" />{error("name")}</label>
            <label className={fieldClass("email")}><span>Email *</span><input type="email" value={contact.email} onChange={(e) => setContact((v) => ({ ...v, email: e.target.value }))} autoComplete="email" />{error("email")}</label>
          </div>
          <div className="form-grid two">
            <label className={fieldClass("topic")}><span>{ru ? "Тема" : "Topic"} *</span><select value={contact.topic} onChange={(e) => setContact((v) => ({ ...v, topic: e.target.value }))}><option value="">—</option><option>Shipment quote</option><option>Existing shipment</option><option>Agency partnership</option><option>Warehouse partnership</option><option>General question</option></select>{error("topic")}</label>
            <label className="form-field"><span>{ru ? "Язык ответа" : "Response language"}</span><select value={contact.language} onChange={(e) => setContact((v) => ({ ...v, language: e.target.value as Locale }))}><option value="en">English</option><option value="ru">Русский</option></select></label>
          </div>
          <label className={fieldClass("message")}><span>{ru ? "Сообщение" : "Message"} *</span><textarea rows={7} value={contact.message} onChange={(e) => setContact((v) => ({ ...v, message: e.target.value }))} />{error("message")}</label>
        </>
      ) : (
        <>
          <div className="form-grid two">
            <label className={fieldClass("agencyName")}><span>{ru ? "Название агентства" : "Agency name"} *</span><input value={agency.agencyName} onChange={(e) => setAgency((v) => ({ ...v, agencyName: e.target.value }))} />{error("agencyName")}</label>
            <label className="form-field"><span>{ru ? "Сайт" : "Website"}</span><input type="url" value={agency.website} onChange={(e) => setAgency((v) => ({ ...v, website: e.target.value }))} placeholder="https://" /></label>
            <label className={fieldClass("contactPerson")}><span>{ru ? "Контактное лицо" : "Contact person"} *</span><input value={agency.contactPerson} onChange={(e) => setAgency((v) => ({ ...v, contactPerson: e.target.value }))} autoComplete="name" />{error("contactPerson")}</label>
            <label className={fieldClass("email")}><span>{ru ? "Рабочий email" : "Work email"} *</span><input type="email" value={agency.email} onChange={(e) => setAgency((v) => ({ ...v, email: e.target.value }))} autoComplete="email" />{error("email")}</label>
            <label className={fieldClass("phone")}><span>{ru ? "Телефон" : "Phone"} *</span><input type="tel" value={agency.phone} onChange={(e) => setAgency((v) => ({ ...v, phone: e.target.value }))} autoComplete="tel" />{error("phone")}</label>
            <label className={fieldClass("countriesServed")}><span>{ru ? "Страны клиентов" : "Countries served"} *</span><input value={agency.countriesServed} onChange={(e) => setAgency((v) => ({ ...v, countriesServed: e.target.value }))} />{error("countriesServed")}</label>
            <label className={fieldClass("activeSellers")}><span>{ru ? "Активные продавцы" : "Active sellers"} *</span><select value={agency.activeSellers} onChange={(e) => setAgency((v) => ({ ...v, activeSellers: e.target.value }))}><option value="">—</option><option>1–5</option><option>6–20</option><option>21–50</option><option>51–100</option><option>100+</option></select>{error("activeSellers")}</label>
            <label className={fieldClass("monthlyUnits")}><span>{ru ? "Ориентировочные единицы в месяц" : "Estimated monthly units"} *</span><select value={agency.monthlyUnits} onChange={(e) => setAgency((v) => ({ ...v, monthlyUnits: e.target.value }))}><option value="">—</option><option>Under 1,000</option><option>1,000–5,000</option><option>5,001–20,000</option><option>20,001–100,000</option><option>100,000+</option></select>{error("monthlyUnits")}</label>
          </div>
          <fieldset className={`choice-fieldset ${errors.requiredServices ? "has-error" : ""}`}><legend>{ru ? "Необходимые услуги" : "Required services"} *</legend><div className="choice-grid columns-3">{serviceOptions.map((service) => <label className="choice-card" key={service}><input type="checkbox" checked={agency.requiredServices.includes(service)} onChange={() => setAgency((v) => ({ ...v, requiredServices: v.requiredServices.includes(service) ? v.requiredServices.filter((x) => x !== service) : [...v.requiredServices, service] }))} /><span className="choice-check">✓</span><span>{service}</span></label>)}</div>{error("requiredServices")}</fieldset>
          <div className="form-grid two">
            <label className={fieldClass("partnershipModel")}><span>{ru ? "Модель партнёрства" : "Partnership model"} *</span><select value={agency.partnershipModel} onChange={(e) => setAgency((v) => ({ ...v, partnershipModel: e.target.value }))}><option value="">—</option><option>Referral</option><option>Managed Partnership</option><option>White Label</option><option>Not sure</option></select>{error("partnershipModel")}</label>
            <label className={fieldClass("whiteLabel")}><span>{ru ? "Нужен white label?" : "White-label requirement?"} *</span><select value={agency.whiteLabel} onChange={(e) => setAgency((v) => ({ ...v, whiteLabel: e.target.value }))}><option value="">—</option><option>Yes</option><option>No</option><option>Maybe</option></select>{error("whiteLabel")}</label>
          </div>
          <label className="form-field"><span>{ru ? "Сообщение" : "Message"}</span><textarea rows={6} value={agency.message} onChange={(e) => setAgency((v) => ({ ...v, message: e.target.value }))} /></label>
        </>
      )}

      <div className="honeypot" aria-hidden="true"><label>Website<input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} /></label></div>
      <TurnstileWidget locale={locale} onToken={handleTurnstile} />
      {message && <div className="form-server-error" role="alert">{message}</div>}
      <div className="submit-row">
        <p><ShieldCheck aria-hidden="true" />{ru ? "Данные проверяются и сохраняются на сервере." : "Data is validated and stored server-side."}</p>
        <button className="button" type="submit" disabled={submitting}>{submitting ? <><LoaderCircle className="spin" aria-hidden="true" />{ru ? "Сохраняем…" : "Saving…"}</> : <>{type === "agency" ? (ru ? "Отправить запрос партнёрства" : "Submit Partnership Request") : (ru ? "Отправить сообщение" : "Send Message")}<ArrowRight aria-hidden="true" /></>}</button>
      </div>
    </form>
  );
}
