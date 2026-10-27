const slug = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const ddmmaa = (iso: string) => { const [y = "", m = "", d = ""] = iso.split("-"); return `${d}${m}${y.slice(2)}`; };
const cssText = (s: string) => `"${s.replace(/["\\]/g, "\\$&")}"`;

/** Wait for report assets, then let the browser save a vector A4 PDF named like painel-resultados_cliente_ddmmaa-ddmmaa. */
export async function printPanel(cliente: string, de: string, ate: string, relatorio = "Painel de Resultados") {
  await document.fonts.ready;
  await Promise.all(Array.from(document.querySelectorAll<HTMLImageElement>(".panel-report img")).map(async (img) => {
    try { await img.decode(); } catch { /* The text logo remains readable if an image fails. */ }
  }));
  // Page footer with the report name and "n / total", drawn in the page margin on every printed page.
  const footer = document.createElement("style");
  footer.textContent = `@media print { @page {
    @bottom-left { content: ${cssText(`Atlas Assessoria · ${relatorio} · ${cliente}`)}; font: 7pt Inter, sans-serif; color: #7b8794; }
    @bottom-right { content: counter(page) " / " counter(pages); font: 7pt Inter, sans-serif; color: #7b8794; }
  } }`;
  document.head.appendChild(footer);
  const originalTitle = document.title;
  const restore = () => { document.title = originalTitle; footer.remove(); };
  document.title = `${slug(relatorio)}_${slug(cliente)}_${ddmmaa(de)}-${ddmmaa(ate)}`;
  window.addEventListener("afterprint", restore, { once: true });
  window.print();
}
