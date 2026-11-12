import { NextResponse } from "next/server";
import { fetchRiskFree } from "@/lib/rates";

// Latest 10-year Treasury yield from FRED. Set FRED_API_KEY in Vercel.
export async function GET() {
  const rf = await fetchRiskFree();
  return NextResponse.json(rf, {
    headers: { "Cache-Control": rf.live ? "public, s-maxage=21600, stale-while-revalidate=86400" : "no-store" },
  });
}
