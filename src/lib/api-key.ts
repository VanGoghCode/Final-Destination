// API key resolution utility
// Priority 1: process.env.DEEPSEEK_API_KEY (server environment)
// Priority 2: fd_api_key cookie (set by client-side ModelSelector via document.cookie)

const COOKIE_NAME = "fd_api_key";

/**
 * Resolve the DeepSeek API key from environment, request header, or browser-set cookie.
 * Async — cookies()/headers() in Next.js 16+ returns a Promise.
 * Uses dynamic import so tests (Bun) can import this module without next/headers.
 */
export async function getDeepSeekApiKey(): Promise<string | undefined> {
  // Priority 1: environment variable (sync — return immediately)
  if (process.env.DEEPSEEK_API_KEY) {
    return process.env.DEEPSEEK_API_KEY;
  }

  try {
    const { cookies, headers } = await import("next/headers");

    // Priority 2: x-deepseek-api-key header (explicit client header, more reliable than cookie)
    const headersList = await headers();
    const headerKey = headersList.get("x-deepseek-api-key");
    if (headerKey) {
      return headerKey;
    }

    // Priority 3: cookie set by client-side API key manager
    const cookieStore = await cookies();
    const cookie = cookieStore.get(COOKIE_NAME);
    if (cookie?.value) {
      return cookie.value;
    }
  } catch {
    // Not in a Next.js request context (e.g., build time, tests, client side) — ignore
  }

  return undefined;
}
