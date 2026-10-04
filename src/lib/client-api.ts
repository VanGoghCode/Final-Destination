import { getAdminHeaders } from "./client-admin";
import { getAIHeaders } from "./client-ai";

export function apiFetch(input: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  for (const [name, value] of Object.entries({ ...getAdminHeaders(), ...getAIHeaders() }))
    if (!headers.has(name)) headers.set(name, value);
  return fetch(input, { ...init, headers });
}
export async function apiJSON<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await apiFetch(input, init);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data as T;
}
