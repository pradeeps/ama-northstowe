/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  env: {
    NODE_ENV: process.env.NODE_ENV || 'production',
  },
}

module.exports = nextConfig
