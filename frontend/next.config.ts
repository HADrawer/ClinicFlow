import type { NextConfig } from "next";
import os from "node:os";

// Server-only: read at build/dev/start time by the Next.js config loader
// (Node.js), never bundled into client code. The browser only ever talks to
// this frontend's own origin via the /backend-api/* proxy below — it never
// sees this value.
function backendOrigin(): string {
  const raw = process.env.BACKEND_API_ORIGIN;
  if (!raw || !raw.trim()) {
    throw new Error(
      "BACKEND_API_ORIGIN is not set. Set it to the backend's origin " +
        '(e.g. "http://backend:8000" for Docker Compose, or the deployed ' +
        "FastAPI project's URL on Vercel) so the /backend-api/* proxy in " +
        "next.config.ts can reach it.",
    );
  }
  // Normalize: drop a trailing slash, then drop a trailing /api if someone
  // configured the origin with the API prefix already included, so the
  // rewrite below never ends up requesting .../api/api/....
  return raw.trim().replace(/\/+$/, "").replace(/\/api$/, "");
}

// Lets the Next.js dev server accept requests from this machine's own LAN
// address(es) — e.g. a phone on the same network opening
// http://<lan-ip>:3000 — without hardcoding or tracking any specific IP.
// Interfaces are re-read on every dev server start, so a DHCP-assigned IP
// change never requires touching this file or an env var.
function lanDevOrigins(): string[] {
  const addresses: string[] = [];
  for (const iface of Object.values(os.networkInterfaces())) {
    for (const info of iface ?? []) {
      if (info.family === "IPv4" && !info.internal) addresses.push(info.address);
    }
  }
  return addresses;
}

const nextConfig: NextConfig = {
  output: "standalone",

  allowedDevOrigins:
    process.env.NODE_ENV === "development"
      ? ["127.0.0.1", "localhost", ...lanDevOrigins()]
      : [],

  // Same-origin API proxy: the browser requests /backend-api/*, and Next.js
  // forwards it server-side to ${BACKEND_API_ORIGIN}/api/*. The browser
  // never learns the backend's real host, port, or origin — local Docker
  // hostname, LAN IP, or the deployed Vercel backend URL alike. This is the
  // only place that distinction is resolved.
  async rewrites() {
    const origin = backendOrigin();
    return [
      {
        source: "/backend-api/:path*",
        destination: `${origin}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
