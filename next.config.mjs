/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required for Firebase App Hosting's Next.js adapter (standalone bundle).
  output: "standalone",
  // Keep this file as .mjs: Firebase's adapter emits ESM overrides for .mjs,
  // but CommonJS `module.exports` for .ts/.js under `"type": "module"`.
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
