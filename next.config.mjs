/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Previously misplaced inside `resolve.fallback`, where it was a no-op.
  devIndicators: false,
  // Next 16.3 writes AGENTS.md/CLAUDE.md into the project root on dev startup.
  agentRules: false,
  webpack: (config) => {
    // The Emscripten module is loaded from /public at runtime rather than
    // bundled, but keep WebAssembly support enabled for future imports.
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };
    return config;
  },
};

export default nextConfig;
