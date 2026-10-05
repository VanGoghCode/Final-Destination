import { apiFetch } from "./client-api";

export function installExtensionBridge() {
  const receive = async (event: MessageEvent) => {
    if (event.source !== window || event.origin !== window.location.origin) return;
    const data = event.data;
    if (data?.type !== "fd-extension-request" || typeof data.id !== "string") return;
    const reply = (value: object) =>
      window.postMessage(
        { type: "fd-extension-response", id: data.id, ...value },
        window.location.origin,
      );
    if (
      !(
        (data.path === "/api/profiles" && data.method === "GET") ||
        (data.path === "/api/queue" && data.method === "POST")
      )
    )
      return;
    try {
      const response = await apiFetch(data.path, {
        method: data.method,
        body: data.method === "POST" ? JSON.stringify(data.body) : undefined,
      });
      if (response) reply({ status: response.status, body: await response.json() });
    } catch {
      reply({ status: 503, body: { error: "Shared queue is unavailable. Retry the submission." } });
    }
  };
  window.addEventListener("message", receive);
  return () => window.removeEventListener("message", receive);
}
