/** @type {import('next').NextConfig} */
const nextConfig = {
  // Firebase App Hosting's adapter rewrites next.config.ts with
  // `module.exports`, which breaks vinext/Vite ESM loading.
  // Keep this file as .mjs so Firebase generates an ESM override instead.
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
