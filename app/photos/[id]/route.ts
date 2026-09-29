/**
 * Lesson: "Route Handlers" — serving binary data.
 *
 * Bike photos live in Postgres, so they need a URL: GET /photos/:id returns
 * the stored WebP bytes. `next/image` requests this URL itself and serves
 * resized copies, so the browser rarely downloads the full 1600px original.
 *
 * A photo's bytes never change for a given id — replacing a photo means a
 * new row with a new id — so the response can be cached forever.
 */

import { getPhotoData } from "@/lib/listings";

export async function GET(_request: Request, { params }: RouteContext<"/photos/[id]">) {
  const { id } = await params;
  const photo = await getPhotoData(id);

  if (!photo) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(photo.data, {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "public, max-age=31536000, immutable",
      // The bytes were re-encoded by sharp, but tell browsers not to guess
      // the type anyway.
      "X-Content-Type-Options": "nosniff",
    },
  });
}
