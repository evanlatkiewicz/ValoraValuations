import { NextResponse } from "next/server";
import { fetchRiskFree } from "@/lib/rates";
import { fetchCurve } from "@/lib/curve";

// Latest Treasury yields from FRED: the 10-year (for the DCF) and the whole
// curve from 1 month to 30 years (for options). Set FRED_API_KEY in Vercel.
export async function GET() {
  const [rf, curve] = await Promise.all([fetchRiskFree(), fetchCurve()]);
  return NextResponse.json(
    { ...rf, curve },
    { headers: { "Cache-Control": rf.live ? "public, s-maxage=21600, stale-while-revalidate=86400" : "no-store" } },
  );
}
