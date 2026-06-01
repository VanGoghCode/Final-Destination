// API key resolution utility
// Checks process.env first, then falls back to fd_api_key cookie (set by client-side ModelSelector)

const COOKIE_NAME = "fd_api_key";

/**
 * Resolve the DeepSeek API key from environment or browser-set cookie.
 * Server-side only — uses next/headers cookies().
 */
export function getDeepSeekApiKey(): string | undefined {
  // Priority 1: environment variable
  if (process.env.DEEPSEEK_API_KEY) {
    return process.env.DEEPSEEK_API_KEY;
  }

  // Priority 2: cookie set by client-side API key manager
  try {
    // next/headers only works in server context (route handlers, server components)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { cookies } = require("next/headers") as {
      cookies: () => { get: (name: string) => { value: string } | undefined };
    };
    const cookieStore = cookies();
    const cookie = cookieStore.get(COOKIE_NAME);
    if (cookie?.value) {
      return cookie.value;
    }
  } catch {
    // Not in a request context (e.g., build time, client side) — ignore
  }

  return undefined;
}
