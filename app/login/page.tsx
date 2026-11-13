import type { Metadata } from "next";
import { Suspense } from "react";
import { PageShell } from "@/components/PageShell";
import { LoginForm } from "@/components/account/LoginForm";

export const metadata: Metadata = { title: "Sign in | Valora", robots: { index: false } };

export default function Page() {
  return (
    <PageShell>
      <h1>Sign in</h1>
      <p className="lede">Save your models and option contracts, then come back to them or download a fresh snapshot any time.</p>
      <Suspense>
        <LoginForm />
      </Suspense>
    </PageShell>
  );
}
