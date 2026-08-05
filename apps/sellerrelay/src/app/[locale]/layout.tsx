import { notFound } from "next/navigation";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { isLocale } from "@/lib/content";

export default async function LocaleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <><a className="skip-link" href="#main-content">{locale === "ru" ? "Перейти к содержимому" : "Skip to content"}</a><Header locale={locale} /><main id="main-content">{children}</main><Footer locale={locale} /></>;
}
