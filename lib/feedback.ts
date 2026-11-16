// The feedback form. Anything on the page can open it with openFeedback(),
// passing the ticker in view so the report says what was being looked at.
import { supabase } from "./supabase";

export type FeedbackKind = "bug" | "data" | "idea";

export interface FeedbackContext {
  ticker?: string | null;
  kind?: FeedbackKind;
  /** Pre-filled text, such as the error message someone is reporting. */
  note?: string;
}

const EVENT = "valora:feedback";

export function openFeedback(ctx: FeedbackContext = {}) {
  window.dispatchEvent(new CustomEvent<FeedbackContext>(EVENT, { detail: ctx }));
}

export function onFeedbackOpen(fn: (ctx: FeedbackContext) => void): () => void {
  const h = (e: Event) => fn((e as CustomEvent<FeedbackContext>).detail ?? {});
  window.addEventListener(EVENT, h);
  return () => window.removeEventListener(EVENT, h);
}

export async function sendFeedback(row: { kind: FeedbackKind; message: string; email: string | null; page: string; ticker: string | null }) {
  const sb = supabase();
  if (!sb) throw new Error("Feedback isn't set up yet.");
  const { error } = await sb.from("feedback").insert({
    kind: row.kind,
    message: row.message.slice(0, 2000),
    email: row.email?.slice(0, 200) || null,
    page: row.page.slice(0, 300),
    ticker: row.ticker?.slice(0, 12) || null,
  });
  if (error) throw error;
}
