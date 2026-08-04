import Link from "next/link";

import { SignInForm, SignUpForm } from "@/features/auth/forms";
import type { Dict } from "@/lib/i18n";
import { hrefFor, type Locale } from "@/lib/routes";

/** Functional auth pages (rendered when Supabase is configured). */
export function AuthPage({
  locale,
  dict,
  mode,
}: {
  locale: Locale;
  dict: Dict;
  mode: "signIn" | "signUp";
}) {
  const a = mode === "signIn" ? dict.auth.signIn : dict.auth.signUp;
  const strings = {
    signIn: dict.auth.signIn,
    signUp: dict.auth.signUp,
    flow: dict.platform.authFlow,
  };

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col justify-center px-4 py-16">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">{a.title}</h1>
        <p className="mt-2 text-slate-600">{a.sub}</p>
        {mode === "signUp" ? (
          <ul className="mt-4 space-y-1.5">
            {dict.auth.signUp.perks.map((perk) => (
              <li key={perk} className="flex items-center gap-2 text-sm text-slate-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
                {perk}
              </li>
            ))}
          </ul>
        ) : null}
        {mode === "signIn" ? (
          <SignInForm locale={locale} strings={strings} />
        ) : (
          <SignUpForm locale={locale} strings={strings} />
        )}
        <p className="mt-6 text-center text-sm text-slate-600">
          {mode === "signIn" ? dict.auth.signIn.noAccount : dict.auth.signUp.hasAccount}{" "}
          <Link
            href={hrefFor(mode === "signIn" ? "signUp" : "signIn", locale)}
            className="font-semibold text-brand-700 hover:text-brand-800"
          >
            {mode === "signIn" ? dict.auth.signIn.switchLink : dict.auth.signUp.switchLink}
          </Link>
        </p>
      </div>
    </div>
  );
}
