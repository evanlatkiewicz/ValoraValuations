import type { Metadata } from "next";
import { PageShell } from "@/components/PageShell";
import { AuthCallback } from "@/components/account/AuthCallback";

export const metadata: Metadata = { title: "Signing in | Valora", robots: { index: false } };

export default function Page() {
  return (
    <PageShell>
      <h1>Signing in</h1>
      <AuthCallback />
    </PageShell>
  );
}
