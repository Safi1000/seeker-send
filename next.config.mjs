/** @type {import('next').NextConfig} */
const nextConfig = {
  // These libraries are native/heavy and must stay external to the server
  // bundle (they cannot be bundled by webpack / run on the edge).
  serverExternalPackages: [
    "pdf-parse",
    "pdfjs-dist",
    "tesseract.js",
    "@napi-rs/canvas",
  ],
  eslint: {
    // Don't fail production builds on lint; lint is run separately.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
