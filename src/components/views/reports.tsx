"use client";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useApp } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Download,
  FileText,
  AlertTriangle,
  Package,
  IndianRupee,
} from "lucide-react";
import { inr, fmtDate, ageInDays, agingBucket } from "@/lib/gst";
import { downloadCsv } from "@/lib/csv";
import { generateGstrReportPdf } from "@/lib/pdf";
import type { Invoice } from "@/lib/types";

const PIE_COLORS = ["#f0a800", "#111111", "#966b04", "#ffda78", "#71717a", "#b08d57"];
const GST_RATES = [0, 5, 12, 18, 28];

export function ReportsView() {
  const invoices = useApp((s) => s.invoices);
  const expenses = useApp((s) => s.expenses);
  const products = useApp((s) => s.products);
  const settings = useApp((s) => s.settings);

  const activeInv = useMemo(
    () => invoices.filter((i) => !i.deletedAt && i.status !== "cancelled"),
    [invoices]
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display">Reports</h1>
        <p className="text-sm text-muted-foreground">
          Financial summary, GST returns, outstanding receivables and inventory valuation.
        </p>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="gst">GST Returns</TabsTrigger>
          <TabsTrigger value="outstanding">Outstanding</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="taxes">Taxes</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab invoices={activeInv} expenses={expenses} />
        </TabsContent>
        <TabsContent value="gst">
          <GstReturnsTab invoices={activeInv} settings={settings} />
        </TabsContent>
        <TabsContent value="outstanding">
          <OutstandingTab invoices={activeInv} />
        </TabsContent>
        <TabsContent value="inventory">
          <InventoryTab products={products} />
        </TabsContent>
        <TabsContent value="taxes">
          <TaxesTab invoices={activeInv} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================
// Overview — P&L summary + 6-month bar chart
// ============================================================
function OverviewTab({
  invoices,
  expenses,
}: {
  invoices: Invoice[];
  expenses: { date: string; amount: number; deletedAt?: string | null }[];
}) {
  const now = new Date();
  const monthKey = now.toISOString().slice(0, 7);
  const yearKey = String(now.getFullYear());

  const activeExpenses = expenses.filter((e) => !e.deletedAt);

  const monthRevenue = invoices
    .filter((i) => i.issueDate.slice(0, 7) === monthKey)
    .reduce((s, i) => s + i.grandTotal, 0);
  const yearRevenue = invoices
    .filter((i) => i.issueDate.slice(0, 4) === yearKey)
    .reduce((s, i) => s + i.grandTotal, 0);

  const monthExpense = activeExpenses
    .filter((e) => e.date.slice(0, 7) === monthKey)
    .reduce((s, e) => s + e.amount, 0);
  const yearExpense = activeExpenses
    .filter((e) => e.date.slice(0, 4) === yearKey)
    .reduce((s, e) => s + e.amount, 0);

  const monthNet = monthRevenue - monthExpense;
  const yearNet = yearRevenue - yearExpense;

  const trend: { month: string; revenue: number; expense: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = d.toISOString().slice(0, 7);
    const label = d.toLocaleDateString("en-IN", { month: "short" });
    const rev = invoices
      .filter((inv) => inv.issueDate.slice(0, 7) === key)
      .reduce((s, inv) => s + inv.grandTotal, 0);
    const exp = activeExpenses
      .filter((e) => e.date.slice(0, 7) === key)
      .reduce((s, e) => s + e.amount, 0);
    trend.push({ month: label, revenue: rev, expense: exp });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-display flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-gold" /> This Month — P&amp;L
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-3 text-sm">
            <PnlRow label="Revenue" value={inr(monthRevenue)} tone="gold" />
            <PnlRow label="Expenses" value={inr(monthExpense)} tone="red" />
            <div className="border-t pt-2 flex justify-between">
              <span className="font-medium">Net Profit</span>
              <span className={`font-display ${monthNet >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                {inr(monthNet)}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-display flex items-center gap-2">
              <Wallet className="h-4 w-4 text-gold" /> This Year — P&amp;L
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-3 text-sm">
            <PnlRow label="Revenue" value={inr(yearRevenue)} tone="gold" />
            <PnlRow label="Expenses" value={inr(yearExpense)} tone="red" />
            <div className="border-t pt-2 flex justify-between">
              <span className="font-medium">Net Profit</span>
              <span className={`font-display ${yearNet >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                {inr(yearNet)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Revenue vs Expenses — last 6 months
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#71717a" />
                <YAxis
                  tick={{ fontSize: 11 }}
                  stroke="#71717a"
                  tickFormatter={(v) => `\u20B9${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(v: number) => inr(v)}
                  contentStyle={{ borderRadius: 8, border: "1px solid #e4e4e7", fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="revenue" name="Revenue" fill="#f0a800" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" name="Expenses" fill="#71717a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PnlRow({ label, value, tone }: { label: string; value: string; tone: "gold" | "red" }) {
  return (
    <div className="flex justify-between items-center">
      <span className="flex items-center gap-2">
        <span
          className={`h-2 w-2 rounded-full ${tone === "gold" ? "bg-gold" : "bg-red-500"}`}
        />
        {label}
      </span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

// ============================================================
// GST Returns — GSTR-1 (b2b by rate) + GSTR-3B summary, with month picker
// ============================================================
function GstReturnsTab({
  invoices,
  settings,
}: {
  invoices: Invoice[];
  settings: ReturnType<typeof useApp.getState>["settings"];
}) {
  const now = new Date();
  const months = useMemo(() => {
    const out: { value: string; label: string }[] = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const val = d.toISOString().slice(0, 7);
      const label = d.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
      out.push({ value: val, label });
    }
    return out;
  }, [now]);
  const [month, setMonth] = useState(months[0]?.value || "");

  // Only tax_invoice type counts for GST returns.
  const monthTaxInvoices = useMemo(
    () => invoices.filter((i) => i.type === "tax_invoice" && i.issueDate.slice(0, 7) === month),
    [invoices, month]
  );

  // B2B = customer has a GSTIN.
  const b2b = monthTaxInvoices.filter((i) => !!i.clientSnapshot.gstin);

  // Rate-wise summary
  const rateRows = useMemo(() => {
    const map = new Map<number, { count: Set<string>; taxable: number; igst: number; cgst: number; sgst: number }>();
    for (const inv of b2b) {
      for (const it of inv.items) {
        const r = it.gstRate || 0;
        if (!map.has(r)) map.set(r, { count: new Set(), taxable: 0, igst: 0, cgst: 0, sgst: 0 });
        const m = map.get(r)!;
        m.count.add(inv.id);
        m.taxable += it.taxableAmount;
        m.igst += it.igst;
        m.cgst += it.cgst;
        m.sgst += it.sgst;
      }
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([rate, m]) => ({
        rate,
        count: m.count.size,
        taxable: m.taxable,
        igst: m.igst,
        cgstSgst: m.cgst + m.sgst,
      }));
  }, [b2b]);

  // GSTR-3B summary
  const outputTax = monthTaxInvoices.reduce((s, i) => s + i.totalTax, 0);
  const inputTax = 0;
  const netPayable = outputTax - inputTax;

  const totalTaxable = rateRows.reduce((s, r) => s + r.taxable, 0);
  const totalIgst = rateRows.reduce((s, r) => s + r.igst, 0);
  const totalCgstSgst = rateRows.reduce((s, r) => s + r.cgstSgst, 0);

  async function downloadPdf() {
    if (!settings) return;
    const headers = ["Rate %", "Invoices", "Taxable Value", "IGST", "CGST + SGST"];
    const rows: (string | number)[][] = rateRows.map((r) => [
      `${r.rate}%`,
      r.count,
      inr(r.taxable, false),
      inr(r.igst, false),
      inr(r.cgstSgst, false),
    ]);
    rows.push([
      "Total",
      rateRows.reduce((s, r) => s + r.count, 0),
      inr(totalTaxable, false),
      inr(totalIgst, false),
      inr(totalCgstSgst, false),
    ]);
    try {
      await generateGstrReportPdf(`GSTR-1 Summary (${month})`, headers, rows, settings);
      toast("GSTR-1 PDF downloaded");
    } catch (e) {
      toast("Failed to generate PDF");
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base font-display">Period</CardTitle>
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select month" />
            </SelectTrigger>
            <SelectContent>
              {months.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base font-display">GSTR-1 — B2B Invoices by Rate</CardTitle>
          <Button
            className="bg-gold text-ink hover:bg-gold/90"
            size="sm"
            onClick={downloadPdf}
            disabled={rateRows.length === 0}
          >
            <Download className="h-4 w-4 mr-1" /> Download PDF
          </Button>
        </CardHeader>
        <CardContent className="pt-0">
          {rateRows.length === 0 ? (
            <EmptyState icon={FileText} text="No B2B tax invoices for this period." />
          ) : (
            <div className="max-h-96 overflow-y-auto scrollbar-thin">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rate</TableHead>
                    <TableHead className="text-right">Invoices</TableHead>
                    <TableHead className="text-right">Taxable</TableHead>
                    <TableHead className="text-right">IGST</TableHead>
                    <TableHead className="text-right">CGST + SGST</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rateRows.map((r) => (
                    <TableRow key={r.rate}>
                      <TableCell className="font-medium">{r.rate}%</TableCell>
                      <TableCell className="text-right">{r.count}</TableCell>
                      <TableCell className="text-right">{inr(r.taxable)}</TableCell>
                      <TableCell className="text-right">{inr(r.igst)}</TableCell>
                      <TableCell className="text-right">{inr(r.cgstSgst)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/40 font-medium">
                    <TableCell>Total</TableCell>
                    <TableCell className="text-right">
                      {rateRows.reduce((s, r) => s + r.count, 0)}
                    </TableCell>
                    <TableCell className="text-right">{inr(totalTaxable)}</TableCell>
                    <TableCell className="text-right">{inr(totalIgst)}</TableCell>
                    <TableCell className="text-right">{inr(totalCgstSgst)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-display">GSTR-3B — Monthly Summary</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Output tax (tax charged on supplies)</span>
            <span className="font-medium">{inr(outputTax)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Input tax (ITC — placeholder)</span>
            <span className="font-medium">{inr(inputTax)}</span>
          </div>
          <div className="border-t pt-2 flex justify-between">
            <span className="font-medium">Net tax payable</span>
            <span className="font-display text-gold">{inr(netPayable)}</span>
          </div>
          <p className="text-xs text-muted-foreground pt-1">
            Input tax credit is not tracked in this build. Enter your purchase ITC manually before filing.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================
// Outstanding — aging buckets
// ============================================================
function OutstandingTab({ invoices }: { invoices: Invoice[] }) {
  const buckets = ["current", "0-30", "31-60", "61-90", "90+"] as const;
  type Bucket = (typeof buckets)[number];

  const outstanding = invoices.filter((i) => i.balance > 0);

  const grouped: Map<Bucket, Invoice[]> = (() => {
    const map = new Map<Bucket, Invoice[]>();
    for (const b of buckets) map.set(b, []);
    for (const inv of outstanding) {
      const ref = inv.dueDate || inv.issueDate;
      const b = agingBucket(ref) as Bucket;
      map.get(b)!.push(inv);
    }
    return map;
  })();

  const bucketLabel: Record<Bucket, string> = {
    current: "Current (not yet due)",
    "0-30": "0 – 30 days",
    "31-60": "31 – 60 days",
    "61-90": "61 – 90 days",
    "90+": "90+ days (critical)",
  };

  function exportCsv() {
    const rows: (string | number)[][] = [
      ["Bucket", "Client", "Invoice #", "Date", "Due Date", "Total", "Balance", "Overdue Days"],
    ];
    for (const b of buckets) {
      for (const inv of grouped.get(b) || []) {
        const ref = inv.dueDate || inv.issueDate;
        rows.push([
          b,
          inv.clientSnapshot.name,
          inv.number,
          inv.issueDate,
          inv.dueDate || "—",
          inv.grandTotal.toFixed(2),
          inv.balance.toFixed(2),
          Math.max(0, ageInDays(ref)),
        ]);
      }
    }
    downloadCsv(rows, "outstanding-receivables.csv");
    toast("Outstanding CSV exported");
  }

  const totalOutstanding = outstanding.reduce((s, i) => s + i.balance, 0);

  return (
    <Card>
      <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base font-display">
          Outstanding Receivables · {inr(totalOutstanding)}
        </CardTitle>
        <Button
          variant="outline"
          size="sm"
          onClick={exportCsv}
          disabled={outstanding.length === 0}
        >
          <Download className="h-4 w-4 mr-1" /> Export CSV
        </Button>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        {outstanding.length === 0 ? (
          <EmptyState icon={Wallet} text="No outstanding receivables. All invoices are settled." />
        ) : (
          buckets.map((b) => {
            const list = grouped.get(b) || [];
            if (list.length === 0) return null;
            const subtotal = list.reduce((s, i) => s + i.balance, 0);
            return (
              <div key={b} className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-sm flex items-center gap-2">
                    {b === "90+" ? (
                      <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                    ) : (
                      <span className="h-2 w-2 rounded-full bg-gold" />
                    )}
                    {bucketLabel[b]}
                  </h3>
                  <Badge variant={b === "90+" ? "destructive" : "secondary"}>
                    {list.length} · {inr(subtotal)}
                  </Badge>
                </div>
                <div className="max-h-72 overflow-y-auto scrollbar-thin rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Client</TableHead>
                        <TableHead>Invoice #</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">Balance</TableHead>
                        <TableHead className="text-right">Overdue</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {list.map((inv) => {
                        const ref = inv.dueDate || inv.issueDate;
                        return (
                          <TableRow key={inv.id}>
                            <TableCell className="font-medium">
                              {inv.clientSnapshot.name}
                            </TableCell>
                            <TableCell className="font-mono text-xs">{inv.number}</TableCell>
                            <TableCell className="text-xs">{fmtDate(inv.issueDate)}</TableCell>
                            <TableCell className="text-right">{inr(inv.grandTotal)}</TableCell>
                            <TableCell className="text-right font-medium">{inr(inv.balance)}</TableCell>
                            <TableCell className="text-right text-xs">
                              {Math.max(0, ageInDays(ref))}d
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================
// Inventory — stock valuation + low stock
// ============================================================
function InventoryTab({
  products,
}: {
  products: {
    id: string;
    name: string;
    sku?: string;
    unit: string;
    salePrice: number;
    purchasePrice?: number;
    stock: number;
    lowStockThreshold: number;
    deletedAt?: string | null;
  }[];
}) {
  const active = products.filter((p) => !p.deletedAt);
  const lowStock = active.filter((p) => p.stock <= p.lowStockThreshold);

  const totalStockValue = active.reduce(
    (s, p) => s + p.stock * (p.purchasePrice || 0),
    0
  );
  const totalSaleValue = active.reduce((s, p) => s + p.stock * p.salePrice, 0);

  function exportCsv() {
    const rows: (string | number)[][] = [
      ["Product", "SKU", "Stock", "Unit", "Purchase Price", "Stock Value", "Sale Price", "Potential Sale Value"],
    ];
    for (const p of active) {
      rows.push([
        p.name,
        p.sku || "",
        p.stock,
        p.unit,
        (p.purchasePrice || 0).toFixed(2),
        (p.stock * (p.purchasePrice || 0)).toFixed(2),
        p.salePrice.toFixed(2),
        (p.stock * p.salePrice).toFixed(2),
      ]);
    }
    downloadCsv(rows, "inventory-valuation.csv");
    toast("Inventory CSV exported");
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 sm:p-5">
            <div className="text-xs text-muted-foreground">Stock Value (cost)</div>
            <div className="text-xl font-display mt-1">{inr(totalStockValue)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 sm:p-5">
            <div className="text-xs text-muted-foreground">Potential Sale Value</div>
            <div className="text-xl font-display mt-1">{inr(totalSaleValue)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 sm:p-5">
            <div className="text-xs text-muted-foreground">Low Stock Items</div>
            <div className="text-xl font-display mt-1 flex items-center gap-2">
              {lowStock.length}
              {lowStock.length > 0 && (
                <AlertTriangle className="h-4 w-4 text-amber-500" />
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base font-display flex items-center gap-2">
            <Package className="h-4 w-4 text-gold" /> Stock Valuation
          </CardTitle>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={active.length === 0}>
            <Download className="h-4 w-4 mr-1" /> Export CSV
          </Button>
        </CardHeader>
        <CardContent className="pt-0">
          {active.length === 0 ? (
            <EmptyState icon={Package} text="No products in catalog." />
          ) : (
            <div className="max-h-96 overflow-y-auto scrollbar-thin">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead className="text-right">Purchase</TableHead>
                    <TableHead className="text-right">Stock Value</TableHead>
                    <TableHead className="text-right">Sale</TableHead>
                    <TableHead className="text-right">Sale Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {active.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">
                        {p.name}
                        {p.stock <= p.lowStockThreshold && (
                          <Badge variant="destructive" className="ml-2 text-[10px]">
                            Low
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {p.stock} {p.unit}
                      </TableCell>
                      <TableCell className="text-right">{inr(p.purchasePrice || 0)}</TableCell>
                      <TableCell className="text-right">{inr(p.stock * (p.purchasePrice || 0))}</TableCell>
                      <TableCell className="text-right">{inr(p.salePrice)}</TableCell>
                      <TableCell className="text-right">{inr(p.stock * p.salePrice)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {lowStock.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-display flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" /> Low Stock Alerts
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {lowStock.map((p) => (
                <div key={p.id} className="flex justify-between items-center text-sm py-1.5 border-b last:border-0">
                  <span>{p.name}</span>
                  <Badge variant={p.stock === 0 ? "destructive" : "secondary"}>
                    {p.stock} {p.unit} · threshold {p.lowStockThreshold}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============================================================
// Taxes — GST collected by rate
// ============================================================
function TaxesTab({ invoices }: { invoices: Invoice[] }) {
  const taxInvoices = invoices.filter((i) => i.type === "tax_invoice");

  const rows = useMemo(() => {
    const map = new Map<number, { count: Set<string>; taxable: number; tax: number }>();
    for (const inv of taxInvoices) {
      for (const it of inv.items) {
        const r = it.gstRate || 0;
        if (!map.has(r)) map.set(r, { count: new Set(), taxable: 0, tax: 0 });
        const m = map.get(r)!;
        m.count.add(inv.id);
        m.taxable += it.taxableAmount;
        m.tax += it.igst + it.cgst + it.sgst;
      }
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([rate, m]) => ({
        rate,
        count: m.count.size,
        taxable: m.taxable,
        tax: m.tax,
      }));
  }, [taxInvoices]);

  const totalTaxable = rows.reduce((s, r) => s + r.taxable, 0);
  const totalTax = rows.reduce((s, r) => s + r.tax, 0);

  const pieData = rows
    .filter((r) => r.tax > 0)
    .map((r) => ({ name: `${r.rate}%`, value: r.tax }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-display flex items-center gap-2">
              <IndianRupee className="h-4 w-4 text-gold" /> GST Collected by Rate
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {rows.length === 0 ? (
              <EmptyState icon={IndianRupee} text="No GST collected yet." />
            ) : (
              <div className="max-h-96 overflow-y-auto scrollbar-thin">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rate</TableHead>
                      <TableHead className="text-right">Invoices</TableHead>
                      <TableHead className="text-right">Taxable</TableHead>
                      <TableHead className="text-right">Tax Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={r.rate}>
                        <TableCell className="font-medium">{r.rate}%</TableCell>
                        <TableCell className="text-right">{r.count}</TableCell>
                        <TableCell className="text-right">{inr(r.taxable)}</TableCell>
                        <TableCell className="text-right font-medium">{inr(r.tax)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/40 font-medium">
                      <TableCell>Total</TableCell>
                      <TableCell className="text-right">
                        {rows.reduce((s, r) => s + r.count, 0)}
                      </TableCell>
                      <TableCell className="text-right">{inr(totalTaxable)}</TableCell>
                      <TableCell className="text-right">{inr(totalTax)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Tax Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="h-72">
              {pieData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                  No tax collected
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={85}
                      paddingAngle={2}
                      label={(e: any) => `${e.name}`}
                    >
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v: number) => inr(v)}
                      contentStyle={{ borderRadius: 8, border: "1px solid #e4e4e7", fontSize: 12 }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ============================================================
// Shared helpers
// ============================================================
function EmptyState({ icon: Icon, text }: { icon: any; text: string }) {
  return (
    <div className="text-center py-10 text-sm text-muted-foreground">
      <Icon className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
      {text}
    </div>
  );
}
