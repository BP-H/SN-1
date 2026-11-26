import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export function GET(request) {
  const target = process.env.SUPERNOVA_DONATION_URL || "";
  if (/^https:\/\/(?:buy|donate)\.stripe\.com\/[\w/-]+$/.test(target)) return NextResponse.redirect(target, 307);
  return NextResponse.redirect(new URL("/about#support", request.url), 307);
}
