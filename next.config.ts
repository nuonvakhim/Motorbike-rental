import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
