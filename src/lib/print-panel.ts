import { fmtDate } from "./format";

/** Wait for report assets, then let the browser save a vector A4 PDF. */
export async function printPanel(cliente: string, de: string, ate: string) {
  await document.fonts.ready;
  await Promise.all(Array.from(document.querySelectorAll<HTMLImageElement>(".panel-report img")).map(async (img) => {
    try { await img.decode(); } catch { /* The text logo remains readable if an image fails. */ }
  }));
  const originalTitle = document.title;
  const restore = () => { document.title = originalTitle; };
  document.title = `Atlas - ${cliente} - ${fmtDate(de)} a ${fmtDate(ate)}`;
  window.addEventListener("afterprint", restore, { once: true });
  window.print();
}