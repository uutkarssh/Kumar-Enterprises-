"use client";
import { useMemo, useState } from "react";
import { useApp } from "@/lib/store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus, Search, FileText, Eye, Pencil, Trash2, Download, Copy, MoreHorizontal, Filter, IndianRupee,
} from "lucide-react";
import { INVOICE_TYPES, type InvoiceType } from "@/lib/types";
import { inr, fmtDate } from "@/lib/gst";
import { createDraftInvoice, editDraftInvoice } from "@/lib/invoice-factory";
import { softDeleteInvoice, putInvoice } from "@/lib/db";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function InvoicesView() {
  const invoices = useApp((s) => s.invoices);
  const clients = useApp((s) => s.clients);
  const products = useApp((s) => s.products);
  const settings = useApp((s) => s.settings);
  const setView = useApp((s) => s.setView);
  const editInvoice = useApp((s) => s.editInvoice);
  const openInvoice = useApp((s) => s.openInvoice);
  const reload = useApp((s) => s.reload);

  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState<InvoiceType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    const ql = q.toLowerCase();
    return invoices
      .filter((i) => !i.deletedAt)
      .filter((i) => typeFilter === "all" || i.type === typeFilter)
      .filter((i) => statusFilter === "all" || i.status === statusFilter)
      .filter(
        (i) =>
          !ql ||
          i.number.toLowerCase().includes(ql) ||
          i.clientSnapshot.name.toLowerCase().includes(ql) ||
          i.clientSnapshot.gstin?.toLowerCase().includes(ql)
      );
  }, [invoices, q, typeFilter, statusFilter]);

  const newInvoice = (type: InvoiceType = "tax_invoice") => {
    if (!settings) return;
    const draft = createDraftInvoice(settings, clients, invoices.map((i) => i.number), type);
    editInvoice(draft);
  };

  const duplicate = async (id: string) => {
    const inv = invoices.find((i) => i.id === id);
    if (!inv || !settings) return;
    const newNum = createDraftInvoice(settings, clients, invoices.map((i) => i.number), inv.type).number;
    const copy: typeof inv = {
      ...inv,
      id: `inv_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
      number: newNum,
      status: "draft",
      paidAmount: 0,
      balance: inv.grandTotal,
      issueDate: new Date().toISOString().slice(0, 10),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await putInvoice(copy);
    await reload();
    toast.success("Invoice duplicated", { description: newNum });
    editInvoice(copy);
  };

  const del = async (id: string) => {
    await softDeleteInvoice(id);
    await reload();
    toast.success("Invoice moved to trash");
  };

  const totalValue = filtered.reduce((s, i) => s + i.grandTotal, 0);
  const totalOutstanding = filtered.reduce((s, i) => s + i.balance, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display">Invoices</h1>
          <p className="text-sm text-muted-foreground">
            {filtered.length} invoice(s) · {inr(totalValue)} billed · {inr(totalOutstanding)} outstanding
          </p>
        </div>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="bg-gold text-ink hover:bg-gold/90">
                <Plus className="h-4 w-4 mr-1" /> New Invoice
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {INVOICE_TYPES.map((t) => (
                <DropdownMenuItem key={t.value} onClick={() => newInvoice(t.value)}>
                  <FileText className="h-4 w-4 mr-2" />
                  <div>
                    <div className="text-sm">{t.label}</div>
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Quick invoice-type chips */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setTypeFilter("all")}
          className={cn(
            "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
            typeFilter === "all" ? "bg-ink text-gold border-ink" : "border-border hover:bg-muted"
          )}
        >
          All types
        </button>
        {INVOICE_TYPES.map((t) => (
          <button
            key={t.value}
            onClick={() => setTypeFilter(t.value)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
              typeFilter === t.value ? "bg-ink text-gold border-ink" : "border-border hover:bg-muted"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Search + status */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by invoice no, client, GSTIN..."
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-44">
            <Filter className="h-4 w-4 mr-1" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="issued">Issued</SelectItem>
            <SelectItem value="partial">Partial</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="text-center py-16">
              <FileText className="h-10 w-10 mx-auto text-muted-foreground/40" />
              <p className="mt-3 text-sm text-muted-foreground">No invoices found.</p>
              <Button onClick={() => newInvoice()} className="mt-4 bg-gold text-ink hover:bg-gold/90">
                <Plus className="h-4 w-4 mr-1" /> Create your first invoice
              </Button>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block max-h-[60vh] overflow-y-auto scrollbar-thin">
                <Table>
                  <TableHeader className="sticky top-0 bg-muted/80 backdrop-blur z-10">
                    <TableRow>
                      <TableHead className="w-12">Type</TableHead>
                      <TableHead>Number</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((inv) => {
                      const meta = INVOICE_TYPES.find((t) => t.value === inv.type);
                      return (
                        <TableRow key={inv.id} className="cursor-pointer" onClick={() => openInvoice(inv.id)}>
                          <TableCell>
                            <span className="inline-flex h-7 w-9 items-center justify-center rounded bg-ink text-gold text-[10px] font-bold">
                              {meta?.short}
                            </span>
                          </TableCell>
                          <TableCell className="font-mono text-xs">{inv.number}</TableCell>
                          <TableCell className="font-medium truncate max-w-[180px]">{inv.clientSnapshot.name}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{fmtDate(inv.issueDate)}</TableCell>
                          <TableCell className="text-right font-medium">{inr(inv.grandTotal)}</TableCell>
                          <TableCell className={cn("text-right font-medium", inv.balance > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600")}>
                            {inr(inv.balance)}
                          </TableCell>
                          <TableCell><StatusBadge status={inv.status} /></TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openInvoice(inv.id)}>
                                  <Eye className="h-4 w-4 mr-2" /> View / Print
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => editInvoice(inv)}>
                                  <Pencil className="h-4 w-4 mr-2" /> Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => duplicate(inv.id)}>
                                  <Copy className="h-4 w-4 mr-2" /> Duplicate
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-red-600" onClick={() => del(inv.id)}>
                                  <Trash2 className="h-4 w-4 mr-2" /> Move to trash
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden divide-y">
                {filtered.map((inv) => {
                  const meta = INVOICE_TYPES.find((t) => t.value === inv.type);
                  return (
                    <button
                      key={inv.id}
                      onClick={() => openInvoice(inv.id)}
                      className="w-full text-left p-4 hover:bg-muted/40"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="inline-flex h-7 w-9 items-center justify-center rounded bg-ink text-gold text-[10px] font-bold shrink-0">
                            {meta?.short}
                          </span>
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">{inv.clientSnapshot.name}</div>
                            <div className="text-xs text-muted-foreground font-mono">{inv.number}</div>
                          </div>
                        </div>
                        <StatusBadge status={inv.status} />
                      </div>
                      <div className="mt-2 flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{fmtDate(inv.issueDate)}</span>
                        <span className="font-semibold">{inr(inv.grandTotal)}</span>
                      </div>
                      {inv.balance > 0 && (
                        <div className="mt-1 text-xs text-red-600">Balance: {inr(inv.balance)}</div>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}
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
    <span className={cn("inline-block text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wide", map[status] || "")}>
      {status}
    </span>
  );
}
