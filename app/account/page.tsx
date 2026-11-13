import type { Metadata } from "next";
import { PageShell } from "@/components/PageShell";
import { AccountPage } from "@/components/account/AccountPage";

export const metadata: Metadata = { title: "My saved models | Valora", robots: { index: false } };

export default function Page() {
  return (
    <PageShell>
      <h1>My saved models</h1>
      <AccountPage />
    </PageShell>
  );
}
