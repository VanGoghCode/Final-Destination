const PRODUCTION_ORIGIN = "https://final-destination-rose.vercel.app";
const PDF_NAMES = new Set(["Kirtan_Thummar_resume.pdf", "Kirtan_Thummar_cover_letter.pdf"]);

function waitForDownload(id) {
  return new Promise((resolve, reject) => {
    const finish = (error) => {
      clearTimeout(timer);
      chrome.downloads.onChanged.removeListener(changed);
      if (error) reject(error);
      else resolve();
    };
    const check = (state, error) => {
      if (state === "complete") finish();
      else if (state === "interrupted")
        finish(
          new Error(`Could not save PDF in Downloads\\apply: ${error || "download interrupted"}`),
        );
    };
    const changed = (delta) => {
      if (delta.id === id) check(delta.state?.current, delta.error?.current);
    };
    const timer = setTimeout(
      () => finish(new Error("PDF save timed out. Check your browser downloads before retrying.")),
      60_000,
    );
    chrome.downloads.onChanged.addListener(changed);
    chrome.downloads.search({ id }).then(
      ([item]) => check(item?.state, item?.error),
      (error) => finish(error),
    );
  });
}

chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (message?.type !== "fd-pdf-download") return;
  (async () => {
    const saved = await chrome.storage.local.get("fd_server_url");
    const configuredOrigin = new URL(saved.fd_server_url || PRODUCTION_ORIGIN).origin;
    const senderOrigin = new URL(sender.url).origin;
    if (
      sender.id !== chrome.runtime.id ||
      ![PRODUCTION_ORIGIN, configuredOrigin].includes(senderOrigin)
    )
      throw new Error("PDF saving is only available from your Final Destination app.");
    if (!chrome.downloads?.download)
      throw new Error(
        "Reload the updated Final Destination extension and allow its download permission.",
      );
    if (message.action === "ping") {
      reply({ ok: true });
      return;
    }
    if (
      message.action !== "save" ||
      !PDF_NAMES.has(message.fileName) ||
      typeof message.pdfBase64 !== "string" ||
      message.pdfBase64.length > 40 * 1024 * 1024 ||
      !atob(message.pdfBase64.slice(0, 8)).startsWith("%PDF-")
    )
      throw new Error("Unsupported PDF download.");

    // The browser creates missing subdirectories beneath its Downloads directory.
    const id = await chrome.downloads.download({
      url: `data:application/pdf;base64,${message.pdfBase64}`,
      filename: `apply/${message.fileName}`,
      conflictAction: "overwrite",
      saveAs: false,
    });
    if (!Number.isInteger(id)) throw new Error("The browser could not start the PDF download.");
    await waitForDownload(id);
    reply({ ok: true });
  })().catch((error) => reply({ ok: false, error: error.message || "Could not save PDF." }));
  return true;
});
