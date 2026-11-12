// Keeps the current model for this browser tab, so visiting a Learn page
// and coming back doesn't wipe it. Nothing leaves the browser.
import type { DcfInputs } from "./types";

const KEY = "valora:model";

export interface Saved {
  inputs: DcfInputs;
  baseline: DcfInputs;
  preset: "apple" | "blank" | "shared" | "loaded"; // "apple" only appears in older sessions
  home?: boolean;
}

export function saveSession(s: Saved) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage can be unavailable; the app still works without it */
  }
}

export function loadSession(): Saved | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Saved;
    return s?.inputs?.history?.length ? s : null;
  } catch {
    return null;
  }
}
