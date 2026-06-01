// Client-side admin key management
// Stores the admin API key in localStorage so browser requests can include it.
// Server validates against ADMIN_API_KEY env var via admin-auth.ts.

const STORAGE_KEY = "fd_admin_key";

export function getAdminKey(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_KEY);
}

export function setAdminKey(key: string): void {
  localStorage.setItem(STORAGE_KEY, key);
}

export function removeAdminKey(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function hasAdminKey(): boolean {
  return !!getAdminKey();
}

/** Returns headers with admin key for API requests. Empty if key not configured. */
export function getAdminHeaders(): Record<string, string> {
  const key = getAdminKey();
  if (!key) return {};
  return { "x-api-key": key };
}
