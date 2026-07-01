/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: false,
  },
  transpilePackages: ["geist"],
  compiler: {
    removeConsole: process.env.NODE_ENV === "production" ? true : false,
  },
  output: 'standalone',
};

export default nextConfig;
