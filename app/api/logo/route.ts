import { logoUrlFor } from "@/lib/og";

// GET /api/logo?l=apple.com → the company logo, served from this site so the
// PDF snapshot can embed it (browsers block reading images from other sites).
export async function GET(req: Request) {
  const url = logoUrlFor(new URL(req.url).searchParams.get("l"));
  if (!url) return new Response("Not found", { status: 404 });
  try {
    const res = await fetch(url, { next: { revalidate: 30 * 86400 }, signal: AbortSignal.timeout(4000) });
    const type = (res.headers.get("content-type") ?? "").split(";")[0];
    if (!res.ok || !/^image\/(png|jpe?g)$/.test(type)) return new Response("Not found", { status: 404 });
    return new Response(await res.arrayBuffer(), {
      headers: { "Content-Type": type, "Cache-Control": "public, max-age=86400, s-maxage=2592000" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
