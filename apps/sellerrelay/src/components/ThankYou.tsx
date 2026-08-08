"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, CalendarDays, CheckCircle2, Home, ShieldAlert } from "lucide-react";
import type { Locale } from "@/lib/content";
import { trackEvent } from "@/components/Analytics";

type Submission = {
  requestNumber?: string;
  contactMethod?: string;
  category?: string;
  totalUnits?: string;
  services?: string[];
  intent?: string;
};

export function ThankYou({ locale, requestNumber }: { locale: Locale; requestNumber?: string }) {
  const ru = locale === "ru";
  const [submission, setSubmission] = useState<Submission>({ requestNumber });
  const bookingUrl = process.env.NEXT_PUBLIC_BOOKING_URL;

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem("sellerrelay:lastSubmission");
      if (stored) setSubmission({ ...JSON.parse(stored) as Submission, requestNumber: requestNumber || (JSON.parse(stored) as Submission).requestNumber });
    } catch { /* ignore invalid local state */ }
  }, [requestNumber]);

  return (
    <div className="thank-you-card">
      <div className="thank-you-icon"><CheckCircle2 aria-hidden="true" /></div>
      <p className="eyebrow">{ru ? "ЗАЯВКА СОХРАНЕНА" : "REQUEST SAVED"}</p>
      <h1>{ru ? "Мы получили информацию о вашей поставке" : "Your shipment request has been received"}</h1>
      <p className="lead">{ru ? "Спасибо за обращение в SellerRelay. Мы изучим товар, объём, необходимые операции и предполагаемые сроки. Представитель компании свяжется с вами в течение одного рабочего дня." : "Thank you for contacting SellerRelay. We will review your product, shipment size, required services, and expected timeline. A representative will contact you within one business day."}</p>
      <div className="critical-alert"><ShieldAlert aria-hidden="true" /><strong>{ru ? "Не отправляйте товар до получения письменного подтверждения и инструкций по приёмке." : "Do not ship inventory until you receive written approval and receiving instructions."}</strong></div>
      <dl className="submission-summary">
        <div><dt>{ru ? "Номер заявки" : "Request number"}</dt><dd>{submission.requestNumber || (ru ? "Указан в подтверждении" : "Shown in your confirmation")}</dd></div>
        {submission.contactMethod && <div><dt>{ru ? "Способ связи" : "Contact method"}</dt><dd>{submission.contactMethod}</dd></div>}
        {submission.category && <div><dt>{ru ? "Категория товара" : "Product category"}</dt><dd>{submission.category}</dd></div>}
        {submission.totalUnits && <div><dt>{ru ? "Размер партии" : "Shipment size"}</dt><dd>{submission.totalUnits}</dd></div>}
        {submission.services?.length ? <div><dt>{ru ? "Запрошенные услуги" : "Requested services"}</dt><dd>{submission.services.slice(0, 5).join(", ")}{submission.services.length > 5 ? "…" : ""}</dd></div> : null}
      </dl>
      <div className="button-row centered">
        <Link href={`/${locale}`} className="button button-secondary"><Home aria-hidden="true" />{ru ? "На главную" : "Return to Home"}</Link>
        {bookingUrl && <a href={bookingUrl} className="button" target="_blank" rel="noreferrer" data-event="book_call_click" onClick={() => trackEvent("book_call_click", { language: locale })}><CalendarDays aria-hidden="true" />{ru ? "Записаться на 15-минутный звонок" : "Book a 15-Minute Call"}<ArrowRight aria-hidden="true" /></a>}
      </div>
    </div>
  );
}
