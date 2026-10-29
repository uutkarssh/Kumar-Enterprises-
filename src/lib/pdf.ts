// Invoice PDF generator — black & gold Kumar Enterprises theme
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import QRCode from "qrcode";
import type { AppSettings, Invoice } from "./types";
import { INVOICE_TYPES, INDIAN_STATES } from "./types";
import { currency, fmtDate } from "./gst";

const INK = "#0a0a0a";
const GOLD = "#f0a800";
const GOLD_DEEP = "#966b04";
const MUTED = "#71717a";
const LIGHT = "#f4f4f5";

export async function generateInvoicePdf(
  inv: Invoice,
  settings: AppSettings,
  opts: { download?: boolean; returnDataUrl?: boolean; filename?: string } = {}
): Promise<{ dataUrl?: string; filename: string }> {
  const business = settings.business;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 36;
  const contentW = pageW - margin * 2;
  const typeMeta = INVOICE_TYPES.find((t) => t.value === inv.type);

  // ---- Header band (gold bar + black title block) ----
  doc.setFillColor(INK);
  doc.rect(0, 0, pageW, 84, "F");
  doc.setFillColor(GOLD);
  doc.rect(0, 84, pageW, 4, "F");

  // business name (wordmark)
  doc.setTextColor("#ffffff");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(business.name?.toUpperCase() || "KUMAR ENTERPRISES", margin, 36);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(GOLD);
  const tagline = "BUILDING MATERIAL · CEMENT · STEEL · AGGREGATE";
  doc.text(tagline, margin, 52);

  // business contact block (right)
  doc.setTextColor("#e5e5e5");
  doc.setFontSize(8);
  const contactLines: string[] = [];
  if (business.address) contactLines.push(business.address);
  const cityLine = [business.city, business.state].filter(Boolean).join(", ");
  if (cityLine) contactLines.push(cityLine);
  if (business.phone) contactLines.push(`Ph: ${business.phone}`);
  if (business.email) contactLines.push(business.email);
  if (business.gstin) contactLines.push(`GSTIN: ${business.gstin}`);
  contactLines.forEach((l, i) => {
    doc.text(l, pageW - margin, 22 + i * 11, { align: "right" });
  });

  // ---- Document type stamp ----
  doc.setTextColor(INK);
  doc.setFillColor(GOLD);
  doc.rect(margin, 100, 220, 26, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text((typeMeta?.label || "Invoice").toUpperCase(), margin + 10, 118);
  doc.setFontSize(8);
  doc.setTextColor(MUTED);
  doc.text(`No: ${inv.number}`, margin + 250, 110);
  doc.text(`Date: ${fmtDate(inv.issueDate)}`, margin + 250, 122);

  // ---- Bill To ----
  let y = 142;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(GOLD_DEEP);
  doc.text("BILL TO", margin, y);
  doc.setTextColor(INK);
  doc.setFontSize(11);
  doc.text(inv.clientSnapshot.name || "—", margin, y + 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor("#3f3f46");
  const billLines: string[] = [];
  if (inv.clientSnapshot.businessName && inv.clientSnapshot.businessName !== inv.clientSnapshot.name)
    billLines.push(inv.clientSnapshot.businessName);
  if (inv.clientSnapshot.address) billLines.push(inv.clientSnapshot.address);
  const cl = [inv.clientSnapshot.city, inv.clientSnapshot.state].filter(Boolean).join(", ");
  if (cl) billLines.push(cl);
  if (inv.clientSnapshot.phone) billLines.push(`Ph: ${inv.clientSnapshot.phone}`);
  if (inv.clientSnapshot.gstin) billLines.push(`GSTIN: ${inv.clientSnapshot.gstin}`);
  billLines.forEach((l, i) => {
    doc.text(l, margin, y + 28 + i * 11);
  });

  // ---- Supply details (right) ----
  const rightX = pageW - margin - 200;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(GOLD_DEEP);
  doc.text("SUPPLY DETAILS", rightX, y);
  doc.setFont("helvetica", "normal");
  doc.setTextColor("#3f3f46");
  doc.setFontSize(8.5);
  const supplyState = INDIAN_STATES.find((s) => s.code === inv.placeOfSupply);
  const supplyRows: [string, string][] = [
    ["Place of Supply", supplyState ? `${supplyState.name} (${supplyState.code})` : inv.placeOfSupply || "—"],
    ["Currency", inv.currency],
    ["Reverse Charge", inv.reverseCharge ? "Yes" : "No"],
  ];
  if (inv.reference) supplyRows.push(["Reference", inv.reference]);
  if (inv.dueDate) supplyRows.push(["Due Date", fmtDate(inv.dueDate)]);
  supplyRows.forEach((r, i) => {
    doc.setTextColor(MUTED);
    doc.text(r[0], rightX, y + 14 + i * 11);
    doc.setTextColor(INK);
    doc.text(r[1], rightX + 90, y + 14 + i * 11);
  });

  // ---- Items table ----
  y = y + 28 + Math.max(billLines.length, supplyRows.length) * 11 + 16;
  const taxApplicable = inv.type === "tax_invoice" || inv.type === "proforma" || inv.type === "credit_note";
  const isInter = inv.cgst === 0 && inv.igst > 0;

  const head = taxApplicable
    ? isInter
      ? [["#", "Item / Description", "HSN", "Qty", "Rate", "Taxable", "IGST", "Total"]]
      : [["#", "Item / Description", "HSN", "Qty", "Rate", "Taxable", "CGST", "SGST", "Total"]]
    : [["#", "Item / Description", "HSN", "Qty", "Rate", "Amount"]];

  const body = inv.items.map((it, i) => {
    const desc = it.description + (it.gstRate > 0 && taxApplicable ? ` (${it.gstRate}%)` : "");
    const base = [
      String(i + 1),
      desc,
      it.hsn || "—",
      `${it.quantity} ${it.unit}`,
      currency(it.rate, inv.currency, false),
      currency(it.taxableAmount, inv.currency, false),
    ];
    if (taxApplicable) {
      if (isInter) {
        return [...base, currency(it.igst, inv.currency, false), currency(it.total, inv.currency, false)];
      }
      return [...base, currency(it.cgst, inv.currency, false), currency(it.sgst, inv.currency, false), currency(it.total, inv.currency, false)];
    }
    return [...base, currency(it.total, inv.currency, false)];
  });

  autoTable(doc, {
    head: [head[0]],
    body,
    startY: y,
    margin: { left: margin, right: margin },
    styles: { font: "helvetica", fontSize: 8, cellPadding: 5, textColor: INK, lineColor: "#e4e4e7", lineWidth: 0.5 },
    headStyles: { fillColor: INK, textColor: GOLD, fontStyle: "bold", fontSize: 7.5 },
    alternateRowStyles: { fillColor: LIGHT },
    columnStyles: { 0: { cellWidth: 18, halign: "center" } },
    didDrawPage: () => {
      const ph = doc.internal.pageSize.getHeight();
      doc.setFillColor(INK);
      doc.rect(0, ph - 24, pageW, 24, "F");
      doc.setTextColor(GOLD);
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.text(`${business.name} · ${inv.number}`, margin, ph - 9);
      doc.text("Generated by Kumar Enterprises Billing", pageW - margin, ph - 9, { align: "right" });
    },
  });

  // ---- Totals ----
  // @ts-ignore
  let endY = doc.lastAutoTable.finalY + 16;
  const totalsX = pageW - margin - 220;
  const totalsW = 220;
  const row = (label: string, val: string, bold = false, fill = false, color = INK) => {
    if (fill) {
      doc.setFillColor(GOLD);
      doc.rect(totalsX, endY, totalsW, 18, "F");
      doc.setTextColor(INK);
    } else {
      doc.setTextColor(color);
    }
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(bold ? 9.5 : 8.5);
    doc.text(label, totalsX + 8, endY + 12);
    doc.text(val, totalsX + totalsW - 8, endY + 12, { align: "right" });
    endY += 18;
  };

  row("Subtotal", currency(inv.subtotal, inv.currency));
  if (inv.totalDiscount > 0) row("Discount", `- ${currency(inv.totalDiscount, inv.currency)}`);
  row("Taxable Amount", currency(inv.taxableAmount, inv.currency));
  if (taxApplicable) {
    if (isInter) {
      if (inv.igst > 0) row("IGST", currency(inv.igst, inv.currency));
    } else {
      if (inv.cgst > 0) row("CGST", currency(inv.cgst, inv.currency));
      if (inv.sgst > 0) row("SGST/UTGST", currency(inv.sgst, inv.currency));
    }
  }
  if (inv.roundOff !== 0) row("Round Off", currency(inv.roundOff, inv.currency));
  row("GRAND TOTAL", currency(inv.grandTotal, inv.currency), true, true);
  if (inv.paidAmount > 0) {
    row("Paid", `- ${currency(inv.paidAmount, inv.currency)}`, false, false, "#16a34a");
    row("Balance Due", currency(inv.balance, inv.currency), true, false, inv.balance > 0 ? "#b91c1c" : "#16a34a");
  }

  // ---- Amount in words ----
  endY += 8;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8.5);
  doc.setTextColor(MUTED);
  doc.text(`Amount in words: ${amountInWords(inv.grandTotal)} only`, margin, endY);

  // ---- UPI QR (right side, below totals) ----
  if (settings.invoice.enableUpiQr && business.upiId && inv.balance > 0) {
    try {
      const upiUrl = `upi://pay?pa=${encodeURIComponent(business.upiId)}&pn=${encodeURIComponent(
        business.name || ""
      )}&am=${inv.balance.toFixed(2)}&cu=INR&tn=${encodeURIComponent(inv.number)}`;
      const qrData = await QRCode.toDataURL(upiUrl, { margin: 1, width: 240, color: { dark: INK, light: "#ffffff" } });
      const qrSize = 90;
      const qrX = margin;
      const qrY = endY + 8;
      doc.setFillColor("#ffffff");
      doc.rect(qrX - 4, qrY - 4, qrSize + 8, qrSize + 8, "F");
      doc.addImage(qrData, "PNG", qrX, qrY, qrSize, qrSize);
      doc.setFontSize(7);
      doc.setTextColor(MUTED);
      doc.text("Scan to pay", qrX, qrY + qrSize + 10);
      doc.text(business.upiId, qrX, qrY + qrSize + 20);
    } catch {
      // skip QR on failure
    }
  }

  // ---- Bank details + terms ----
  let footY = endY + 110;
  if (footY > 740) {
    doc.addPage();
    footY = 60;
  }
  doc.setDrawColor("#e4e4e7");
  doc.line(margin, footY, pageW - margin, footY);
  footY += 14;
  // Bank
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(GOLD_DEEP);
  doc.text("BANK DETAILS", margin, footY);
  doc.setFont("helvetica", "normal");
  doc.setTextColor("#3f3f46");
  doc.setFontSize(8);
  const bankLines: string[] = [];
  if (business.bankName) bankLines.push(`Bank: ${business.bankName}`);
  if (business.accountNo) bankLines.push(`A/c No: ${business.accountNo}`);
  if (business.ifsc) bankLines.push(`IFSC: ${business.ifsc}`);
  if (business.branch) bankLines.push(`Branch: ${business.branch}`);
  bankLines.forEach((l, i) => doc.text(l, margin, footY + 12 + i * 10));

  // Terms
  const termsX = pageW / 2;
  doc.setFont("helvetica", "bold");
  doc.setTextColor(GOLD_DEEP);
  doc.text("TERMS & CONDITIONS", termsX, footY);
  doc.setFont("helvetica", "normal");
  doc.setTextColor("#3f3f46");
  const terms = (inv.terms || settings.invoice.defaultTerms || "").split("\n").filter(Boolean);
  terms.slice(0, 5).forEach((t, i) => {
    doc.text(t, termsX, footY + 12 + i * 10, { maxWidth: pageW - margin - termsX });
  });

  // Signature
  doc.setFont("helvetica", "bold");
  doc.setTextColor(INK);
  doc.text(`For ${business.name || "Kumar Enterprises"}`, pageW - margin - 140, footY + 40, { align: "left" });
  doc.setDrawColor(INK);
  doc.line(pageW - margin - 140, footY + 64, pageW - margin, footY + 64);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(MUTED);
  doc.text("Authorised Signatory", pageW - margin - 70, footY + 74, { align: "center" });

  const filename = opts.filename || `${inv.number}-${inv.clientSnapshot.name?.replace(/\s+/g, "_") || "invoice"}.pdf`;
  if (opts.returnDataUrl) {
    const dataUrl = doc.output("datauristring");
    return { dataUrl, filename };
  }
  if (opts.download !== false) {
    doc.save(filename);
  }
  return { filename };
}

function amountInWords(num: number): string {
  const a = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
    "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const inWords = (n: number): string => {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 ? " " + a[n % 10] : "");
    if (n < 1000) return a[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " + inWords(n % 100) : "");
    if (n < 100000) return inWords(Math.floor(n / 1000)) + " Thousand" + (n % 1000 ? " " + inWords(n % 1000) : "");
    if (n < 10000000) return inWords(Math.floor(n / 100000)) + " Lakh" + (n % 100000 ? " " + inWords(n % 100000) : "");
    return inWords(Math.floor(n / 10000000)) + " Crore" + (n % 10000000 ? " " + inWords(n % 10000000) : "");
  };
  const rupees = Math.floor(num);
  const paise = Math.round((num - rupees) * 100);
  let words = "Rupees " + inWords(rupees);
  if (paise > 0) words += ` and ${inWords(paise)} Paise`;
  return words;
}

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
