import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: __dirname,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "assets.coingecko.com" },
      { protocol: "https", hostname: "tokens.coingecko.com" },
      { protocol: "https", hostname: "raw.githubusercontent.com" },
      { protocol: "https", hostname: "logos.covalenthq.com" },
    ],
  },
  webpack: (config, { isServer }) => {
    config.externals.push("pino-pretty", "lokijs", "encoding");

    // Replace @react-native-async-storage with empty module in ALL bundles
    // This prevents it from being inlined as invalid typeof syntax by webpack
    config.module = config.module ?? {};
    config.module.rules = config.module.rules ?? [];
    config.module.rules.push({
      test: /node_modules\/@metamask\/sdk.*\.js$/,
      resolve: {
        alias: {
          "@react-native-async-storage/async-storage": path.resolve(
            __dirname,
            "lib/empty-module.js"
          ),
        },
      },
    });

    // Also alias at the top level for any direct imports
    config.resolve.alias = {
      ...config.resolve.alias,
      "@react-native-async-storage/async-storage": path.resolve(
        __dirname,
        "lib/empty-module.js"
      ),
    };

    return config;
  },
  serverExternalPackages: ["pino", "x402-next", "x402"],
};

export default nextConfig;
