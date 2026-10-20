/** @type {import('next').NextConfig} */
// Strict mode is off: its dev-only double mount races the async WebGL scene init and leaves a blank canvas.
// STATIC_EXPORT=1 builds a static site into ./out (used for GitHub Pages; NEXT_PUBLIC_BASE_PATH sets the sub-path).
import { fileURLToPath } from "node:url";
import path from "node:path";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
// Repo root: content/ (story, locations) lives outside apps/web.
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const nextConfig = {
  reactStrictMode: false,
  experimental: { externalDir: true },
  turbopack: { root: repoRoot }, // dev uses Turbopack (~35% faster first compile than webpack, measured)
  // Large static media (VRM ~20 MB, music): let browsers/CDN reuse them for a day and revalidate in the background,
  // so repeat visits don't re-download. Not used by the static export (GitHub Pages sets its own headers).
  ...(process.env.STATIC_EXPORT === "1" ? {} : {
    async headers() {
      const cache = [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }];
      return [{ source: "/models/:path*", headers: cache }, { source: "/audio/:path*", headers: cache }];
    },
  }),
  ...(process.env.STATIC_EXPORT === "1" ? { output: "export", basePath, trailingSlash: true, images: { unoptimized: true } } : {}),
};
export default nextConfig;
