"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { accountsEnabled, supabase } from "@/lib/supabase";
import { useUser } from "../useUser";

/** Sign in with a link sent by email. No password. */
export function LoginForm() {
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const { user, ready } = useUser();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ready && user) window.location.replace(next);
  }, [ready, user, next]);

  if (!accountsEnabled) {
    return <p className="callout">Accounts aren&rsquo;t switched on yet. Everything else on Valora works without one.</p>;
  }

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const sb = supabase();
    if (!sb || !email.trim()) return;
    setState("sending");
    setError(null);
    const { error } = await sb.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    if (error) {
      setState("error");
      setError(
        /rate limit/i.test(error.message)
          ? "Too many sign-in emails were sent in the last hour. Try again later."
          : `Couldn't send the email: ${error.message}`,
      );
    } else setState("sent");
  };

  if (state === "sent") {
    return (
      <div className="callout">
        <p>
          <b>Check your email.</b> We sent a sign-in link to {email}. Open it on this device and browser, and you&rsquo;ll come back here
          signed in.
        </p>
        <p style={{ marginTop: 8 }}>
          Nothing there after a minute? Check spam, or{" "}
          <button className="linkbtn" onClick={() => setState("idle")}>use a different email</button>.
        </p>
      </div>
    );
  }

  return (
    <form className="login-form" onSubmit={send}>
      <label htmlFor="login-email">Email</label>
      <div className="login-row">
        <input
          id="login-email"
          type="email"
          className="text-input"
          autoComplete="email"
          required
          placeholder="you@school.edu"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button className="btn" type="submit" disabled={state === "sending"}>
          {state === "sending" ? "Sending" : "Email me a sign-in link"}
        </button>
      </div>
      {error && <p className="login-error" role="alert">{error}</p>}
      <p className="muted" style={{ fontSize: "var(--step--1)", marginTop: 10 }}>
        New here? The same link creates your account. We only use your email to sign you in. <Link href="/disclaimer">Disclaimer</Link>
      </p>
    </form>
  );
}

/** Only same-site paths, so a crafted link can't send people elsewhere after sign-in. */
export function safeNext(n: string | null): string {
  return n && n.startsWith("/") && !n.startsWith("//") ? n : "/account";
}
