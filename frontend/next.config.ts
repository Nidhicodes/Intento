import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // The repo has lockfiles at both root and frontend/. Pin the workspace root
  // to this folder so Next/Turbopack (and Vercel) resolve modules correctly.
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
