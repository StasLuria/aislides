/**
 * Backend Proxy — forwards /api/v1/* and /ws/* to the FastAPI backend.
 *
 * In development: proxies to BACKEND_URL (default http://localhost:8001)
 * In production: proxies to BACKEND_URL env var (must be set)
 *
 * This allows the frontend to make relative requests (/api/v1/presentations)
 * and have them transparently forwarded to the Python backend.
 */
import type { Express } from "express";
import type { Server } from "http";
import { createProxyMiddleware, type Options } from "http-proxy-middleware";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8001";

export function registerBackendProxy(app: Express, server: Server) {
  console.log(`[Proxy] Backend URL: ${BACKEND_URL}`);

  // Proxy /api/v1/* → FastAPI backend
  const apiProxyOptions: Options = {
    target: BACKEND_URL,
    changeOrigin: true,
    // Don't rewrite path — forward as-is
    pathFilter: "/api/v1/**",
    on: {
      proxyReq: (_proxyReq, req) => {
        console.log(`[Proxy] ${req.method} ${req.url} → ${BACKEND_URL}${req.url}`);
      },
      error: (err, _req, res) => {
        console.error(`[Proxy] API error:`, err.message);
        if (res && "writeHead" in res && typeof res.writeHead === "function") {
          (res as any).writeHead(502, { "Content-Type": "application/json" });
          (res as any).end(
            JSON.stringify({
              error: "Backend unavailable",
              detail: "The presentation backend is not reachable. Please check BACKEND_URL configuration.",
            })
          );
        }
      },
    },
  };

  app.use(createProxyMiddleware(apiProxyOptions));

  // Proxy /health → FastAPI backend health check
  const healthProxyOptions: Options = {
    target: BACKEND_URL,
    changeOrigin: true,
    pathFilter: "/health",
  };

  app.use(createProxyMiddleware(healthProxyOptions));

  // WebSocket proxy for /ws/* → FastAPI backend
  const wsProxy = createProxyMiddleware({
    target: BACKEND_URL,
    changeOrigin: true,
    ws: true,
    pathFilter: "/ws/**",
    on: {
      proxyReqWs: (_proxyReq, req) => {
        console.log(`[Proxy] WS upgrade: ${req.url} → ${BACKEND_URL}${req.url}`);
      },
      error: (err) => {
        console.error(`[Proxy] WS error:`, err.message);
      },
    },
  });

  app.use(wsProxy);

  // Also handle WebSocket upgrade events on the HTTP server
  server.on("upgrade", (req, socket, head) => {
    if (req.url?.startsWith("/ws/")) {
      (wsProxy as any).upgrade(req, socket, head);
    }
  });

  console.log(`[Proxy] Registered API proxy (/api/v1/*) and WS proxy (/ws/*)`);
}
