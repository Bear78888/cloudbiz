import type { Metadata, Viewport } from "next";
import "../globals.css";
import { Analytics } from "@/components/Analytics";
import { siteUrl } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  applicationName: "SellerRelay Logistics",
  title: "SellerRelay Logistics",
  description:
    "California-based receiving, inspection, preparation, storage, and logistics for international marketplace sellers.",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0B1633",
};

export default function RedirectRootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
