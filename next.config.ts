import type { NextConfig } from "next";

// Security headers (audit: missing CSP/headers). CSP allows self + the DeepSeek
// API; 'unsafe-inline' for styles is needed by the inline <style> blocks used in
// some components — tighten with nonces later.
// Next.js/React dev mode (HMR, error overlay, callstack reconstruction) requires
// eval(), so 'unsafe-eval' is added in development ONLY — production stays strict.
const isDev = process.env.NODE_ENV !== "production";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "img-src 'self' data: blob: https:",
      `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self' data:",
      `connect-src 'self' https://api.deepseek.com${isDev ? " ws: http://localhost:*" : ""}`,
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  // Document parsers use dynamic requires / native-ish entry points — keep them
  // out of the bundle so they load from node_modules at runtime (Node routes only).
  serverExternalPackages: ["pdf-parse", "mammoth"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
