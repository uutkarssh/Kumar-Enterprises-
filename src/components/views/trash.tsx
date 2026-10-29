"use client";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useApp } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Trash2,
  RotateCcw,
  FileText,
  Users,
  Package,
  CreditCard,
  Receipt,
  Inbox,
  Loader2,
} from "lucide-react";
import {
  listInvoices,
  listClients,
  listProducts,
  listPayments,
  listExpenses,
  restoreInvoice,
  purgeInvoice,
  putClient,
  putProduct,
  putPayment,
  putExpense,
} from "@/lib/db";
import { ageInDays, fmtDate, fmtDateTime } from "@/lib/gst";
import type { Client, Expense, Invoice, Payment, Product } from "@/lib/types";

const RETENTION_DAYS = 30;

export function TrashView() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const reloadStore = useApp((s) => s.reload);

  const refresh = useCallback(async () => {
    const [inv, cli, prod, pay, exp] = await Promise.all([
      listInvoices(true),
      listClients(true),
      listProducts(true),
      listPayments(true),
      listExpenses(true),
    ]);
    setInvoices(inv.filter((i) => i.deletedAt));
    setClients(cli.filter((c) => c.deletedAt));
    setProducts(prod.filter((p) => p.deletedAt));
    setPayments(pay.filter((p) => p.deletedAt));
    setExpenses(exp.filter((e) => e.deletedAt));
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        await refresh();
      } finally {
        setLoading(false);
      }
    })();
  }, [refresh]);

  async function afterAction() {
    await refresh();
    await reloadStore();
  }

  async function restoreInvoiceAction(id: string) {
    await restoreInvoice(id);
    toast.success("Invoice restored");
    await afterAction();
  }

  async function purgeInvoiceAction(id: string) {
    await purgeInvoice(id);
    toast.success("Invoice permanently deleted");
    await afterAction();
  }

  async function restoreClient(c: Client) {
    await putClient({ ...c, deletedAt: null });
    toast.success("Client restored");
    await afterAction();
  }
  async function restoreProduct(p: Product) {
    await putProduct({ ...p, deletedAt: null });
    toast.success("Product restored");
    await afterAction();
  }
  async function restorePayment(p: Payment) {
    await putPayment({ ...p, deletedAt: null });
    toast.success("Payment restored");
    await afterAction();
  }
  async function restoreExpense(e: Expense) {
    await putExpense({ ...e, deletedAt: null });
    toast.success("Expense restored");
    await afterAction();
  }

  async function emptyInvoiceTrash() {
    const promises = invoices.map((inv) => purgeInvoice(inv.id));
    await Promise.all(promises);
    toast.success(`Permanently deleted ${invoices.length} invoice${invoices.length === 1 ? "" : "s"}`);
    await afterAction();
  }

  const total = invoices.length + clients.length + products.length + payments.length + expenses.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-gold" /> Trash
          </h1>
          <p className="text-sm text-muted-foreground">
            Deleted items are kept here for {RETENTION_DAYS} days. After that they are permanently
            removed. Restore an item to bring it back.
          </p>
        </div>
        {invoices.length > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">
                <Trash2 className="h-4 w-4 mr-1" /> Empty invoice trash ({invoices.length})
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Permanently delete all trashed invoices?</AlertDialogTitle>
                <AlertDialogDescription>
                  This removes {invoices.length} invoice{invoices.length === 1 ? "" : "s"} from the
                  trash bin forever. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-white hover:bg-destructive/90"
                  onClick={emptyInvoiceTrash}
                >
                  Yes, empty trash
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {loading ? (
        <Card>
          <CardContent className="p-8 flex items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Loading trash…
          </CardContent>
        </Card>
      ) : total === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            <Inbox className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
            <div className="font-display text-base text-foreground">Trash is empty</div>
            <p className="mt-1">Deleted invoices, clients, products, payments and expenses appear here.</p>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="invoices">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="invoices">
              <FileText className="h-3.5 w-3.5 mr-1" /> Invoices
              <Count n={invoices.length} />
            </TabsTrigger>
            <TabsTrigger value="clients">
              <Users className="h-3.5 w-3.5 mr-1" /> Clients
              <Count n={clients.length} />
            </TabsTrigger>
            <TabsTrigger value="products">
              <Package className="h-3.5 w-3.5 mr-1" /> Products
              <Count n={products.length} />
            </TabsTrigger>
            <TabsTrigger value="payments">
              <CreditCard className="h-3.5 w-3.5 mr-1" /> Payments
              <Count n={payments.length} />
            </TabsTrigger>
            <TabsTrigger value="expenses">
              <Receipt className="h-3.5 w-3.5 mr-1" /> Expenses
              <Count n={expenses.length} />
            </TabsTrigger>
          </TabsList>

          <TabsContent value="invoices">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-display">Trashed Invoices</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {invoices.length === 0 ? (
                  <Empty />
                ) : (
                  <div className="max-h-96 overflow-y-auto scrollbar-thin">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Invoice #</TableHead>
                          <TableHead>Client</TableHead>
                          <TableHead>Issued</TableHead>
                          <TableHead>Deleted</TableHead>
                          <TableHead className="text-right">Days left</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {invoices.map((inv) => {
                          const left = Math.max(0, RETENTION_DAYS - ageInDays(inv.deletedAt!));
                          return (
                            <TableRow key={inv.id}>
                              <TableCell className="font-mono text-xs">{inv.number}</TableCell>
                              <TableCell className="font-medium">{inv.clientSnapshot.name}</TableCell>
                              <TableCell className="text-xs">{fmtDate(inv.issueDate)}</TableCell>
                              <TableCell className="text-xs">{fmtDateTime(inv.deletedAt!)}</TableCell>
                              <TableCell className="text-right">
                                <Badge variant={left <= 7 ? "destructive" : "secondary"}>{left}d</Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-1">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => restoreInvoiceAction(inv.id)}
                                  >
                                    <RotateCcw className="h-3.5 w-3.5 mr-1" /> Restore
                                  </Button>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button size="sm" variant="destructive">
                                        <Trash2 className="h-3.5 w-3.5 mr-1" /> Purge
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>
                                          Permanently delete this invoice?
                                        </AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Invoice <strong>{inv.number}</strong> ({inv.clientSnapshot.name})
                                          will be removed forever. This cannot be undone.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                          className="bg-destructive text-white hover:bg-destructive/90"
                                          onClick={() => purgeInvoiceAction(inv.id)}
                                        >
                                          Delete forever
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="clients">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-display">Trashed Clients</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {clients.length === 0 ? (
                  <Empty />
                ) : (
                  <SimpleList
                    columns={["Name", "Phone", "Deleted", "Days left"]}
                    rows={clients.map((c) => ({
                      id: c.id,
                      cells: [
                        c.businessName || c.name,
                        c.phone || "—",
                        fmtDateTime(c.deletedAt!),
                        String(Math.max(0, RETENTION_DAYS - ageInDays(c.deletedAt!))) + "d",
                      ],
                      onRestore: () => restoreClient(c),
                    }))}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="products">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-display">Trashed Products</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {products.length === 0 ? (
                  <Empty />
                ) : (
                  <SimpleList
                    columns={["Product", "SKU", "Deleted", "Days left"]}
                    rows={products.map((p) => ({
                      id: p.id,
                      cells: [
                        p.name,
                        p.sku || "—",
                        fmtDateTime(p.deletedAt!),
                        String(Math.max(0, RETENTION_DAYS - ageInDays(p.deletedAt!))) + "d",
                      ],
                      onRestore: () => restoreProduct(p),
                    }))}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payments">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-display">Trashed Payments</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {payments.length === 0 ? (
                  <Empty />
                ) : (
                  <SimpleList
                    columns={["Date", "Amount", "Mode", "Deleted", "Days left"]}
                    rows={payments.map((p) => ({
                      id: p.id,
                      cells: [
                        fmtDate(p.date),
                        `\u20B9${p.amount.toFixed(2)}`,
                        p.mode,
                        fmtDateTime(p.deletedAt!),
                        String(Math.max(0, RETENTION_DAYS - ageInDays(p.deletedAt!))) + "d",
                      ],
                      onRestore: () => restorePayment(p),
                    }))}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="expenses">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-display">Trashed Expenses</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {expenses.length === 0 ? (
                  <Empty />
                ) : (
                  <SimpleList
                    columns={["Date", "Category", "Amount", "Deleted", "Days left"]}
                    rows={expenses.map((e) => ({
                      id: e.id,
                      cells: [
                        fmtDate(e.date),
                        e.category,
                        `\u20B9${e.amount.toFixed(2)}`,
                        fmtDateTime(e.deletedAt!),
                        String(Math.max(0, RETENTION_DAYS - ageInDays(e.deletedAt!))) + "d",
                      ],
                      onRestore: () => restoreExpense(e),
                    }))}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

// ============================================================
// Helpers
// ============================================================
function Count({ n }: { n: number }) {
  if (n === 0) return null;
  return (
    <Badge variant="secondary" className="ml-1.5 h-4 px-1.5 text-[10px]">
      {n}
    </Badge>
  );
}

function Empty() {
  return (
    <div className="text-center py-10 text-sm text-muted-foreground">
      <Inbox className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
      Nothing in this bin.
    </div>
  );
}

function SimpleList({
  columns,
  rows,
}: {
  columns: string[];
  rows: { id: string; cells: string[]; onRestore: () => void }[];
}) {
  return (
    <div className="max-h-96 overflow-y-auto scrollbar-thin">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((c, i) => (
              <TableHead key={c} className={i === columns.length - 1 ? "text-right" : ""}>
                {c}
              </TableHead>
            ))}
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              {r.cells.map((cell, i) => (
                <TableCell
                  key={i}
                  className={i === 0 ? "font-medium" : i === r.cells.length - 1 ? "text-right" : ""}
                >
                  {cell}
                </TableCell>
              ))}
              <TableCell className="text-right">
                <Button size="sm" variant="outline" onClick={r.onRestore}>
                  <RotateCcw className="h-3.5 w-3.5 mr-1" /> Restore
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
