/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow large image uploads
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
};

export default nextConfig;
