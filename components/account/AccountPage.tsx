"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { accountsEnabled, deleteSaved, listSaved, openHref, supabase, type SavedModel } from "@/lib/supabase";
import { useUser } from "../useUser";
import { price, signedPct } from "@/lib/format";
import { fmtDate } from "@/lib/market";

const when = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const num = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? x : null);

/** "My saved models": everything this person saved, newest first. */
export function AccountPage() {
  const { user, ready } = useUser();
  const [items, setItems] = useState<SavedModel[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    listSaved()
      .then(setItems)
      .catch(() => setError("Couldn't load your saved models. Try again in a minute."));
  }, [user]);

  if (!accountsEnabled) return <p className="callout">Accounts aren&rsquo;t switched on yet.</p>;
  if (!ready) return <p className="muted">Loading</p>;
  if (!user) {
    return (
      <p className="callout">
        <Link href="/login?next=/account">Sign in</Link> to see the models and option contracts you&rsquo;ve saved.
      </p>
    );
  }

  const remove = async (m: SavedModel) => {
    if (!window.confirm(`Delete your saved ${m.kind === "dcf" ? "model" : "option"} for ${m.ticker}? This can't be undone.`)) return;
    setBusy(m.id);
    try {
      await deleteSaved(m.id);
      setItems((xs) => xs?.filter((x) => x.id !== m.id) ?? null);
    } catch {
      setError("Couldn't delete that. Try again.");
    } finally {
      setBusy(null);
    }
  };

  // A fresh snapshot: the saved assumptions with today's price and data.
  const snapshot = async (m: SavedModel) => {
    setBusy(m.id);
    setError(null);
    try {
      const [{ decodeAny }, { downloadSnapshot }] = await Promise.all([import("@/lib/share"), import("../snapshot/download")]);
      const model = await decodeAny(m.token);
      if (!model) throw new Error("bad model");
      const market = await fetch(`/api/prices?ticker=${encodeURIComponent(m.ticker)}`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
      const fresh = market?.last?.c ? { ...model, sharePrice: market.last.c, company: { ...model.company, priceDate: market.last.d } } : model;
      await downloadSnapshot(fresh, market, null);
    } catch {
      setError("Couldn't build that snapshot. Try opening the model and downloading it from the menu.");
    } finally {
      setBusy(null);
    }
  };

  const signOut = async () => {
    await supabase()?.auth.signOut();
    window.location.replace("/");
  };

  return (
    <>
      <p className="muted" style={{ marginTop: -6 }}>
        Signed in as {user.email}.{" "}
        <button className="linkbtn" onClick={signOut}>Sign out</button>
      </p>
      {error && <p className="login-error" role="alert">{error}</p>}
      {items === null ? (
        <p className="muted" style={{ marginTop: 20 }}>Loading your saved models</p>
      ) : items.length === 0 ? (
        <div className="callout" style={{ marginTop: 20 }}>
          <p>
            Nothing saved yet. Build a <Link href="/dcf">company valuation</Link> or <Link href="/options">price an option</Link>, then
            choose <b>Save to my account</b> from the menu.
          </p>
        </div>
      ) : (
        <ul className="saved-list">
          {items.map((m) => {
            const s = m.summary ?? {};
            const value = num(s.value), px = num(s.price);
            return (
              <li key={m.id} className="saved-item">
                <div className="saved-main">
                  <div className="saved-title">
                    <span className="co-ticker">{m.ticker}</span>
                    <span>{m.name}</span>
                    <span className={`saved-kind ${m.kind}`}>{m.kind === "dcf" ? "DCF" : "Option"}</span>
                  </div>
                  <div className="saved-meta">
                    {m.kind === "dcf" && value !== null && px !== null && (
                      <span>
                        Value {price(value)} vs. {price(px)} ({signedPct(value / px - 1, 0)})
                        {typeof s.year === "string" ? `, ${s.year}` : ""}
                      </span>
                    )}
                    {m.kind === "option" && (
                      <span>
                        {s.type === "put" ? "Put" : "Call"}, strike {num(s.strike) !== null ? price(num(s.strike)!) : "n/a"}, expires{" "}
                        {typeof s.expiry === "string" ? fmtDate(s.expiry) : "n/a"}
                        {num(s.call) !== null && num(s.putPrice) !== null ? `. Call ${price(num(s.call)!)}, put ${price(num(s.putPrice)!)}` : ""}
                      </span>
                    )}
                    <span className="faint">Saved {when(m.created_at)}</span>
                  </div>
                </div>
                <div className="saved-actions">
                  <Link className="btn small" href={openHref(m)}>Open</Link>
                  {m.kind === "dcf" && (
                    <button className="btn ghost small" onClick={() => snapshot(m)} disabled={busy === m.id}>
                      {busy === m.id ? "Working" : "Snapshot PDF"}
                    </button>
                  )}
                  <button className="linkbtn" onClick={() => remove(m)} disabled={busy === m.id}>Delete</button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
