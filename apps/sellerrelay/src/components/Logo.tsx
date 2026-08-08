import Link from "next/link";
import type { Locale } from "@/lib/content";

export function RelayMark({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" role="img" aria-label="SellerRelay">
      <defs>
        <linearGradient id="relay-gradient" x1="8" y1="8" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2563EB" />
          <stop offset="1" stopColor="#18B8A4" />
        </linearGradient>
      </defs>
      <path d="M9 15.5 24 8l15 7.5v17L24 40 9 32.5v-17Z" fill="none" stroke="url(#relay-gradient)" strokeWidth="3" strokeLinejoin="round" />
      <path d="m9.8 15.8 14.2 7.1 14.2-7.1M24 23v16" fill="none" stroke="url(#relay-gradient)" strokeWidth="3" strokeLinejoin="round" />
      <path d="M14 12.8 28.6 20l5.4-2.7" fill="none" stroke="#18B8A4" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m30.7 14.7 4.1 2.2-2.3 4" fill="none" stroke="#18B8A4" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ locale, compact = false }: { locale: Locale; compact?: boolean }) {
  return (
    <Link href={`/${locale}`} className="brand" aria-label="SellerRelay Logistics home">
      <RelayMark className="brand-mark" />
      {!compact && (
        <span className="brand-copy">
          <strong>SellerRelay</strong>
          <small>Logistics</small>
        </span>
      )}
    </Link>
  );
}
