// Admin authentication middleware
// Protects sensitive API routes with an API key

import { NextResponse } from "next/server";

/**
 * Validates admin API key from request headers.
 * Checks x-api-key header first, then Authorization Bearer token.
 */
export function validateAdminRequest(request: Request): boolean {
  const adminKey = process.env.ADMIN_API_KEY;
  if (!adminKey) {
    // No admin key configured — deny all admin access in production
    return false;
  }

  // Check x-api-key header
  const apiKey = request.headers.get("x-api-key");
  if (apiKey && apiKey === adminKey) return true;

  // Check Authorization Bearer token
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ") && authHeader.slice(7) === adminKey) {
    return true;
  }

  return false;
}

/**
 * Returns a 401 response for unauthorized admin requests.
 */
export function adminUnauthorizedResponse() {
  return NextResponse.json(
    { error: "Unauthorized. Provide a valid x-api-key or Authorization header." },
    { status: 401 },
  );
}
