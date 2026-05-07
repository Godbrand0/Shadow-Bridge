import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        path: false,
        os: false,
        http: false,
        https: false,
        zlib: false,
        // Suppress optional peer deps pulled in by wagmi connectors
        "@react-native-async-storage/async-storage": false,
        "pino-pretty": false,
      };
    }
    // Suppress warnings from FHE SDK wasm modules
    config.ignoreWarnings = [
      ...(config.ignoreWarnings ?? []),
      { module: /node_modules\/@zama-fhe/ },
    ];
    return config;
  },
  // Allow @zama-fhe packages to be transpiled for browser
  transpilePackages: ["@zama-fhe/relayer-sdk"],
};

export default nextConfig;
