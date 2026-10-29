"use client";
import { useApp } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  TrendingUp, Wallet, AlertCircle, Package, FileText, Plus, Users, ArrowRight, IndianRupee, Clock, AlertTriangle,
} from "lucide-react";
import { inr, fmtDate, agingBucket } from "@/lib/gst";
import { INVOICE_TYPES } from "@/lib/types";
import { editDraftInvoice } from "@/lib/invoice-factory";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, PieChart, Pie, Cell, Legend,
} from "recharts";

export function DashboardView() {
  const invoices = useApp((s) => s.invoices);
  const clients = useApp((s) => s.clients);
  const products = useApp((s) => s.products);
  const expenses = useApp((s) => s.expenses);
  const setView = useApp((s) => s.setView);
  const editInvoice = useApp((s) => s.editInvoice);
  const openInvoice = useApp((s) => s.openInvoice);
  const settings = useApp((s) => s.settings);

  const now = new Date();
  const monthKey = now.toISOString().slice(0, 7);
  const activeInv = invoices.filter((i) => i.status !== "cancelled" && !i.deletedAt);

  const monthInv = activeInv.filter((i) => i.issueDate.slice(0, 7) === monthKey);
  const monthRevenue = monthInv.reduce((s, i) => s + i.grandTotal, 0);
  const totalOutstanding = activeInv.reduce((s, i) => s + i.balance, 0);
  const totalReceived = activeInv.reduce((s, i) => s + i.paidAmount, 0);
  const lowStock = products.filter((p) => p.stock <= p.lowStockThreshold);
  const draftCount = activeInv.filter((i) => i.status === "draft").length;
  const monthExpense = expenses.filter((e) => e.date.slice(0, 7) === monthKey && !e.deletedAt).reduce((s, e) => s + e.amount, 0);

  // 6-month revenue trend
  const trend: { month: string; revenue: number; expense: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = d.toISOString().slice(0, 7);
    const label = d.toLocaleDateString("en-IN", { month: "short" });
    const rev = activeInv.filter((inv) => inv.issueDate.slice(0, 7) === key).reduce((s, inv) => s + inv.grandTotal, 0);
    const exp = expenses.filter((e) => e.date.slice(0, 7) === key && !e.deletedAt).reduce((s, e) => s + e.amount, 0);
    trend.push({ month: label, revenue: rev, expense: exp });
  }

  // invoice by type
  const byType = INVOICE_TYPES.map((t) => ({
    name: t.short,
    value: activeInv.filter((i) => i.type === t.value).length,
  })).filter((x) => x.value > 0);

  const recent = [...activeInv].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6);

  const stats = [
    { label: "Revenue (this month)", value: inr(monthRevenue), icon: TrendingUp, tone: "gold" },
    { label: "Outstanding", value: inr(totalOutstanding), icon: Clock, tone: "red" },
    { label: "Received", value: inr(totalReceived), icon: Wallet, tone: "green" },
    { label: "Low stock items", value: String(lowStock.length), icon: AlertTriangle, tone: lowStock.length ? "amber" : "muted" },
  ];

  const PIE_COLORS = ["#f0a800", "#111111", "#966b04", "#ffda78", "#71717a", "#b08d57"];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Welcome back to {settings?.business.name || "Kumar Enterprises"}. Here&apos;s your business at a glance.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setView("clients")}>
            <Users className="h-4 w-4 mr-1" /> Clients
          </Button>
          <Button
            className="bg-gold text-ink hover:bg-gold/90"
            onClick={() => editInvoice(editDraftInvoice())}
          >
            <Plus className="h-4 w-4 mr-1" /> New Invoice
          </Button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label} className="overflow-hidden">
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-center justify-between">
                  <div className={`h-9 w-9 rounded-md flex items-center justify-center ${
                    s.tone === "gold" ? "bg-gold/15 text-gold" :
                    s.tone === "red" ? "bg-red-500/15 text-red-600" :
                    s.tone === "green" ? "bg-emerald-500/15 text-emerald-600" :
                    s.tone === "amber" ? "bg-amber-500/15 text-amber-600" :
                    "bg-muted text-muted-foreground"
                  }`}>
                    <Icon className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-3 text-xl sm:text-2xl font-display">{s.value}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Revenue vs Expenses — last 6 months</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f0a800" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#f0a800" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#71717a" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#71717a" tickFormatter={(v) => `\u20B9${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    formatter={(v: number) => inr(v)}
                    contentStyle={{ borderRadius: 8, border: "1px solid #e4e4e7", fontSize: 12 }}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#f0a800" fill="url(#rev)" strokeWidth={2} name="Revenue" />
                  <Area type="monotone" dataKey="expense" stroke="#71717a" fill="none" strokeWidth={2} strokeDasharray="4 4" name="Expenses" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Invoices by type</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="h-64">
              {byType.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No invoices yet</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={byType} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={2}>
                      {byType.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e4e4e7", fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent invoices + alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Recent Invoices</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setView("invoices")}>
              View all <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </CardHeader>
          <CardContent className="pt-0">
            {recent.length === 0 ? (
              <div className="text-center py-10 text-sm text-muted-foreground">
                <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                No invoices yet. Click <strong>New Invoice</strong> to create your first one.
              </div>
            ) : (
              <div className="divide-y">
                {recent.map((inv) => {
                  const meta = INVOICE_TYPES.find((t) => t.value === inv.type);
                  return (
                    <button
                      key={inv.id}
                      onClick={() => openInvoice(inv.id)}
                      className="w-full flex items-center gap-3 py-2.5 text-left hover:bg-muted/40 -mx-2 px-2 rounded transition-colors"
                    >
                      <div className="h-8 w-8 rounded bg-ink text-gold flex items-center justify-center text-[10px] font-bold">
                        {meta?.short}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{inv.clientSnapshot.name}</div>
                        <div className="text-xs text-muted-foreground font-mono">{inv.number} · {fmtDate(inv.issueDate)}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold">{inr(inv.grandTotal)}</div>
                        <StatusBadge status={inv.status} />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" /> Low Stock
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {lowStock.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">All items are well stocked.</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-thin">
                  {lowStock.slice(0, 6).map((p) => (
                    <div key={p.id} className="flex items-center justify-between text-sm">
                      <span className="truncate">{p.name}</span>
                      <Badge variant={p.stock === 0 ? "destructive" : "secondary"} className="ml-2">
                        {p.stock} {p.unit}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-red-500" /> Aging
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-2 text-sm">
              {(["current", "0-30", "31-60", "61-90", "90+"] as const).map((b) => {
                const sum = activeInv
                  .filter((i) => i.balance > 0 && agingBucket(i.issueDate) === b)
                  .reduce((s, i) => s + i.balance, 0);
                const pct = totalOutstanding > 0 ? (sum / totalOutstanding) * 100 : 0;
                return (
                  <div key={b}>
                    <div className="flex justify-between text-xs">
                      <span className="capitalize text-muted-foreground">{b === "current" ? "Current" : b}</span>
                      <span className="font-medium">{inr(sum)}</span>
                    </div>
                    <Progress value={pct} className="h-1.5 mt-0.5" />
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Quick actions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "New Tax Invoice", icon: FileText, action: () => editInvoice(editDraftInvoice()) },
            { label: "Add Client", icon: Users, action: () => setView("clients") },
            { label: "Add Product", icon: Package, action: () => setView("products") },
            { label: "View Reports", icon: IndianRupee, action: () => setView("reports") },
          ].map((q) => {
            const Icon = q.icon;
            return (
              <button
                key={q.label}
                onClick={q.action}
                className="flex flex-col items-center justify-center gap-2 rounded-lg border border-border p-4 hover:border-gold hover:bg-accent transition-colors"
              >
                <Icon className="h-5 w-5 text-gold" />
                <span className="text-xs font-medium text-center">{q.label}</span>
              </button>
            );
          })}
        </CardContent>
      </Card>
    </div>
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
    <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wide ${map[status] || ""}`}>
      {status}
    </span>
  );
}
