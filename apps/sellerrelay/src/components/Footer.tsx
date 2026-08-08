import Link from "next/link";
import { copy, type Locale } from "@/lib/content";
import { Logo } from "@/components/Logo";

export function Footer({ locale }: { locale: Locale }) {
  const c = copy[locale];
  const t = locale === "en";
  const contactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim();
  const serviceLinks = c.services.map((service) => ({ label: service.title, href: `/${locale}/services#${service.id}` }));

  return (
    <footer className="site-footer">
      <div className="shell footer-grid">
        <div className="footer-brand">
          <Logo locale={locale} />
          <p>{t ? "Your U.S. prep and logistics team for approved marketplace inventory." : "Ваша команда по подготовке и логистике согласованного товара в США."}</p>
          <p className="location">{c.common.california}</p>
          {contactEmail && <a href={`mailto:${contactEmail}`} data-event="email_click">{contactEmail}</a>}
        </div>
        <div>
          <h2>{t ? "Services" : "Услуги"}</h2>
          <ul>{serviceLinks.map((link) => <li key={link.href}><Link href={link.href}>{link.label}</Link></li>)}</ul>
        </div>
        <div>
          <h2>{t ? "Company" : "Компания"}</h2>
          <ul>
            <li><Link href={`/${locale}#about`}>{t ? "About SellerRelay" : "О SellerRelay"}</Link></li>
            <li><Link href={`/${locale}/how-it-works`}>{c.nav[1].label}</Link></li>
            <li><Link href={`/${locale}/international-sellers`}>{c.nav[3].label}</Link></li>
            <li><Link href={`/${locale}/agencies`}>{c.nav[4].label}</Link></li>
            <li><Link href={`/${locale}/contact`}>{t ? "Contact" : "Контакты"}</Link></li>
          </ul>
        </div>
        <div>
          <h2>{t ? "Resources" : "Материалы"}</h2>
          <ul>
            <li><Link href={`/${locale}/faq`}>{c.nav[5].label}</Link></li>
            <li><Link href={`/${locale}/pricing`}>{c.nav[2].label}</Link></li>
            <li><Link href={`/${locale}/restricted-products`}>{t ? "Restricted Products" : "Ограниченные товары"}</Link></li>
          </ul>
        </div>
        <div>
          <h2>{t ? "Legal" : "Правовая информация"}</h2>
          <ul>
            <li><Link href={`/${locale}/privacy`}>{t ? "Privacy Policy" : "Политика конфиденциальности"}</Link></li>
            <li><Link href={`/${locale}/terms`}>{t ? "Terms of Service" : "Условия обслуживания"}</Link></li>
          </ul>
        </div>
      </div>
      <div className="shell footer-legal">
        <p>{t ? "SellerRelay Logistics is operated by Amazing Seller LLC." : "SellerRelay Logistics управляется Amazing Seller LLC."}</p>
        <p>{c.common.amazonDisclaimer}</p>
        <p>{c.common.availability}</p>
        <p>© {new Date().getFullYear()} SellerRelay Logistics.</p>
      </div>
    </footer>
  );
}
