const EXTENSION_SETUP_MESSAGE =
  "Install the Final Destination extension from /final-destination-extension.zip, allow its download permission, then refresh this page to save PDFs in Downloads\\apply.";

function requestPdfExtension(payload: object, timeoutMs: number) {
  return new Promise<void>((resolve, reject) => {
    const id = crypto.randomUUID();
    const origin = window.location.origin;
    const finish = (error?: Error) => {
      clearTimeout(timer);
      window.removeEventListener("message", receive);
      if (error) reject(error);
      else resolve();
    };
    const receive = (event: MessageEvent) => {
      if (
        event.source !== window ||
        event.origin !== origin ||
        event.data?.type !== "fd-pdf-response" ||
        event.data.id !== id
      )
        return;
      finish(
        event.data.ok === true
          ? undefined
          : new Error(event.data.error || "Could not save the PDF in Downloads\\apply."),
      );
    };
    const timer = setTimeout(() => finish(new Error(EXTENSION_SETUP_MESSAGE)), timeoutMs);
    window.addEventListener("message", receive);
    window.postMessage({ type: "fd-pdf-request", id, ...payload }, origin);
  });
}

export async function savePdf(fileName: string, pdfBase64: string) {
  await requestPdfExtension({ action: "ping" }, 5000);
  await requestPdfExtension({ action: "save", fileName, pdfBase64 }, 70_000);
}
