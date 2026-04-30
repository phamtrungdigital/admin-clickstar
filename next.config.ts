import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Default is 1MB. The contract form uploads PDFs directly to
      // Supabase Storage from the browser (so it bypasses this limit),
      // but bump the cap so small-payload actions submitting FormData
      // with a file don't silently fail.
      bodySizeLimit: "5mb",
    },
  },
};

export default nextConfig;
