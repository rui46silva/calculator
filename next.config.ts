import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Keep pg as a regular Node dependency instead of bundling it.
  serverExternalPackages: ['pg'],
};

export default nextConfig;
