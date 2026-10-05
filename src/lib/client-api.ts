import { localRequest } from "./local-api";
import { getAIHeaders } from "./client-ai";

export async function apiFetch(input: string, init: RequestInit = {}) {
  if (typeof window !== "undefined") {
    const local = await localRequest(input, init);
    if (local) return local;
  }
  const headers = new Headers(init.headers);
  if (
    typeof window !== "undefined" &&
    new URL(input, window.location.origin).origin === window.location.origin
  )
    for (const [name, value] of Object.entries(getAIHeaders()))
      if (!headers.has(name)) headers.set(name, value);
  return fetch(input, { ...init, headers });
}
export class APIError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
export async function apiJSON<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await apiFetch(input, init);
  const data = await response.json().catch(() => null);
  if (!response.ok)
    throw new APIError(data?.error || `Request failed (${response.status})`, response.status);
  if (data === null) throw new Error("The server returned an invalid response. Retry this job.");
  return data as T;
}
