// Shared CORS utility — reads ALLOWED_ORIGINS from env, falls back to same-origin

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
  : [];

export type CorsHeaders = Record<string, string> & {
  "Access-Control-Allow-Origin": string;
  "Access-Control-Allow-Methods": string;
  "Access-Control-Allow-Headers": string;
};

let defaultMethods = "GET, POST, PUT, PATCH, DELETE, OPTIONS";
let defaultHeaders = "Content-Type, Authorization";

export function setCorsDefaults(methods: string, headers: string) {
  defaultMethods = methods;
  defaultHeaders = headers;
}

export function corsHeaders(methods?: string, origin?: string): CorsHeaders {
  // Chrome extension origin (chrome-extension://<random-id>) is never known ahead of time.
  // Default to "*" so the extension works everywhere — localhost and deployed.
  // Set ALLOWED_ORIGINS env var to restrict to specific domains when frontend is served
  // from a different origin than the API. Multiple origins can be comma-separated.
  // Match request origin against allowed list, default to "*" for extension
  const firstOrigin = ALLOWED_ORIGINS[0];
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : firstOrigin || "*";

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": methods ?? defaultMethods,
    "Access-Control-Allow-Headers": defaultHeaders,
  };
}

/**
 * Handle preflight OPTIONS request with CORS headers.
 * Usage: export { OPTIONS } from the route, or call handleOptions() directly.
 */
export function handleOptions(methods?: string) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(methods),
  });
}
