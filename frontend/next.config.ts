import { existsSync } from "node:fs";
import path from "node:path";
import { PrismaPlugin } from "@prisma/nextjs-monorepo-workaround-plugin";
import type { NextConfig } from "next";

// Locally, all apps share the repo-root .env (real env vars win). On Vercel there is no file:
// env vars come from the project settings.
const rootEnv = path.join(process.cwd(), "..", ".env");
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const isDev = process.env.NODE_ENV !== "production";

/**
 * Content-Security-Policy: only our own origin may run scripts, load data or embed us.
 * 'unsafe-inline' scripts are needed by Next.js' inline bootstrap and our no-flash theme script;
 * React's escaping is the primary XSS defence, CSP is the second layer.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://lh3.googleusercontent.com https://avatars.githubusercontent.com",
  "font-src 'self' data:",
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self' https://accounts.google.com https://github.com",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]),
];

const nextConfig: NextConfig = {
  // Workspace packages ship TypeScript source; let Next compile them.
  transpilePackages: ["@uptime/shared", "@uptime/database"],
  // Keep these as plain Node requires on the server instead of bundling them.
  serverExternalPackages: ["bullmq", "ioredis", "bcryptjs"],
  // ESLint runs once for the whole monorepo (`pnpm lint` at the root, and in CI).
  eslint: { ignoreDuringBuilds: true },
  // Don't advertise the framework, and never ship browser source maps.
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  webpack: (config, { isServer }) => {
    // Copies Prisma's query engine next to the server bundle in a pnpm monorepo (needed on Vercel).
    if (isServer) config.plugins = [...config.plugins, new PrismaPlugin()];
    return config;
  },
};

export default nextConfig;
