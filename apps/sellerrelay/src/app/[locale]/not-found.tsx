"use client";

import Link from "next/link";
import { PackageSearch } from "lucide-react";
import { useParams } from "next/navigation";

export default function NotFound() {
  const params = useParams<{ locale?: string }>();
  const isRussian = params?.locale === "ru";

  return (
    <section className="not-found" aria-labelledby="not-found-title">
      <PackageSearch aria-hidden="true" />
      <p className="eyebrow">404</p>
      <h1 id="not-found-title">
        {isRussian ? "Страница не найдена" : "Page not found"}
      </h1>
      <p>
        {isRussian
          ? "Запрошенная страница SellerRelay недоступна."
          : "The requested SellerRelay page is unavailable."}
      </p>
      <Link className="button" href={isRussian ? "/ru" : "/en"}>
        {isRussian ? "Вернуться на главную" : "Return to Home"}
      </Link>
    </section>
  );
}
