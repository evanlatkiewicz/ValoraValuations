"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { accountsEnabled, supabase } from "@/lib/supabase";
import { useUser } from "../useUser";

/** Sign in with Google. No password, and no email for Valora to send. */
export function LoginForm() {
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const { user, ready } = useUser();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(params.get("error") ? "Sign-in didn't finish. Try again." : null);

  useEffect(() => {
    if (ready && user) window.location.replace(next);
  }, [ready, user, next]);

  if (!accountsEnabled) {
    return <p className="callout">Accounts aren&rsquo;t switched on yet. Everything else on Valora works without one.</p>;
  }

  const google = async () => {
    const sb = supabase();
    if (!sb) return;
    setBusy(true);
    setError(null);
    const { error } = await sb.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    // On success the browser is already on its way to Google
    if (error) {
      setBusy(false);
      setError(/not enabled|unsupported provider/i.test(error.message) ? "Google sign-in isn't switched on yet." : `Couldn't start sign-in: ${error.message}`);
    }
  };

  return (
    <div className="login-form">
      <button className="btn google-btn" onClick={google} disabled={busy}>
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
          <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
          <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
          <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
          <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
        </svg>
        {busy ? "Opening Google" : "Continue with Google"}
      </button>
      {error && <p className="login-error" role="alert">{error}</p>}
      <p className="muted" style={{ fontSize: "var(--step--1)", marginTop: 12, maxWidth: "60ch" }}>
        New here? The same button creates your account. Valora only uses your Google account&rsquo;s name and email to sign you in, and
        never posts anything. <Link href="/disclaimer">Disclaimer</Link>
      </p>
    </div>
  );
}

/** Only same-site paths, so a crafted link can't send people elsewhere after sign-in. */
export function safeNext(n: string | null): string {
  return n && n.startsWith("/") && !n.startsWith("//") ? n : "/account";
}
