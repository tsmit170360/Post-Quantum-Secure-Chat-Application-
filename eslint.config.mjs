/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    // Enable WebAssembly support
    config.experiments = { 
      ...config.experiments, 
      asyncWebAssembly: true,
      layers: true,
    };
    return config;
  },
};

export default nextConfig;
