/*
 * WHAT IS THIS FILE?
 * It's the entry point for the Express HTTP server when building for production.
 */
import { createQwikCity } from "@builder.io/qwik-city/middleware/node";
import qwikCityPlan from "@qwik-city-plan";
import render from "./entry.ssr";
import { manifest } from "@qwik-client-manifest";
import express from "express";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

// Directories where the static assets are located
const distDir = join(fileURLToPath(import.meta.url), "..", "..", "dist");
const buildDir = join(distDir, "build");

// Allow for dynamic port
const PORT = process.env.FRONTEND_PORT ?? 5173;
const BACKEND_URL = process.env.BACKEND_URL ?? "http://127.0.0.1:3001";

// Create the Qwik City express middleware
const { router, notFound, staticFile } = createQwikCity({
  render,
  qwikCityPlan,
  manifest,
});

// Create the express server
const app = express();

// Enable gzip compression
import compression from "compression";
app.use(compression());

// Proxy API requests to backend
import httpProxy from "http-proxy";
const proxy = httpProxy.createProxyServer({});
app.all("/api/*", (req, res) => {
  proxy.web(req, res, { target: BACKEND_URL, ws: true }, (err) => {
    console.error("Proxy error:", err);
    res.status(502).send("Backend unavailable");
  });
});
app.on("upgrade", (req, socket, head) => {
  if (req.url?.startsWith("/api/")) {
    proxy.ws(req, socket, head, { target: BACKEND_URL });
  }
});

// Static asset handlers
app.use(`/build`, express.static(buildDir, { immutable: true, maxAge: "1y" }));
app.use(express.static(distDir, { redirect: false }));

// Use Qwik City's page and endpoint request handler
app.use(router);

// Use Qwik City's 404 handler
app.use(notFound);

// Start the express server
app.listen(PORT, () => {
  /* eslint-disable */
  console.log(`Server started: http://localhost:${PORT}/`);
  console.log(`Backend proxy: ${BACKEND_URL}`);
});

export { app };
