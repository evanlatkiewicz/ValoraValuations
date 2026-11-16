"use client";

import { useEffect, useRef, useState } from "react";
import { onFeedbackOpen, openFeedback, sendFeedback, type FeedbackContext, type FeedbackKind } from "@/lib/feedback";
import { accountsEnabled } from "@/lib/supabase";
import { useUser } from "./useUser";

const KINDS: [FeedbackKind, string][] = [
  ["bug", "Something broke"],
  ["data", "A number looks wrong"],
  ["idea", "An idea"],
];

const PROMPT: Record<FeedbackKind, string> = {
  bug: "What were you doing, and what happened?",
  data: "Which number, and what should it be? A link to the filing helps.",
  idea: "What would make Valora more useful to you?",
};

/** The feedback form, mounted once for the whole site. */
export function FeedbackDialog() {
  const ref = useRef<HTMLDialogElement>(null);
  const { user } = useUser();
  const [kind, setKind] = useState<FeedbackKind>("bug");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [ticker, setTicker] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [err, setErr] = useState("");
  const trap = useRef<HTMLInputElement>(null); // left empty by people, filled by bots

  useEffect(
    () =>
      onFeedbackOpen((ctx: FeedbackContext) => {
        setKind(ctx.kind ?? "bug");
        setMessage(ctx.note ? `${ctx.note}\n\n` : "");
        setTicker(ctx.ticker?.toUpperCase() || null);
        setState("idle");
        setErr("");
        ref.current?.showModal();
      }),
    [],
  );

  if (!accountsEnabled) return null;

  const close = () => ref.current?.close();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (trap.current?.value) return close();
    if (message.trim().length < 3) {
      setErr("Write a few words so I know what to look at.");
      return;
    }
    setState("sending");
    setErr("");
    try {
      await sendFeedback({
        kind,
        message: message.trim(),
        email: (user?.email ?? email.trim()) || null,
        page: location.pathname + location.search.slice(0, 200),
        ticker,
      });
      setState("sent");
    } catch {
      setState("error");
      setErr("That didn't go through. Try again in a minute.");
    }
  };

  return (
    <dialog ref={ref} className="fb" aria-labelledby="fb-title" onClick={(e) => e.target === ref.current && close()}>
      {state === "sent" ? (
        <div className="fb-body">
          <h2 id="fb-title">Thanks, it&rsquo;s sent.</h2>
          <p className="fb-sub">I read every one of these. If you left an email, I&rsquo;ll let you know when it&rsquo;s fixed.</p>
          <div className="fb-actions">
            <button className="btn" onClick={close} autoFocus>Close</button>
          </div>
        </div>
      ) : (
        <form className="fb-body" onSubmit={submit}>
          <h2 id="fb-title">Send feedback</h2>
          <div className="seg fb-kinds" role="group" aria-label="What kind of feedback">
            {KINDS.map(([k, label]) => (
              <button type="button" key={k} aria-pressed={kind === k} onClick={() => setKind(k)}>
                {label}
              </button>
            ))}
          </div>
          <label className="fb-field">
            <span className="field-label">{PROMPT[kind]}</span>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5} maxLength={2000} autoFocus />
          </label>
          {!user && (
            <label className="fb-field">
              <span className="field-label">Your email, if you want a reply</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={200} autoComplete="email" />
            </label>
          )}
          <input ref={trap} className="fb-trap" tabIndex={-1} autoComplete="off" aria-hidden name="website" />
          <p className="fb-sub">
            Sent along with it: this page{ticker ? <> and the ticker <strong>{ticker}</strong></> : null}
            {user ? <>, and your account email</> : null}.
          </p>
          {err && <p className="fb-err" role="alert">{err}</p>}
          <div className="fb-actions">
            <button type="button" className="btn ghost" onClick={close}>Cancel</button>
            <button className="btn" disabled={state === "sending"}>{state === "sending" ? "Sending…" : "Send"}</button>
          </div>
        </form>
      )}
    </dialog>
  );
}

/** A plain text link that opens the form, for footers and error messages. */
export function FeedbackLink({ ctx, children = "Send feedback" }: { ctx?: FeedbackContext; children?: React.ReactNode }) {
  if (!accountsEnabled) return null;
  return (
    <button type="button" className="linkbtn" onClick={() => openFeedback(ctx)}>
      {children}
    </button>
  );
}
