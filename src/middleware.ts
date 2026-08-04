import { NextResponse, type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";
import { isLocale, LOCALES, type Locale } from "@/lib/routes";

const LOCALE_COOKIE = "ha_locale";
const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Paths under /{locale}/... that require a signed-in user. */
const PROTECTED_SEGMENTS = ["app", "admin", "onboarding"] as const;

const SIGN_IN_PATHS: Record<Locale, string> = {
  en: "/en/sign-in",
  es: "/es/iniciar-sesion",
};

/**
 * Browser language is only an initial recommendation (§9.4): it decides the
 * first redirect from "/", and the explicit locale in the URL — persisted to
 * a cookie — wins from then on.
 */
function detectLocale(request: NextRequest): Locale {
  const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;
  if (cookieLocale && isLocale(cookieLocale)) return cookieLocale;

  const acceptLanguage = request.headers.get("accept-language") ?? "";
  for (const part of acceptLanguage.split(",")) {
    const tag = part.split(";")[0]?.trim().toLowerCase() ?? "";
    for (const locale of LOCALES) {
      if (tag === locale || tag.startsWith(`${locale}-`)) return locale;
    }
  }
  return "en";
}

/** Only ever redirect to a same-origin path — never to a caller-supplied origin. */
function safeNextPath(pathname: string, search: string): string {
  if (!pathname.startsWith("/") || pathname.startsWith("//")) return "/";
  return `${pathname}${search}`;
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Root: send the visitor to their locale (cookie first, then browser language).
  if (pathname === "/") {
    const locale = detectLocale(request);
    return NextResponse.redirect(new URL(`/${locale}`, request.url));
  }

  const [, first, second] = pathname.split("/");
  const locale: Locale | null = first && isLocale(first) ? first : null;

  const session = await updateSession(request);

  // Persist the locale choice from the URL (§9.4).
  if (locale && request.cookies.get(LOCALE_COOKIE)?.value !== locale) {
    session.response.cookies.set(LOCALE_COOKIE, locale, {
      maxAge: LOCALE_COOKIE_MAX_AGE,
      path: "/",
      sameSite: "lax",
    });
  }

  const isProtected =
    locale !== null &&
    second !== undefined &&
    (PROTECTED_SEGMENTS as readonly string[]).includes(second);

  if (isProtected && session.userId === null) {
    const signInUrl = new URL(
      session.authConfigured ? SIGN_IN_PATHS[locale] : `/${locale}`,
      request.url,
    );
    if (session.authConfigured) {
      signInUrl.searchParams.set("next", safeNextPath(pathname, search));
    }
    return NextResponse.redirect(signInUrl);
  }

  return session.response;
}

export const config = {
  // Everything except Next internals, static assets, and files with extensions.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
