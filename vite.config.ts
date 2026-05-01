import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  // Explicitly set publicDir + copyPublicDir so dotfile dirs (e.g. .well-known/)
  // under public/ are guaranteed to be emitted to dist/. Required for Android
  // App Links auto-verification (assetlinks.json) and similar.
  publicDir: "public",
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    {
      // Vite's built-in publicDir copier skips dotfile directories (e.g. .well-known/),
      // so we copy them explicitly. Required for Android App Links (assetlinks.json).
      // MUST run before assert-wellknown-assetlinks below — plugin order matters for closeBundle.
      name: "copy-wellknown",
      apply: "build" as const,
      closeBundle() {
        const srcDir = path.resolve(__dirname, "public/.well-known");
        const destDir = path.resolve(__dirname, "dist/.well-known");
        if (!fs.existsSync(srcDir)) {
          throw new Error(
            "[build] public/.well-known/ missing in source — cannot emit assetlinks.json"
          );
        }
        fs.mkdirSync(destDir, { recursive: true });
        for (const entry of fs.readdirSync(srcDir)) {
          const from = path.join(srcDir, entry);
          const to = path.join(destDir, entry);
          if (fs.statSync(from).isFile()) {
            fs.copyFileSync(from, to);
          }
        }
      },
    },
    {
      // Post-build assertion: fail loudly if assetlinks.json is missing from dist.
      // Prevents silent regressions of Android App Link verification.
      name: "assert-wellknown-assetlinks",
      apply: "build" as const,
      closeBundle() {
        const p = path.resolve(__dirname, "dist/.well-known/assetlinks.json");
        if (!fs.existsSync(p)) {
          throw new Error(
            "[build] dist/.well-known/assetlinks.json missing — Android App Links will fail. " +
              "Ensure public/.well-known/assetlinks.json is present."
          );
        }
      },
    },
  ].filter(Boolean),
  build: {
    copyPublicDir: true,
  },
  define: {
    __BUILD_TIMESTAMP__: JSON.stringify(new Date().toISOString().replace("T", " ").replace("Z", " UTC")),
    __BUILD_FINGERPRINT__: JSON.stringify(`build-${Date.now()}`),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@radix-ui/react-tooltip",
    ],
  },
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@radix-ui/react-tooltip",
    ],
    force: true,
  },
}));
