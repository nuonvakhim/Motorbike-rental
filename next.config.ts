import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `use cache` for the public catalogue (lib/listings.ts). Pages are
  // dynamic by default; only what is marked cached is shared between
  // visitors, and a static shell is prerendered around it.
  cacheComponents: true,
  images: {
    // `next/image` may optimize bike photos served by app/photos/[id]/route.ts
    // and nothing else local. `search: ""` refuses query strings, so nobody
    // can make the optimizer work on URLs we never render.
    localPatterns: [{ pathname: "/photos/**", search: "" }],
  },
  experimental: {
    serverActions: {
      // The default is 1 MB — less than one phone photo. The upload form
      // shrinks photos in the browser first, so this mostly matters when
      // JavaScript is off; lib/images.ts still caps each file at 8 MB.
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
