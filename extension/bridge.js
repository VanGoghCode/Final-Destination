// Runs only in the configured app tab. Queue data stays in that website's browser storage.
chrome.runtime.onMessage.addListener((message, _sender, reply) => {
  if (message?.type !== "fd-app-request") return;
  (async () => {
    const saved = await chrome.storage.local.get("fd_server_url");
    const url = new URL(saved.fd_server_url || "http://localhost:3000");
    if (location.origin !== url.origin) {
      reply({ status: 403, body: { error: "Wrong app tab" } });
      return;
    }
    if (
      !(
        (message.path === "/api/profiles" && message.method === "GET") ||
        (message.path === "/api/queue" && message.method === "POST")
      )
    ) {
      reply({ status: 400, body: { error: "Unsupported extension action" } });
      return;
    }
    const id = crypto.randomUUID();
    const timer = setTimeout(() => {
      window.removeEventListener("message", receive);
      reply({
        status: 503,
        body: { error: "Open or refresh the app, then reload the extension and retry." },
      });
    }, 15_000);
    function receive(event) {
      if (
        event.source !== window ||
        event.origin !== location.origin ||
        event.data?.type !== "fd-extension-response" ||
        event.data.id !== id
      )
        return;
      clearTimeout(timer);
      window.removeEventListener("message", receive);
      reply({ status: event.data.status, body: event.data.body });
    }
    window.addEventListener("message", receive);
    window.postMessage(
      {
        type: "fd-extension-request",
        id,
        path: message.path,
        method: message.method,
        body: message.body,
      },
      location.origin,
    );
  })().catch(() => reply({ status: 503, body: { error: "Could not connect to the app tab" } }));
  return true;
});
