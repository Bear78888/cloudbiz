"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";

import { GOOGLE_AUTH_ENABLED } from "@/lib/config";
import type { Dict } from "@/lib/i18n";
import type { Locale } from "@/lib/routes";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { authErrorMessageKey, type AuthErrorLike } from "./errors";

/**
 * Functional sign-in / sign-up forms (§10.1: email+password, magic link,
 * Google behind a flag). Rendered by the catch-all route instead of the
 * static previews once Supabase is configured.
 */

interface AuthStrings {
  signIn: Dict["auth"]["signIn"];
  signUp: Dict["auth"]["signUp"];
  flow: Dict["platform"]["authFlow"];
}

type Notice = { tone: "error" | "success"; text: string } | null;

function safeNext(raw: string | null, fallback: string): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return fallback;
  return raw;
}

const inputClass =
  "mt-1.5 block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200";
const primaryButtonClass =
  "w-full rounded-xl bg-brand-600 px-6 py-3 font-semibold text-white hover:bg-brand-700 disabled:cursor-wait disabled:bg-slate-300 disabled:text-slate-600";
const secondaryButtonClass =
  "w-full rounded-xl border border-slate-300 bg-white px-6 py-3 font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-wait disabled:bg-slate-100";

function NoticeBox({ notice }: { notice: Notice }) {
  if (!notice) return null;
  const tone =
    notice.tone === "error"
      ? "bg-red-50 text-red-800 border border-red-200"
      : "bg-emerald-50 text-emerald-800 border border-emerald-200";
  return (
    <p role={notice.tone === "error" ? "alert" : "status"} className={`mt-4 rounded-xl px-4 py-3 text-sm font-medium ${tone}`}>
      {notice.text}
    </p>
  );
}

function SignInFormInner({ locale, strings }: { locale: Locale; strings: AuthStrings }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const nextPath = safeNext(searchParams.get("next"), `/${locale}/app`);
  const a = strings.signIn;
  const flow = strings.flow;

  async function handlePasswordSignIn(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setNotice(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        // A rate limit or a disabled provider is not "wrong password";
        // telling someone to re-check credentials they typed correctly is
        // the fastest way to make them think the product is broken.
        setNotice({ tone: "error", text: flow[authErrorMessageKey(error as AuthErrorLike)] });
        return;
      }
      router.push(nextPath);
      router.refresh();
    } catch {
      setNotice({ tone: "error", text: flow.genericError });
    } finally {
      setPending(false);
    }
  }

  async function handleMagicLink() {
    if (!email) {
      setNotice({ tone: "error", text: flow.invalidCredentials });
      return;
    }
    setPending(true);
    setNotice(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
        },
      });
      setNotice(
        error
          ? { tone: "error", text: flow[authErrorMessageKey(error as AuthErrorLike)] }
          : { tone: "success", text: flow.magicLinkSent },
      );
    } catch {
      setNotice({ tone: "error", text: flow.genericError });
    } finally {
      setPending(false);
    }
  }

  async function handleGoogle() {
    setPending(true);
    try {
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
        },
      });
    } catch {
      setNotice({ tone: "error", text: flow.genericError });
      setPending(false);
    }
  }

  return (
    <div>
      <NoticeBox notice={notice} />
      <form className="mt-6 space-y-4" onSubmit={handlePasswordSignIn}>
        <div>
          <label htmlFor="signin-email" className="block text-sm font-semibold text-slate-700">
            {a.email}
          </label>
          <input
            id="signin-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="signin-password" className="block text-sm font-semibold text-slate-700">
            {a.password}
          </label>
          <input
            id="signin-password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
        </div>
        <button type="submit" disabled={pending} className={primaryButtonClass}>
          {pending ? flow.working : a.submit}
        </button>
      </form>
      <div className="my-5 flex items-center gap-3 text-sm text-slate-400">
        <span className="h-px flex-1 bg-slate-200" aria-hidden="true" />
        {a.divider}
        <span className="h-px flex-1 bg-slate-200" aria-hidden="true" />
      </div>
      <button type="button" disabled={pending} onClick={handleMagicLink} className={secondaryButtonClass}>
        {a.magic}
      </button>
      {GOOGLE_AUTH_ENABLED ? (
        <button type="button" disabled={pending} onClick={handleGoogle} className={`mt-3 ${secondaryButtonClass}`}>
          {a.google}
        </button>
      ) : null}
    </div>
  );
}

export function SignInForm(props: { locale: Locale; strings: AuthStrings }) {
  return (
    <Suspense fallback={null}>
      <SignInFormInner {...props} />
    </Suspense>
  );
}

export function SignUpForm({ locale, strings }: { locale: Locale; strings: AuthStrings }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const a = strings.signUp;
  const flow = strings.flow;

  async function handleSignUp(event: FormEvent) {
    event.preventDefault();
    if (password.length < 8) {
      setNotice({ tone: "error", text: flow.passwordTooShort });
      return;
    }
    setPending(true);
    setNotice(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { preferred_locale: locale },
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(`/${locale}/onboarding`)}`,
        },
      });
      if (error) {
        // §29: tell them what to change. A password rejected as breached or
        // too weak is the one case where "something went wrong" guarantees
        // the user retypes exactly the same password.
        setNotice({ tone: "error", text: flow[authErrorMessageKey(error as AuthErrorLike)] });
        return;
      }
      if (data.session) {
        router.push(`/${locale}/onboarding`);
        router.refresh();
        return;
      }
      // Email confirmation is on: the session arrives via the callback link.
      setNotice({ tone: "success", text: flow.confirmationSent });
    } catch {
      setNotice({ tone: "error", text: flow.genericError });
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <NoticeBox notice={notice} />
      <form className="mt-6 space-y-4" onSubmit={handleSignUp}>
        <div>
          <label htmlFor="signup-email" className="block text-sm font-semibold text-slate-700">
            {a.email}
          </label>
          <input
            id="signup-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="signup-password" className="block text-sm font-semibold text-slate-700">
            {a.password}
          </label>
          <input
            id="signup-password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
        </div>
        <button type="submit" disabled={pending} className={primaryButtonClass}>
          {pending ? flow.working : a.submit}
        </button>
      </form>
      {GOOGLE_AUTH_ENABLED ? (
        <>
          <div className="my-5 flex items-center gap-3 text-sm text-slate-400">
            <span className="h-px flex-1 bg-slate-200" aria-hidden="true" />
            {a.divider}
            <span className="h-px flex-1 bg-slate-200" aria-hidden="true" />
          </div>
          <button type="button" disabled={pending} className={secondaryButtonClass}>
            {a.google}
          </button>
        </>
      ) : null}
    </div>
  );
}
