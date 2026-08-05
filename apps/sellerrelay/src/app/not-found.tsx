import Link from "next/link";
import { PackageSearch } from "lucide-react";

export default function NotFound() {
  return <main className="not-found"><PackageSearch aria-hidden="true" /><p className="eyebrow">404</p><h1>Page not found</h1><p>The requested SellerRelay page is unavailable.</p><Link className="button" href="/en">Return to Home</Link></main>;
}
