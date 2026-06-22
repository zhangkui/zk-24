import { defineConfig } from "vite";
import { qwikVite } from "@builder.io/qwik/optimizer";
import { qwikCity } from "@builder.io/qwik-city/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { macroPlugin } from "@builder.io/vite-plugin-macro";

export default defineConfig(() => {
  return {
    plugins: [macroPlugin({
      packages: ["@builder.io/qwik/optimizer", "@builder.io/qwik-city"]
    }), qwikCity(), qwikVite(), tsconfigPaths()],
    preview: {
      headers: {
        "Cache-Control": "public, max-age=600",
      },
    },
    server: {
      headers: {
        "Cache-Control": "public, max-age=0",
      },
      proxy: {
        "/api": {
          target: "http://127.0.0.1:3001",
          changeOrigin: true,
          ws: true,
        },
      },
    },
    dev: {
      headers: {
        "Cache-Control": "public, max-age=0",
      },
    },
  };
});
