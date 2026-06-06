// API key resolution utility
// Priority 1: process.env.DEEPSEEK_API_KEY (server environment)
// Priority 2: fd_api_key cookie (set by client-side ModelSelector via document.cookie)

const COOKIE_NAME = "fd_api_key";

/**
 * Resolve the DeepSeek API key from environment or browser-set cookie.
 * Async — cookies() in Next.js 16+ returns a Promise.
 * Uses dynamic import so tests (Bun) can import this module without next/headers.
 */
export async function getDeepSeekApiKey(): Promise<string | undefined> {
  // Priority 1: environment variable (sync — return immediately)
  if (process.env.DEEPSEEK_API_KEY) {
    return process.env.DEEPSEEK_API_KEY;
  }

  // Priority 2: cookie set by client-side API key manager
  try {
    const { cookies } = await import("next/headers");
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
