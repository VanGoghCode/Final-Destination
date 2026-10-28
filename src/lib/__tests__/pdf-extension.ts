import { spyOn } from "bun:test";

export function mockPdfExtension(save: (fileName: string, pdf: string) => Promise<void>) {
  return spyOn(window, "postMessage").mockImplementation((message) => {
    if (message?.type !== "fd-pdf-request") return;
    void (async () => {
      let error: string | undefined;
      try {
        if (message.action === "save") await save(message.fileName, message.pdfBase64);
      } catch (failure) {
        error = failure instanceof Error ? failure.message : "Save failed";
      }
      window.dispatchEvent(
        new window.MessageEvent("message", {
          source: window,
          origin: window.location.origin,
          data: { type: "fd-pdf-response", id: message.id, ok: !error, error },
        }),
      );
    })();
  });
}
