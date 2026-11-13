"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { safeNext } from "./LoginForm";

/** Where the email link lands: finish signing in, then go back to where the person started. */
export function AuthCallback() {
  const [failed, setFailed] = useState<string | null>(null);
  useEffect(() => {
    const sb = supabase();
    const url = new URL(window.location.href);
    const next = safeNext(url.searchParams.get("next"));
    const code = url.searchParams.get("code");
    const linkError = url.searchParams.get("error_description") ?? new URLSearchParams(url.hash.slice(1)).get("error_description");
    if (!sb) return setFailed("Accounts aren't switched on yet.");
    if (linkError) return setFailed(linkError);
    (async () => {
      const { data } = await sb.auth.getSession();
      if (!data.session && code) {
        const { error } = await sb.auth.exchangeCodeForSession(code);
        if (error) return setFailed("This sign-in link has expired or was already used. Request a new one.");
      }
      window.location.replace(next);
    })();
  }, []);
  if (failed) {
    return (
      <div className="callout">
        <p>{failed}</p>
        <p style={{ marginTop: 8 }}>
          <Link href="/login">Request a new sign-in link</Link>. Open it in the same browser you requested it from.
        </p>
      </div>
    );
  }
  return <p className="muted">Signing you in</p>;
}
