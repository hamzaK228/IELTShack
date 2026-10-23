import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Public liveness endpoint for an uptime monitor. No secrets or user data. */
export async function GET() {
  return NextResponse.json(
    { ok: true, service: "ieltshack", time: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } }
  );
}
