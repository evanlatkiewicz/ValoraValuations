// The public address of the site. Vercel fills this in on every deployment,
// so share links always point at the public site, never at a private
// deployment link that asks for a Vercel login.
const prod = process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL;

export const PUBLIC_ORIGIN = prod ? `https://${prod}` : null;

export function publicOrigin(): string {
  return PUBLIC_ORIGIN ?? window.location.origin;
}

/** True when someone is viewing a private deployment link instead of the public site. */
export function onPrivateDeployment(): boolean {
  if (!prod || typeof window === "undefined") return false;
  const host = window.location.host;
  return host !== prod && host.endsWith(".vercel.app");
}
