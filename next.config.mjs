/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    // 1. Fix for "Can't resolve 'fs'"
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,    // Ignore file system
        path: false,  // Ignore file paths
        crypto: false, // Ignore Node crypto (use browser crypto instead)
        devIndicator:false
      };
    }

    // 2. Enable WebAssembly (Keep this just in case)
    config.experiments = { 
      ...config.experiments, 
      asyncWebAssembly: true,
      layers: true,
    };

    return config;
  },
};

export default nextConfig;