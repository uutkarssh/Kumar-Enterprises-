"use client";
import * as React from "react";
import { useApp } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  Plus,
  Download,
  Wallet,
  TrendingUp,
  Clock,
  AlertCircle,
  FileText,
  IndianRupee,
  MapPin,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { INVOICE_TYPES, type Invoice, type Payment } from "@/lib/types";
import { putInvoice, putPayment } from "@/lib/db";
import { downloadCsv } from "@/lib/csv";
import { inr, fmtDate, todayIso, uid } from "@/lib/gst";

type LedgerRow = {
  date: string;
  type: "opening" | "invoice" | "payment";
  reference: string;
  debit: number;
  credit: number;
  running: number;
};

export function ClientLedgerView() {
  const selectedClientId = useApp((s) => s.selectedClientId);
  const clients = useApp((s) => s.clients);
  const invoices = useApp((s) => s.invoices);
  const payments = useApp((s) => s.payments);
  const setView = useApp((s) => s.setView);
  const openInvoice = useApp((s) => s.openInvoice);
  const reload = useApp((s) => s.reload);

  const [payOpen, setPayOpen] = React.useState(false);

  const client = React.useMemo(
    () => clients.find((c) => c.id === selectedClientId) || null,
    [clients, selectedClientId]
  );

  const clientInvoices = React.useMemo(
    () =>
      invoices.filter(
        (i) =>
          i.clientId === selectedClientId && !i.deletedAt && i.status !== "cancelled"
      ),
    [invoices, selectedClientId]
  );

  const clientPayments = React.useMemo(
    () => payments.filter((p) => p.clientId === selectedClientId && !p.deletedAt),
    [payments, selectedClientId]
  );

  const ledger = React.useMemo<LedgerRow[]>(() => {
    if (!client) return [];
    const rows: LedgerRow[] = [];
    if (client.openingBalance) {
      rows.push({
        date: client.createdAt.slice(0, 10),
        type: "opening",
        reference: "Opening Balance",
        debit: client.openingBalance > 0 ? client.openingBalance : 0,
        credit: client.openingBalance < 0 ? -client.openingBalance : 0,
        running: 0,
      });
    }
    for (const inv of clientInvoices) {
      rows.push({
        date: inv.issueDate,
        type: "invoice",
        reference: inv.number,
        debit: inv.grandTotal,
        credit: 0,
        running: 0,
      });
    }
    for (const p of clientPayments) {
      rows.push({
        date: p.date,
        type: "payment",
        reference: p.reference || `Payment (${p.mode})`,
        debit: 0,
        credit: p.amount,
        running: 0,
      });
    }
    rows.sort((a, b) => a.date.localeCompare(b.date));
    let run = client.openingBalance || 0;
    for (const r of rows) {
      run = run + r.debit - r.credit;
      r.running = run;
    }
    return rows;
  }, [client, clientInvoices, clientPayments]);

  const totals = React.useMemo(() => {
    const billed = clientInvoices.reduce((s, i) => s + i.grandTotal, 0);
    const paid = clientPayments.reduce((s, p) => s + p.amount, 0);
    const outstanding = (client?.openingBalance || 0) + billed - paid;
    const today = todayIso();
    const overdue = clientInvoices
      .filter((i) => i.balance > 0 && i.dueDate && i.dueDate < today)
      .reduce((s, i) => s + i.balance, 0);
    return { billed, paid, outstanding, overdue };
  }, [client, clientInvoices, clientPayments]);

  if (!client) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-display">Client Ledger</h1>
          <p className="text-sm text-muted-foreground">No client selected.</p>
        </div>
        <Card>
          <CardContent className="py-16 text-center">
            <AlertCircle className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground mb-4">
              Select a client from the clients list to view their ledger.
            </p>
            <Button
              className="bg-gold text-ink hover:bg-gold/90"
              onClick={() => setView("clients")}
            >
              <ArrowLeft className="h-4 w-4 mr-1" /> Go to Clients
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // local alias so closures see a non-null Client
  const c = client;

  function downloadStatement() {
    const rows: (string | number)[][] = [];
    rows.push(["Kumar Enterprises Billing — Client Statement"]);
    rows.push(["Client", c.name]);
    rows.push(["Business", c.businessName || "—"]);
    rows.push(["GSTIN", c.gstin || "—"]);
    rows.push(["Phone", c.phone || "—"]);
    rows.push([
      "Address",
      [c.address, c.city, c.state].filter(Boolean).join(", ") || "—",
    ]);
    rows.push([
      "Credit Limit",
      c.creditLimit != null ? inr(c.creditLimit, false) : "—",
    ]);
    rows.push([]);
    rows.push(["Date", "Type", "Reference", "Debit", "Credit", "Running Balance"]);
    for (const r of ledger) {
      rows.push([
        r.date,
        r.type === "opening"
          ? "Opening"
          : r.type === "invoice"
          ? "Invoice"
          : "Payment",
        r.reference,
        r.debit ? inr(r.debit, false) : "",
        r.credit ? inr(r.credit, false) : "",
        inr(r.running, false),
      ]);
    }
    rows.push([]);
    rows.push(["Total Billed", inr(totals.billed, false)]);
    rows.push(["Total Paid", inr(totals.paid, false)]);
    rows.push(["Outstanding", inr(totals.outstanding, false)]);
    rows.push(["Overdue", inr(totals.overdue, false)]);
    const fname = `ledger-${c.name.replace(/\s+/g, "_")}-${todayIso()}.csv`;
    downloadCsv(rows, fname);
    toast.success("Statement downloaded");
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <Button
          variant="ghost"
          size="sm"
          className="w-fit -ml-2"
          onClick={() => setView("clients")}
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Clients
        </Button>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-display">{c.name}</h1>
            {c.businessName && (
              <p className="text-sm text-muted-foreground">{c.businessName}</p>
            )}
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
              {c.gstin && <span className="font-mono">GSTIN: {c.gstin}</span>}
              {c.phone && <span className="font-mono">Phone: {c.phone}</span>}
              {c.creditLimit != null && (
                <span>Credit Limit: {inr(c.creditLimit)}</span>
              )}
              {(c.address || c.city || c.state) && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {[c.address, c.city, c.state].filter(Boolean).join(", ")}
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={downloadStatement}>
              <Download className="h-4 w-4 mr-1" /> Statement
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPayOpen(true)}>
              <IndianRupee className="h-4 w-4 mr-1" /> Record Payment
            </Button>
            <Button
              size="sm"
              className="bg-gold text-ink hover:bg-gold/90"
              onClick={() => {
                setView("invoices");
                toast("Select this client in the invoice builder");
              }}
            >
              <Plus className="h-4 w-4 mr-1" /> New Invoice
            </Button>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <SummaryCard
          label="Total Billed"
          value={inr(totals.billed)}
          icon={TrendingUp}
          tone="gold"
        />
        <SummaryCard
          label="Total Paid"
          value={inr(totals.paid)}
          icon={Wallet}
          tone="green"
        />
        <SummaryCard
          label="Outstanding"
          value={inr(totals.outstanding)}
          icon={Clock}
          tone="red"
        />
        <SummaryCard
          label="Overdue"
          value={inr(totals.overdue)}
          icon={AlertCircle}
          tone="amber"
        />
      </div>

      {/* Ledger table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-display">Ledger</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {ledger.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground">
              <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
              No transactions yet for this client.
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block max-h-96 overflow-y-auto scrollbar-thin">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead className="text-right">Debit</TableHead>
                      <TableHead className="text-right">Credit</TableHead>
                      <TableHead className="text-right">Running</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ledger.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs">
                          {fmtDate(r.date)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px] capitalize",
                              r.type === "invoice" &&
                                "border-red-300 text-red-700 dark:border-red-800 dark:text-red-300",
                              r.type === "payment" &&
                                "border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-300",
                              r.type === "opening" &&
                                "border-amber-300 text-amber-700 dark:border-amber-800 dark:text-amber-300"
                            )}
                          >
                            {r.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {r.reference}
                        </TableCell>
                        <TableCell className="text-right font-medium text-red-600 dark:text-red-400">
                          {r.debit ? inr(r.debit) : "—"}
                        </TableCell>
                        <TableCell className="text-right font-medium text-emerald-600 dark:text-emerald-400">
                          {r.credit ? inr(r.credit) : "—"}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {inr(r.running)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden space-y-2 max-h-96 overflow-y-auto scrollbar-thin">
                {ledger.map((r, i) => (
                  <div key={i} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] capitalize",
                          r.type === "invoice" &&
                            "border-red-300 text-red-700",
                          r.type === "payment" &&
                            "border-emerald-300 text-emerald-700",
                          r.type === "opening" &&
                            "border-amber-300 text-amber-700"
                        )}
                      >
                        {r.type}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {fmtDate(r.date)}
                      </span>
                    </div>
                    <div className="font-mono text-xs mt-1">{r.reference}</div>
                    <div className="flex justify-between text-xs mt-2">
                      <span className="text-red-600">
                        {r.debit ? `Dr ${inr(r.debit, false)}` : ""}
                      </span>
                      <span className="text-emerald-600">
                        {r.credit ? `Cr ${inr(r.credit, false)}` : ""}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs mt-1 pt-1 border-t">
                      <span className="text-muted-foreground">Balance</span>
                      <span className="font-semibold">{inr(r.running)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Invoices */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-display">
            Invoices ({clientInvoices.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {clientInvoices.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
              No invoices for this client yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {[...clientInvoices]
                .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                .map((inv) => {
                  const meta = INVOICE_TYPES.find((t) => t.value === inv.type);
                  return (
                    <div
                      key={inv.id}
                      className="rounded-lg border p-3 hover:border-gold hover:shadow-sm transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="h-7 w-7 rounded bg-ink text-gold flex items-center justify-center text-[10px] font-bold">
                              {meta?.short}
                            </span>
                            <span className="font-mono text-xs truncate">
                              {inv.number}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {fmtDate(inv.issueDate)}
                          </div>
                        </div>
                        <StatusBadge status={inv.status} />
                      </div>
                      <div className="flex items-center justify-between mt-3">
                        <div>
                          <div className="text-sm font-semibold">
                            {inr(inv.grandTotal)}
                          </div>
                          {inv.balance > 0 && (
                            <div className="text-[11px] text-amber-600">
                              Bal: {inr(inv.balance)}
                            </div>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openInvoice(inv.id)}
                        >
                          Open
                        </Button>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </CardContent>
      </Card>

      <RecordPaymentDialog
        open={payOpen}
        onOpenChange={setPayOpen}
        clientId={c.id}
        invoices={clientInvoices}
        onSaved={async () => {
          await reload();
          setPayOpen(false);
        }}
      />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "gold" | "red" | "green" | "amber";
}) {
  return (
    <Card>
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <div
            className={cn(
              "h-9 w-9 rounded-md flex items-center justify-center",
              tone === "gold" && "bg-gold/15 text-gold",
              tone === "red" && "bg-red-500/15 text-red-600",
              tone === "green" && "bg-emerald-500/15 text-emerald-600",
              tone === "amber" && "bg-amber-500/15 text-amber-600"
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-3 text-xl sm:text-2xl font-display">{value}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: "bg-muted text-muted-foreground",
    issued: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    paid: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    partial: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    cancelled: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  };
  return (
    <span
      className={cn(
        "inline-block text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wide",
        map[status] || ""
      )}
    >
      {status}
    </span>
  );
}

function RecordPaymentDialog({
  open,
  onOpenChange,
  clientId,
  invoices,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  clientId: string;
  invoices: Invoice[];
  onSaved: () => void | Promise<void>;
}) {
  const unpaidInvoices = React.useMemo(
    () => invoices.filter((i) => i.balance > 0 && i.status !== "cancelled"),
    [invoices]
  );

  const [invoiceId, setInvoiceId] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [mode, setMode] = React.useState<Payment["mode"]>("upi");
  const [reference, setReference] = React.useState("");
  const [date, setDate] = React.useState(todayIso());

  React.useEffect(() => {
    if (!open) return;
    if (unpaidInvoices.length > 0) {
      const first = unpaidInvoices[0];
      setInvoiceId(first.id);
      setAmount(String(first.balance));
    } else {
      setInvoiceId("");
      setAmount("");
    }
    setReference("");
    setDate(todayIso());
  }, [open, unpaidInvoices]);

  function onSelectInvoice(id: string) {
    setInvoiceId(id);
    const inv = invoices.find((i) => i.id === id);
    if (inv) setAmount(String(inv.balance));
  }

  async function save() {
    const inv = invoices.find((i) => i.id === invoiceId);
    if (!inv) {
      toast.error("Select an invoice");
      return;
    }
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (amt > inv.balance + 0.001) {
      toast.error("Amount exceeds invoice balance");
      return;
    }
    const payment: Payment = {
      id: uid("pay_"),
      invoiceId: inv.id,
      clientId,
      amount: amt,
      mode,
      reference: reference.trim() || undefined,
      date,
      createdAt: new Date().toISOString(),
      deletedAt: null,
    };
    await putPayment(payment);
    const newPaid = Math.round((inv.paidAmount + amt) * 100) / 100;
    const newBal = Math.round((inv.grandTotal - newPaid) * 100) / 100;
    const updated: Invoice = {
      ...inv,
      paidAmount: newPaid,
      balance: newBal,
      status: newBal <= 0 ? "paid" : "partial",
      updatedAt: new Date().toISOString(),
    };
    await putInvoice(updated);
    toast.success("Payment recorded", {
      description: `${inr(amt)} against ${inv.number}`,
    });
    await onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            Record Payment
          </DialogTitle>
          <DialogDescription>
            Apply a payment to an outstanding invoice.
          </DialogDescription>
        </DialogHeader>
        {unpaidInvoices.length === 0 ? (
          <div className="text-center py-6 text-sm text-muted-foreground">
            <AlertCircle className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
            No outstanding invoices for this client.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="p-inv">Invoice</Label>
              <Select value={invoiceId || undefined} onValueChange={onSelectInvoice}>
                <SelectTrigger id="p-inv" className="w-full">
                  <SelectValue placeholder="Select invoice" />
                </SelectTrigger>
                <SelectContent>
                  {unpaidInvoices.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.number} · Bal {inr(i.balance)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-amt">Amount (₹)</Label>
              <Input
                id="p-amt"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="p-mode">Mode</Label>
                <Select
                  value={mode}
                  onValueChange={(v) => setMode(v as Payment["mode"])}
                >
                  <SelectTrigger id="p-mode" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="upi">UPI</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                    <SelectItem value="bank">Bank Transfer</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-date">Date</Label>
                <Input
                  id="p-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-ref">Reference (UTR / Cheque no.)</Label>
              <Input
                id="p-ref"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="bg-gold text-ink hover:bg-gold/90"
            onClick={save}
            disabled={unpaidInvoices.length === 0}
          >
            Record Payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
