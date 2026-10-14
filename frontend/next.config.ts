import { existsSync } from "node:fs";
import path from "node:path";
import { PrismaPlugin } from "@prisma/nextjs-monorepo-workaround-plugin";
import type { NextConfig } from "next";

// Locally, all apps share the repo-root .env (real env vars win). On Vercel there is no file:
// env vars come from the project settings.
const rootEnv = path.join(process.cwd(), "..", ".env");
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const nextConfig: NextConfig = {
  // Workspace packages ship TypeScript source; let Next compile them.
  transpilePackages: ["@uptime/shared", "@uptime/database"],
  // Keep these as plain Node requires on the server instead of bundling them.
  serverExternalPackages: ["bullmq", "ioredis", "bcryptjs"],
  // ESLint runs once for the whole monorepo (`pnpm lint` at the root, and in CI).
  eslint: { ignoreDuringBuilds: true },
  webpack: (config, { isServer }) => {
    // Copies Prisma's query engine next to the server bundle in a pnpm monorepo (needed on Vercel).
    if (isServer) config.plugins = [...config.plugins, new PrismaPlugin()];
    return config;
  },
};

export default nextConfig;
