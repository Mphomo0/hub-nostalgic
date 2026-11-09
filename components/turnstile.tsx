"use client";
import { useEffect, useImperativeHandle, useRef, type Ref } from "react";

/**
 * Cloudflare Turnstile (captcha) widget.
 *
 * Off unless NEXT_PUBLIC_TURNSTILE_SITE_KEY is set: the widget renders nothing
 * and the server skips verification (see lib/turnstile.ts and lib/auth.ts).
 *
 * Inside a <form>, Turnstile adds a hidden `cf-turnstile-response` input, so
 * server actions receive the token with the rest of the FormData. Tokens are
 * single-use: call `reset()` after every submit so the next attempt gets a new one.
 */

export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";
export const turnstileEnabled = TURNSTILE_SITE_KEY !== "";

export type TurnstileHandle = { reset(): void };

type TurnstileApi = {
  render(el: HTMLElement, options: Record<string, unknown>): string;
  reset(widgetId: string): void;
  remove(widgetId: string): void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let scriptPromise: Promise<TurnstileApi> | null = null;

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  scriptPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("Turnstile failed to load")));
    script.onerror = () => {
      scriptPromise = null; // allow a retry on the next mount
      reject(new Error("Turnstile failed to load"));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export function Turnstile({
  action,
  onToken,
  ref,
}: {
  /** Shown in Cloudflare analytics and checked on the server. Letters, digits, - and _ only. */
  action: string;
  /** Called with the token when solved, and with null when it expires or errors. */
  onToken?: (token: string | null) => void;
  ref?: Ref<TurnstileHandle>;
}) {
  const container = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  useEffect(() => {
    onTokenRef.current = onToken;
  });

  useImperativeHandle(ref, () => ({
    reset() {
      onTokenRef.current?.(null);
      if (widgetId.current && window.turnstile) window.turnstile.reset(widgetId.current);
    },
  }));

  useEffect(() => {
    if (!turnstileEnabled) return;
    let cancelled = false;
    loadTurnstile()
      .then((turnstile) => {
        if (cancelled || !container.current) return;
        widgetId.current = turnstile.render(container.current, {
          sitekey: TURNSTILE_SITE_KEY,
          action,
          theme: "light",
          size: "flexible",
          callback: (token: string) => onTokenRef.current?.(token),
          "expired-callback": () => onTokenRef.current?.(null),
          "error-callback": () => onTokenRef.current?.(null),
        });
      })
      .catch((err) => console.error(err));
    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current);
      widgetId.current = null;
    };
  }, [action]);

  if (!turnstileEnabled) return null;
  // min-h keeps the layout from jumping while the widget loads.
  return <div ref={container} className="min-h-[65px]" />;
}
