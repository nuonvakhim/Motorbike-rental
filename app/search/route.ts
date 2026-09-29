/**
 * Lesson: "Route Handlers" — a redirect endpoint.
 *
 * An HTML form can only put the city in the query string, but city pages
 * live at `/cities/[city]`. This GET handler bridges the two: it checks the
 * city exists and redirects to its page, carrying the dates along.
 */

import type { NextRequest } from "next/server";

import { getCity } from "@/lib/listings";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const slug = params.get("city") ?? "";
  const city = slug ? await getCity(slug) : null;

  if (!city) {
    return Response.redirect(new URL("/", request.nextUrl), 303);
  }

  const target = new URL(`/cities/${city.slug}`, request.nextUrl);
  for (const key of ["start", "end"]) {
    const value = params.get(key);
    if (value) target.searchParams.set(key, value);
  }

  return Response.redirect(target, 303);
}
