"use client";

import Script from "next/script";
import { useEffect, useId } from "react";

declare global {
  interface Window {
    sellerRelayTurnstileCallbacks?: Record<string, (token: string) => void>;
    sellerRelayTurnstileDispatch?: (token: string, id: string) => void;
  }
}

export function TurnstileWidget({ onToken, locale }: { onToken: (token: string) => void; locale: "en" | "ru" }) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const id = useId().replaceAll(":", "");

  useEffect(() => {
    if (!siteKey) return;
    window.sellerRelayTurnstileCallbacks ||= {};
    window.sellerRelayTurnstileCallbacks[id] = onToken;
    window.sellerRelayTurnstileDispatch = (token, callbackId) => window.sellerRelayTurnstileCallbacks?.[callbackId]?.(token);
    return () => { if (window.sellerRelayTurnstileCallbacks) delete window.sellerRelayTurnstileCallbacks[id]; };
  }, [id, onToken, siteKey]);

  if (!siteKey) return null;

  return (
    <div className="turnstile-wrap">
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" />
      <div
        className="cf-turnstile"
        data-sitekey={siteKey}
        data-language={locale}
        data-callback={`sellerRelayTurnstile_${id}`}
      />
      <Script id={`turnstile-callback-${id}`} strategy="afterInteractive">
        {`window.sellerRelayTurnstile_${id}=function(token){window.sellerRelayTurnstileDispatch&&window.sellerRelayTurnstileDispatch(token,'${id}');}`}
      </Script>
    </div>
  );
}
