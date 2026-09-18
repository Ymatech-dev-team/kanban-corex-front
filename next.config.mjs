/** @type {import('next').NextConfig} */

// CSP: sem nonce (o app evita middleware de propósito — dodge do CVE-2025-29927), então o Next precisa de
// 'unsafe-inline' no bootstrap de hidratação. 'unsafe-eval' e ws: entram SÓ em dev (webpack/HMR). [hardening T1]
const isDev = process.env.NODE_ENV !== "production";

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  // anexo de imagem exibido inline (lightbox) via URL assinada de curta duração do Blob privado. [anexos B]
  "img-src 'self' data: blob: https://*.blob.vercel-storage.com",
  "font-src 'self' data:",
  // upload de anexo: XHR PUT direto pro Blob (API de controle vercel.com + host de storage do redirect). [anexos B]
  `connect-src 'self' https://vercel.com https://*.blob.vercel-storage.com${isDev ? " ws:" : ""}`,
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  // HSTS: navegadores ignoram sobre http (dev), aplica em prod https.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
