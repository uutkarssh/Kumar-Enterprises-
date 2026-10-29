"use client";
import { useMemo, useState } from "react";
import { useApp } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowLeft, Printer, Download, Share2, MessageCircle, Mail, Pencil, IndianRupee, Check,
} from "lucide-react";
import { INVOICE_TYPES, INDIAN_STATES } from "@/lib/types";
import { inr, fmtDate } from "@/lib/gst";
import { isGstApplicable } from "@/lib/gst";
import { generateInvoicePdf } from "@/lib/pdf";
import { putInvoice, listPaymentsForInvoice, putPayment } from "@/lib/db";
import { createPayment } from "@/lib/invoice-factory";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { todayIso } from "@/lib/gst";
import { cn } from "@/lib/utils";

export function InvoicePreviewView() {
  const id = useApp((s) => s.selectedInvoiceId);
  const invoices = useApp((s) => s.invoices);
  const settings = useApp((s) => s.settings);
  const setView = useApp((s) => s.setView);
  const editInvoice = useApp((s) => s.editInvoice);
  const reload = useApp((s) => s.reload);
  const [payOpen, setPayOpen] = useState(false);

  const inv = invoices.find((i) => i.id === id);

  if (!inv || !settings) {
    return (
      <div className="text-center py-20">
        <p className="text-sm text-muted-foreground">Invoice not found.</p>
        <Button onClick={() => setView("invoices")} className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to invoices
        </Button>
      </div>
    );
  }

  const meta = INVOICE_TYPES.find((t) => t.value === inv.type);
  const taxApplicable = isGstApplicable(inv.type);
  const isInter = inv.igst > 0 && inv.cgst === 0;
  const business = settings.business;
  const supplyState = INDIAN_STATES.find((s) => s.code === inv.placeOfSupply);

  const print = () => window.print();

  const downloadPdf = async () => {
    const t = toast.loading("Generating PDF...");
    try {
      await generateInvoicePdf(inv, settings, { download: true });
      toast.success("PDF downloaded", { id: t });
    } catch (e: any) {
      toast.error("PDF failed", { id: t, description: e?.message });
    }
  };

  const shareWhatsapp = () => {
    const msg = `*${business.name || "Kumar Enterprises"}*\n${meta?.label} ${inv.number}\nDate: ${fmtDate(inv.issueDate)}\nClient: ${inv.clientSnapshot.name}\nAmount: ${inr(inv.grandTotal)}\nBalance: ${inr(inv.balance)}\n\nThank you for your business.`;
    const phone = inv.clientSnapshot.phone?.replace(/\D/g, "");
    const url = `https://wa.me/${phone ? "91" + phone : ""}?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  };

  const shareEmail = () => {
    const subject = `${meta?.label} ${inv.number} — ${business.name || "Kumar Enterprises"}`;
    const body = `Dear ${inv.clientSnapshot.name},\n\nPlease find your ${meta?.label.toLowerCase()} ${inv.number} dated ${fmtDate(inv.issueDate)}.\n\nAmount: ${inr(inv.grandTotal)}\nBalance due: ${inr(inv.balance)}\n\nThank you for your business.\n\n${business.name || "Kumar Enterprises"}\n${business.phone || ""}`;
    const url = `mailto:${inv.clientSnapshot.email || ""}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(url, "_blank");
  };

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${meta?.label} ${inv.number}`,
          text: `Invoice ${inv.number} from ${business.name}`,
        });
      } catch {
        // cancelled
      }
    } else {
      shareWhatsapp();
    }
  };

  const markPaid = async () => {
    if (inv.balance <= 0) return;
    const payment = createPayment(inv, inv.balance, "cash");
    await putPayment(payment);
    await putInvoice({ ...inv, paidAmount: inv.grandTotal, balance: 0, status: "paid", updatedAt: new Date().toISOString() });
    await reload();
    toast.success("Marked as paid", { description: `Payment of ${inr(inv.balance)} recorded` });
  };

  return (
    <div className="space-y-4">
      {/* Toolbar (no-print) */}
      <div className="no-print flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setView("invoices")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-display flex items-center gap-2">
              {meta?.label}
              <Badge variant="outline" className="font-mono">{inv.number}</Badge>
              <StatusPill status={inv.status} />
            </h1>
            <p className="text-xs text-muted-foreground">{inv.clientSnapshot.name} · {fmtDate(inv.issueDate)}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => editInvoice(inv)}>
            <Pencil className="h-4 w-4 mr-1" /> Edit
          </Button>
          {inv.balance > 0 && inv.status !== "draft" && (
            <>
              <Button variant="outline" size="sm" onClick={() => setPayOpen(true)}>
                <IndianRupee className="h-4 w-4 mr-1" /> Record Payment
              </Button>
              <Button variant="outline" size="sm" onClick={markPaid}>
                <Check className="h-4 w-4 mr-1" /> Mark Paid
              </Button>
            </>
          )}
          <Button variant="outline" size="sm" onClick={shareWhatsapp}>
            <MessageCircle className="h-4 w-4 mr-1" /> WhatsApp
          </Button>
          <Button variant="outline" size="sm" onClick={shareEmail}>
            <Mail className="h-4 w-4 mr-1" /> Email
          </Button>
          <Button variant="outline" size="sm" onClick={share}>
            <Share2 className="h-4 w-4 mr-1" /> Share
          </Button>
          <Button variant="outline" size="sm" onClick={downloadPdf}>
            <Download className="h-4 w-4 mr-1" /> PDF
          </Button>
          <Button size="sm" onClick={print} className="bg-gold text-ink hover:bg-gold/90">
            <Printer className="h-4 w-4 mr-1" /> Print
          </Button>
        </div>
      </div>

      {/* Printable invoice */}
      <div className="print-area bg-white text-black rounded-lg border shadow-sm">
        {/* Header */}
        <div className="bg-ink text-white px-6 py-5 rounded-t-lg flex items-start justify-between">
          <div className="flex items-center gap-3">
            <img src="/icons/logo-square.png" alt="" className="h-14 w-14 rounded bg-white p-1" />
            <div>
              <h2 className="text-xl font-display text-white">{business.name?.toUpperCase() || "KUMAR ENTERPRISES"}</h2>
              <p className="text-xs text-gold tracking-wide">BUILDING MATERIAL · CEMENT · STEEL · AGGREGATE</p>
              <div className="text-xs text-white/70 mt-1">
                {business.address && <div>{business.address}</div>}
                <div>{[business.city, business.state].filter(Boolean).join(", ")}</div>
                <div>
                  {business.phone && <span>Ph: {business.phone} </span>}
                  {business.email && <span>· {business.email}</span>}
                </div>
                {business.gstin && <div>GSTIN: <span className="font-mono">{business.gstin}</span></div>}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="inline-block bg-gold text-ink px-4 py-1.5 rounded font-display text-lg">
              {meta?.label.toUpperCase()}
            </div>
            <div className="mt-2 text-sm text-white">
              <div>No: <span className="font-mono font-semibold">{inv.number}</span></div>
              <div>Date: {fmtDate(inv.issueDate)}</div>
              {inv.dueDate && <div>Due: {fmtDate(inv.dueDate)}</div>}
            </div>
          </div>
        </div>

        {/* Bill to + supply */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 px-6 py-4 border-b">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-[#966b04] font-semibold mb-1">Bill To</div>
            <div className="font-semibold text-sm">{inv.clientSnapshot.name}</div>
            {inv.clientSnapshot.businessName && inv.clientSnapshot.businessName !== inv.clientSnapshot.name && (
              <div className="text-xs">{inv.clientSnapshot.businessName}</div>
            )}
            {inv.clientSnapshot.address && <div className="text-xs text-gray-600">{inv.clientSnapshot.address}</div>}
            {inv.clientSnapshot.phone && <div className="text-xs text-gray-600">Ph: {inv.clientSnapshot.phone}</div>}
            {inv.clientSnapshot.gstin && <div className="text-xs text-gray-600">GSTIN: <span className="font-mono">{inv.clientSnapshot.gstin}</span></div>}
          </div>
          <div className="sm:text-right text-xs space-y-0.5">
            <div><span className="text-gray-500">Place of Supply: </span>{supplyState ? `${supplyState.name} (${supplyState.code})` : inv.placeOfSupply}</div>
            <div><span className="text-gray-500">Currency: </span>{inv.currency}</div>
            {taxApplicable && <div><span className="text-gray-500">Reverse Charge: </span>{inv.reverseCharge ? "Yes" : "No"}</div>}
            {inv.reference && <div><span className="text-gray-500">Reference: </span>{inv.reference}</div>}
          </div>
        </div>

        {/* Items */}
        <div className="px-6 py-4 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-ink text-gold">
                <th className="text-left py-2 px-2 font-semibold">#</th>
                <th className="text-left py-2 px-2 font-semibold">Item / Description</th>
                <th className="text-left py-2 px-2 font-semibold">HSN</th>
                <th className="text-right py-2 px-2 font-semibold">Qty</th>
                <th className="text-right py-2 px-2 font-semibold">Rate</th>
                <th className="text-right py-2 px-2 font-semibold">Taxable</th>
                {taxApplicable && isInter && <th className="text-right py-2 px-2 font-semibold">IGST</th>}
                {taxApplicable && !isInter && (
                  <>
                    <th className="text-right py-2 px-2 font-semibold">CGST</th>
                    <th className="text-right py-2 px-2 font-semibold">SGST</th>
                  </>
                )}
                <th className="text-right py-2 px-2 font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {inv.items.map((it, i) => (
                <tr key={it.id} className={i % 2 === 1 ? "bg-gray-50" : ""}>
                  <td className="py-2 px-2">{i + 1}</td>
                  <td className="py-2 px-2">
                    {it.description}
                    {taxApplicable && it.gstRate > 0 && <span className="text-gray-500"> ({it.gstRate}%)</span>}
                  </td>
                  <td className="py-2 px-2 font-mono">{it.hsn || "—"}</td>
                  <td className="py-2 px-2 text-right">{it.quantity} {it.unit}</td>
                  <td className="py-2 px-2 text-right">{inr(it.rate, inv.currency, false)}</td>
                  <td className="py-2 px-2 text-right">{inr(it.taxableAmount, inv.currency, false)}</td>
                  {taxApplicable && isInter && <td className="py-2 px-2 text-right">{inr(it.igst, inv.currency, false)}</td>}
                  {taxApplicable && !isInter && (
                    <>
                      <td className="py-2 px-2 text-right">{inr(it.cgst, inv.currency, false)}</td>
                      <td className="py-2 px-2 text-right">{inr(it.sgst, inv.currency, false)}</td>
                    </>
                  )}
                  <td className="py-2 px-2 text-right font-medium">{inr(it.total, inv.currency, false)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals + notes */}
        <div className="px-6 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2 text-xs">
            {inv.notes && (
              <div>
                <div className="text-[10px] uppercase tracking-wide text-[#966b04] font-semibold">Notes</div>
                <div className="text-gray-600 whitespace-pre-wrap">{inv.notes}</div>
              </div>
            )}
            {inv.terms && (
              <div>
                <div className="text-[10px] uppercase tracking-wide text-[#966b04] font-semibold">Terms & Conditions</div>
                <div className="text-gray-600 whitespace-pre-wrap">{inv.terms}</div>
              </div>
            )}
            {business.bankName && (
              <div>
                <div className="text-[10px] uppercase tracking-wide text-[#966b04] font-semibold">Bank Details</div>
                <div className="text-gray-600">
                  {business.bankName} · A/c: {business.accountNo} · IFSC: {business.ifsc}
                </div>
              </div>
            )}
          </div>

          <div className="sm:ml-auto w-full sm:w-72 text-sm space-y-1">
            <Row label="Subtotal" value={inr(inv.subtotal, inv.currency, false)} />
            {inv.totalDiscount > 0 && <Row label="Discount" value={`- ${inr(inv.totalDiscount, inv.currency, false)}`} />}
            <Row label="Taxable Amount" value={inr(inv.taxableAmount, inv.currency, false)} />
            {taxApplicable && isInter && inv.igst > 0 && <Row label="IGST" value={inr(inv.igst, inv.currency, false)} />}
            {taxApplicable && !isInter && (
              <>
                {inv.cgst > 0 && <Row label="CGST" value={inr(inv.cgst, inv.currency, false)} />}
                {inv.sgst > 0 && <Row label="SGST/UTGST" value={inr(inv.sgst, inv.currency, false)} />}
              </>
            )}
            {inv.roundOff !== 0 && <Row label="Round Off" value={inr(inv.roundOff, inv.currency, false)} />}
            <div className="flex items-center justify-between bg-gold text-ink px-3 py-2 rounded font-display text-base">
              <span>GRAND TOTAL</span>
              <span>{inr(inv.grandTotal, inv.currency)}</span>
            </div>
            {inv.paidAmount > 0 && (
              <>
                <Row label="Paid" value={`- ${inr(inv.paidAmount, inv.currency, false)}`} color="text-emerald-700" />
                <div className="flex items-center justify-between font-semibold border-t pt-1">
                  <span>Balance Due</span>
                  <span className={inv.balance > 0 ? "text-red-700" : "text-emerald-700"}>{inr(inv.balance, inv.currency)}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Signature + footer */}
        <div className="px-6 pb-6 flex items-end justify-between">
          <div className="text-[10px] text-gray-500 italic">
            Amount in words: {amountInWords(inv.grandTotal)} only.
            {business.upiId && settings.invoice.enableUpiQr && inv.balance > 0 && (
              <span className="block mt-1">Pay via UPI: {business.upiId}</span>
            )}
          </div>
          <div className="text-center text-xs">
            <div className="border-t border-black w-40 mt-8 pt-1">Authorised Signatory</div>
            <div className="text-[10px] text-gray-500">For {business.name || "Kumar Enterprises"}</div>
          </div>
        </div>
      </div>

      <PaymentDialog open={payOpen} onOpenChange={setPayOpen} invoice={inv} onDone={reload} />
    </div>
  );
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-600">{label}</span>
      <span className={cn("font-medium", color)}>{value}</span>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: "bg-muted text-muted-foreground",
    issued: "bg-blue-100 text-blue-700",
    paid: "bg-emerald-100 text-emerald-700",
    partial: "bg-amber-100 text-amber-700",
    cancelled: "bg-red-100 text-red-700",
  };
  return <span className={cn("inline-block text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wide", map[status])}>{status}</span>;
}

function PaymentDialog({
  open,
  onOpenChange,
  invoice,
  onDone,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  invoice: any;
  onDone: () => Promise<void>;
}) {
  const [amount, setAmount] = useState(invoice?.balance || 0);
  const [mode, setMode] = useState<"cash" | "upi" | "cheque" | "bank" | "card" | "other">("cash");
  const [reference, setReference] = useState("");
  const [date, setDate] = useState(todayIso());

  const save = async () => {
    if (amount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    const payment = createPayment(invoice, amount, mode, reference);
    payment.date = date;
    await putPayment(payment);
    const newPaid = Math.min(invoice.grandTotal, invoice.paidAmount + amount);
    const newBalance = round2(invoice.grandTotal - newPaid);
    await putInvoice({
      ...invoice,
      paidAmount: newPaid,
      balance: newBalance,
      status: newBalance <= 0 ? "paid" : "partial",
      updatedAt: new Date().toISOString(),
    });
    await onDone();
    onOpenChange(false);
    toast.success("Payment recorded", { description: `${inr(amount)} via ${mode}` });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record Payment — {invoice?.number}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-md bg-muted p-3 text-sm flex justify-between">
            <span className="text-muted-foreground">Balance due</span>
            <span className="font-semibold">{inr(invoice?.balance || 0)}</span>
          </div>
          <div>
            <Label>Amount received</Label>
            <Input type="number" value={amount} onChange={(e) => setAmount(parseFloat(e.target.value) || 0)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Mode</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="bank">Bank Transfer</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Reference (UTR/Cheque no)</Label>
            <Input value={reference} onChange={(e) => setReference(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button className="bg-gold text-ink hover:bg-gold/90" onClick={save}>Save Payment</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
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
