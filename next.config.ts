import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["knex", "better-sqlite3"],
};

export default nextConfig;
