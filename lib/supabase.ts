// Accounts: sign-in by email link and saved models, through Supabase.
// Browser only. Each person can read and write only their own rows; the
// database enforces that with row-level security (see supabase/schema.sql).
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** False until the Supabase keys are added in Vercel; account features stay hidden. */
export const accountsEnabled = !!(URL_ && KEY);

let client: SupabaseClient | null = null;
export function supabase(): SupabaseClient | null {
  if (!accountsEnabled || typeof window === "undefined") return null;
  client ??= createBrowserClient(URL_!, KEY!);
  return client;
}

export type SavedKind = "dcf" | "option" | "fin";

export interface SavedModel {
  id: string;
  kind: SavedKind;
  ticker: string;
  name: string;
  token: string; // the same token a share link carries
  summary: Record<string, number | string | null>;
  created_at: string;
}

export async function listSaved(): Promise<SavedModel[]> {
  const sb = supabase();
  if (!sb) return [];
  const { data, error } = await sb.from("saved_models").select("*").order("created_at", { ascending: false }).limit(200);
  if (error) throw error;
  return (data ?? []) as SavedModel[];
}

export async function saveModel(row: Omit<SavedModel, "id" | "created_at">): Promise<void> {
  const sb = supabase();
  if (!sb) throw new Error("Accounts aren't set up");
  const { error } = await sb.from("saved_models").insert(row);
  if (error) throw error;
}

export async function deleteSaved(id: string): Promise<void> {
  const sb = supabase();
  if (!sb) return;
  const { error } = await sb.from("saved_models").delete().eq("id", id);
  if (error) throw error;
}

export function openHref(m: Pick<SavedModel, "kind" | "token">): string {
  return m.kind === "dcf" ? `/dcf?m=${m.token}` : m.kind === "fin" ? `/financials?f=${m.token}` : `/options?o=${m.token}`;
}
