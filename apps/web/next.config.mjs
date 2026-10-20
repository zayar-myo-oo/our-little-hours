/** @type {import('next').NextConfig} */
// Strict mode is off: its dev-only double mount races the async WebGL scene init and leaves a blank canvas.
// STATIC_EXPORT=1 builds a static site into ./out (used for GitHub Pages; NEXT_PUBLIC_BASE_PATH sets the sub-path).
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
const nextConfig = {
  reactStrictMode: false,
  experimental: { externalDir: true },
  ...(process.env.STATIC_EXPORT === "1" ? { output: "export", basePath, trailingSlash: true, images: { unoptimized: true } } : {}),
};
export default nextConfig;
