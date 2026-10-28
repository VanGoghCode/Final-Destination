import { afterEach, beforeEach, expect, it, spyOn } from "bun:test";
import { openBrowser } from "./__tests__/browser";
import { mockPdfExtension } from "./__tests__/pdf-extension";
import { savePdf } from "./pdf-download";
let close: () => void;
beforeEach(() => {
  close = openBrowser().close;
});
afterEach(() => close());
it("saves both fixed filenames through the extension without a duplicate browser download", async () => {
  const saves: string[][] = [];
  const bridge = mockPdfExtension(async (name, pdf) => {
    saves.push([name, atob(pdf)]);
  });
  const click = spyOn(document.createElement("a").constructor.prototype, "click");
  try {
    await savePdf("Kirtan_Thummar_resume.pdf", btoa("%PDF-first"));
    await savePdf("Kirtan_Thummar_resume.pdf", btoa("%PDF-new"));
    await savePdf("Kirtan_Thummar_cover_letter.pdf", btoa("%PDF-cover"));
    expect(saves).toEqual([
      ["Kirtan_Thummar_resume.pdf", "%PDF-first"],
      ["Kirtan_Thummar_resume.pdf", "%PDF-new"],
      ["Kirtan_Thummar_cover_letter.pdf", "%PDF-cover"],
    ]);
    expect(click).not.toHaveBeenCalled();
  } finally {
    bridge.mockRestore();
    click.mockRestore();
  }
});
it("reports extension errors without downloading into the wrong folder", async () => {
  const bridge = mockPdfExtension(async () => {
    throw new Error("disk full");
  });
  try {
    await expect(savePdf("Kirtan_Thummar_resume.pdf", btoa("%PDF-new"))).rejects.toThrow(
      "disk full",
    );
  } finally {
    bridge.mockRestore();
  }
});
it("explains setup when the extension is missing", async () => {
  const send = spyOn(window, "postMessage").mockImplementation(() => {});
  try {
    await expect(savePdf("Kirtan_Thummar_resume.pdf", btoa("%PDF-new"))).rejects.toThrow(
      "Install the Final Destination extension",
    );
    expect(send).toHaveBeenCalledTimes(1);
  } finally {
    send.mockRestore();
  }
}, 10_000);
