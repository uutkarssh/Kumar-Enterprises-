// GST + invoice math helpers
import type { Invoice, InvoiceType, LineItem, TaxType } from "./types";
import { INDIAN_STATES } from "./types";

export function isTaxInvoiceType(type: InvoiceType): boolean {
  return type === "tax_invoice";
}

export function isGstApplicable(type: InvoiceType): boolean {
  // Bill of supply, non-gst cash memo, delivery challan don't carry GST
  return type === "tax_invoice" || type === "proforma" || type === "credit_note";
}

export function computeLine(
  qty: number,
  rate: number,
  discountPct: number,
  gstRate: number,
  taxType: TaxType,
  applicable: boolean
): Pick<LineItem, "taxableAmount" | "cgst" | "sgst" | "igst" | "total"> {
  const gross = qty * rate;
  const discount = (gross * discountPct) / 100;
  const taxable = Math.max(0, gross - discount);
  if (!applicable || gstRate <= 0) {
    return { taxableAmount: round2(taxable), cgst: 0, sgst: 0, igst: 0, total: round2(taxable) };
  }
  const tax = (taxable * gstRate) / 100;
  if (taxType === "inter") {
    return { taxableAmount: round2(taxable), cgst: 0, sgst: 0, igst: round2(tax), total: round2(taxable + tax) };
  }
  // intra -> CGST + SGST (or UTGST — represented as sgst here)
  const half = tax / 2;
  return { taxableAmount: round2(taxable), cgst: round2(half), sgst: round2(half), igst: 0, total: round2(taxable + tax) };
}

export function resolveTaxType(
  businessStateCode: string,
  clientStateCode: string,
  defaultType: TaxType = "intra"
): TaxType {
  if (!businessStateCode || !clientStateCode) return defaultType;
  if (businessStateCode === clientStateCode) return "intra";
  return "inter";
}

export function isUtState(stateCode: string): boolean {
  const s = INDIAN_STATES.find((x) => x.code === stateCode);
  return !!s?.isUT;
}

export function computeInvoiceTotals(
  items: LineItem[],
  globalDiscountPct: number,
  roundOffEnabled: boolean,
  taxApplicable: boolean,
  taxType: TaxType
): Pick<
  Invoice,
  "subtotal" | "totalDiscount" | "taxableAmount" | "cgst" | "sgst" | "igst" | "totalTax" | "grandTotal" | "roundOff"
> {
  let subtotal = 0;
  let lineDiscount = 0;
  let taxable = 0;
  let cgst = 0;
  let sgst = 0;
  let igst = 0;

  for (const it of items) {
    const gross = it.quantity * it.rate;
    const disc = (gross * it.discountPct) / 100;
    subtotal += gross;
    lineDiscount += disc;
    taxable += it.taxableAmount;
    if (taxApplicable && it.gstRate > 0) {
      if (taxType === "inter") {
        igst += it.igst;
      } else {
        cgst += it.cgst;
        sgst += it.sgst;
      }
    }
  }

  const globalDiscount = (taxable * globalDiscountPct) / 100;
  const taxableAfterGlobal = Math.max(0, taxable - globalDiscount);
  // recompute tax proportionally on reduced taxable
  const ratio = taxable > 0 ? taxableAfterGlobal / taxable : 1;
  cgst = round2(cgst * ratio);
  sgst = round2(sgst * ratio);
  igst = round2(igst * ratio);
  const totalTax = round2(cgst + sgst + igst);
  const totalDiscount = round2(lineDiscount + globalDiscount);
  let grandTotal = round2(taxableAfterGlobal + totalTax);
  let roundOff = 0;
  if (roundOffEnabled) {
    const rounded = Math.round(grandTotal);
    roundOff = round2(rounded - grandTotal);
    grandTotal = rounded;
  }
  return {
    subtotal: round2(subtotal),
    totalDiscount,
    taxableAmount: round2(taxableAfterGlobal),
    cgst,
    sgst,
    igst,
    totalTax,
    grandTotal,
    roundOff,
  };
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function inr(n: number, withSymbol = true): string {
  const formatted = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(n));
  const sign = n < 0 ? "-" : "";
  return withSymbol ? `${sign}\u20B9${formatted}` : `${sign}${formatted}`;
}

export function currency(n: number, code = "INR", withSymbol = true): string {
  if (code === "INR") return inr(n, withSymbol);
  const formatted = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(n));
  const sign = n < 0 ? "-" : "";
  return withSymbol ? `${sign}${code} ${formatted}` : `${sign}${formatted}`;
}

export function nextInvoiceNumber(
  prefix: string,
  existing: string[],
  padding: number,
  resetYearly: boolean
): string {
  const year = new Date().getFullYear();
  const yearPrefix = resetYearly ? `${year}-` : "";
  const fullPrefix = `${prefix}-${yearPrefix}`;
  let max = 0;
  for (const n of existing) {
    if (n.startsWith(fullPrefix)) {
      const tail = n.slice(fullPrefix.length);
      const num = parseInt(tail, 10);
      if (!isNaN(num) && num > max) max = num;
    }
  }
  const next = max + 1;
  return `${fullPrefix}${String(next).padStart(padding, "0")}`;
}

export function fmtDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function fmtDateTime(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function uid(prefix = ""): string {
  const rnd = Math.random().toString(36).slice(2, 10);
  const t = Date.now().toString(36);
  return `${prefix}${t}${rnd}`;
}

export function ageInDays(iso: string): number {
  const d = new Date(iso);
  const now = new Date();
  return Math.floor((now.getTime() - d.getTime()) / 86400000);
}

export function agingBucket(iso: string): "current" | "0-30" | "31-60" | "61-90" | "90+" {
  const days = ageInDays(iso);
  if (days <= 0) return "current";
  if (days <= 30) return "0-30";
  if (days <= 60) return "31-60";
  if (days <= 90) return "61-90";
  return "90+";
}

export function validateGstin(g: string): boolean {
  if (!g) return true;
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(g.toUpperCase());
}

export function stateFromGstin(gstin: string): string | undefined {
  if (!gstin || gstin.length < 2) return undefined;
  return gstin.slice(0, 2);
}

export function validatePan(p: string): boolean {
  if (!p) return true;
  return /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(p.toUpperCase());
}

export function validatePhone(p: string): boolean {
  if (!p) return true;
  return /^[6-9]\d{9}$/.test(p.replace(/\D/g, "").slice(-10));
}
