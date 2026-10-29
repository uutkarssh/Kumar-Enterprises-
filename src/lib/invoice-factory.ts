// Invoice factory + draft creation
import type { AppSettings, Client, Invoice, InvoiceType, LineItem, Payment, Product } from "./types";
import { computeInvoiceTotals, nextInvoiceNumber, todayIso, uid } from "./gst";

export function emptyLine(): LineItem {
  return {
    id: uid("ln_"),
    description: "",
    hsn: "",
    unit: "BAG",
    quantity: 1,
    rate: 0,
    discountPct: 0,
    gstRate: 0,
    taxableAmount: 0,
    cgst: 0,
    sgst: 0,
    igst: 0,
    total: 0,
  };
}

export function lineFromProduct(p: Product): LineItem {
  return {
    ...emptyLine(),
    productId: p.id,
    description: p.name,
    hsn: p.hsn,
    unit: p.unit,
    rate: p.salePrice,
    gstRate: p.isGstExempt ? 0 : p.gstRate,
  };
}

export function snapshotFromClient(c: Client): Invoice["clientSnapshot"] {
  return {
    name: c.businessName || c.name,
    gstin: c.gstin,
    phone: c.phone,
    email: c.email,
    address: [c.address, c.city].filter(Boolean).join(", "),
    state: c.state,
    stateCode: c.stateCode,
  };
}

export function createDraftInvoice(
  settings: AppSettings,
  clients: Client[],
  existingNumbers: string[],
  type: InvoiceType = "tax_invoice"
): Invoice {
  const client = clients[0];
  const businessStateCode = settings.business.stateCode || "";
  // Place of Supply defaults to the SELLER's state (per GST rules for goods).
  // The user can override per-invoice in the builder for inter-state sales.
  const placeOfSupply = businessStateCode;
  const clientStateCode = client?.stateCode || businessStateCode;
  const isInter = businessStateCode && clientStateCode && businessStateCode !== clientStateCode;
  const taxType = isInter ? "inter" : settings.invoice.defaultTaxType;
  const taxApplicable = type === "tax_invoice" || type === "proforma" || type === "credit_note";
  const number = nextInvoiceNumber(settings.invoice.prefix, existingNumbers, settings.invoice.numberPadding, settings.invoice.resetYearly);

  const line = emptyLine();
  const items = taxApplicable ? [line] : [{ ...line, gstRate: 0 }];
  const totals = computeInvoiceTotals(items, 0, settings.invoice.enableRoundOff, taxApplicable, taxType);

  return {
    id: uid("inv_"),
    number,
    type,
    status: "draft",
    clientId: client?.id || "",
    clientSnapshot: client
      ? snapshotFromClient(client)
      : { name: "Select client" },
    issueDate: todayIso(),
    dueDate: undefined,
    reference: "",
    placeOfSupply,
    reverseCharge: false,
    items,
    globalDiscountPct: 0,
    roundOff: 0,
    currency: settings.invoice.defaultCurrency,
    notes: settings.invoice.defaultNotes,
    terms: settings.invoice.defaultTerms,
    ...totals,
    paidAmount: 0,
    balance: totals.grandTotal,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deletedAt: null,
  };
}

// convenience used by the command palette without full context
export function editDraftInvoice(): Invoice {
  // returns a minimal placeholder — the builder view will overwrite with proper draft
  return {
    id: uid("inv_"),
    number: "DRAFT",
    type: "tax_invoice",
    status: "draft",
    clientId: "",
    clientSnapshot: { name: "" },
    issueDate: todayIso(),
    items: [emptyLine()],
    globalDiscountPct: 0,
    roundOff: 0,
    subtotal: 0,
    totalDiscount: 0,
    taxableAmount: 0,
    cgst: 0,
    sgst: 0,
    igst: 0,
    totalTax: 0,
    grandTotal: 0,
    paidAmount: 0,
    balance: 0,
    currency: "INR",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deletedAt: null,
  };
}

export function createPayment(invoice: Invoice, amount: number, mode: Payment["mode"], reference?: string): Payment {
  return {
    id: uid("pay_"),
    invoiceId: invoice.id,
    clientId: invoice.clientId,
    amount,
    mode,
    reference,
    date: todayIso(),
    createdAt: new Date().toISOString(),
    deletedAt: null,
  };
}
