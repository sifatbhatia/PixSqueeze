/** @type {import('next').NextConfig} */
const nextConfig = {
  api: {
    bodyParser: {
      sizeLimit: '50mb', // Increased to 50MB
    },
    responseLimit: '50mb', // Also increased response limit
  },
  images: {
    domains: ['localhost'],
  },
};

export default nextConfig;
