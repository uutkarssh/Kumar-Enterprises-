// Invoice PDF generator — reuses the EXACT same DOM/CSS as Print.
// Download PDF captures the real .print-area element (the one window.print() uses)
// via html-to-image, so the two outputs are visually identical: same logo, same
// colors at full opacity, same borders, same ₹ glyph. No separate PDF template.
//
// Bug 1 fix: there is no longer a second invoice template. Download PDF and Print
//   both render the same .print-area component.
// Bug 2 fix: (a) await document.fonts.ready before capture so fonts/colors apply,
//   (b) print-color-adjust: exact on .print-area (in globals.css) so browsers don't
//   lighten colors, (c) pixelRatio: 2 for crisp text. ₹ (U+20B9) renders correctly
//   because the browser's real font rendering is used, not jsPDF's Helvetica.
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toPng } from "html-to-image";
import type { AppSettings, Invoice } from "./types";

const INK = "#0a0a0a";
const GOLD = "#f0a800";
const LIGHT = "#f4f4f5";

/**
 * Generate a downloadable PDF from the same .print-area DOM element that
 * window.print() uses. Produces output visually identical to Print.
 *
 * @param element  — the .print-area HTMLElement (ref.current)
 * @param inv      — the invoice (used only for the filename)
 * @param _settings — unused (kept for API compatibility; all styling comes from the DOM)
 */
export async function generateInvoicePdf(
  element: HTMLElement,
  inv: Invoice,
  _settings?: AppSettings,
  _opts: { download?: boolean; returnDataUrl?: boolean; filename?: string } = {}
): Promise<{ dataUrl?: string; filename: string }> {
  // Bug 2(a): wait for web fonts (Inter / Barlow Condensed) to be fully loaded
  // so the capture uses the correct typeface — including the ₹ glyph.
  if (typeof document !== "undefined" && "fonts" in document) {
    try {
      await (document as any).fonts.ready;
    } catch {
      // best-effort; proceed even if fonts.ready rejects
    }
  }
  // Small extra delay to ensure paint + print-color-adjust styles are applied.
  await new Promise((r) => setTimeout(r, 120));

  // Bug 2(c): pixelRatio 2 for crisp, non-washed-out text.
  // Bug 1: capturing the real DOM = same logo, colors, borders, ₹ as Print.
  const dataUrl = await toPng(element, {
    pixelRatio: 2,
    backgroundColor: "#ffffff",
    cacheBust: true,
    // Ensure the element renders at its natural width (A4-ish) for the capture
    style: {
      margin: "0",
      borderRadius: "0",
      boxShadow: "none",
    },
  });

  // A4 in mm — we'll place the captured image across one or more A4 pages.
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();   // 210
  const pageH = pdf.internal.pageSize.getHeight();  // 297

  // Compute the image's aspect ratio from the rendered pixel dimensions
  const imgW = element.offsetWidth;
  const imgH = element.offsetHeight;
  const ratio = imgH / imgW;

  // Fit the image to the A4 page width, with small margins
  const margin = 0; // the .print-area already has its own internal padding
  const renderW = pageW - margin * 2;
  const renderH = renderW * ratio;

  if (renderH <= pageH) {
    // Single page
    pdf.addImage(dataUrl, "PNG", margin, 0, renderW, renderH);
  } else {
    // Multi-page: slice the tall image across A4 pages
    // We add the full image at negative Y offsets, clipping each page via addPage.
    const pageContentH = pageH; // mm of content per page
    let yOffset = 0;
    let first = true;
    while (yOffset < renderH) {
      if (!first) pdf.addPage();
      // Place the image so that the current slice lands at the top of this page.
      // jsPDF clips to the page boundary automatically.
      pdf.addImage(dataUrl, "PNG", margin, -yOffset, renderW, renderH);
      yOffset += pageContentH;
      first = false;
    }
  }

  const filename = `${inv.number}-${(inv.clientSnapshot.name || "invoice").replace(/\s+/g, "_")}.pdf`;
  pdf.save(filename);
  return { filename };
}

// ---------------------------------------------------------------------------
// GSTR report PDF — kept as a separate jsPDF/autoTable build because this is a
// tabular data report (not a branded invoice) and has no corresponding print DOM.
// This is NOT used for invoice downloads — only for GST report exports.
// ---------------------------------------------------------------------------
export async function generateGstrReportPdf(
  title: string,
  headers: string[],
  rows: (string | number)[][],
  settings: AppSettings
): Promise<void> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 36;
  doc.setFillColor(INK);
  doc.rect(0, 0, pageW, 70, "F");
  doc.setFillColor(GOLD);
  doc.rect(0, 70, pageW, 3, "F");
  doc.setTextColor("#ffffff");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(settings.business.name?.toUpperCase() || "KUMAR ENTERPRISES", margin, 30);
  doc.setTextColor(GOLD);
  doc.setFontSize(11);
  doc.text(title, margin, 52);

  autoTable(doc, {
    head: [headers],
    body: rows.map((r) => r.map((c) => String(c))),
    startY: 90,
    margin: { left: margin, right: margin },
    styles: { font: "helvetica", fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: INK, textColor: GOLD },
    alternateRowStyles: { fillColor: LIGHT },
  });
  doc.save(`${title.replace(/\s+/g, "_")}.pdf`);
}
