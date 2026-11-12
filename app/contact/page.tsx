import type { Metadata } from "next";
import { PageShell } from "@/components/PageShell";

export const metadata: Metadata = { title: "Contact | Valora" };

export default function Page() {
  return (
    <PageShell>
      <h1>Contact</h1>
      <p className="lede">Valora is built by Evan Latkiewicz.</p>

      <h2>Say hello</h2>
      <p>
        For questions, feedback or anything else, reach out on{" "}
        <a href="https://www.linkedin.com/in/evanlatkiewicz/" target="_blank" rel="noreferrer">LinkedIn</a>.
      </p>

      <h2>Report a bug or a wrong number</h2>
      <p>
        If a company loads with a figure that doesn&rsquo;t match its 10-K, or something on the site breaks, open an issue on{" "}
        <a href="https://github.com/evanlatkiewicz/dcf-builder/issues" target="_blank" rel="noreferrer">GitHub</a>. Include the ticker, the
        number you expected and where you found it in the filing.
      </p>
    </PageShell>
  );
}
