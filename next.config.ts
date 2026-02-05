import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Externalize Prisma client to avoid bundling issues with custom output path
  // serverExternalPackages: ["@prisma/client"],
};

export default nextConfig;
