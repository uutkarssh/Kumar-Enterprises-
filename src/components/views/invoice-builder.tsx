"use client";
import { useMemo, useState, useEffect } from "react";
import { useApp } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft, Plus, Trash2, Save, Eye, GripVertical, Package, FileText, Calculator,
} from "lucide-react";
import {
  INVOICE_TYPES,
  INDIAN_STATES,
  UNITS,
  type Invoice,
  type InvoiceType,
  type LineItem,
  type TaxType,
} from "@/lib/types";
import {
  computeLine, computeInvoiceTotals, resolveTaxType, isGstApplicable, inr, todayIso, addDays, uid, round2,
} from "@/lib/gst";
import { emptyLine, lineFromProduct, snapshotFromClient, createDraftInvoice } from "@/lib/invoice-factory";
import { putInvoice, adjustStock } from "@/lib/db";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function InvoiceBuilderView() {
  const editing = useApp((s) => s.editingInvoice);
  const setView = useApp((s) => s.setView);
  const clients = useApp((s) => s.clients);
  const products = useApp((s) => s.products);
  const settings = useApp((s) => s.settings);
  const invoices = useApp((s) => s.invoices);
  const reload = useApp((s) => s.reload);
  const editInvoice = useApp((s) => s.editInvoice);

  // If we entered the builder via command-palette draft (number === 'DRAFT'), replace with a proper draft
  const [inv, setInv] = useState<Invoice>(() => {
    if (!editing) {
      return createDraftInvoice(settings!, clients, invoices.map((i) => i.number), "tax_invoice");
    }
    if (editing.number === "DRAFT" || !editing.clientId) {
      return createDraftInvoice(settings!, clients, invoices.map((i) => i.number), editing.type);
    }
    return editing;
  });

  // recompute totals whenever items/discount/type/client change
  const recomputed = useMemo(() => {
    const taxApplicable = isGstApplicable(inv.type);
    const businessState = settings?.business.stateCode || "";
    const taxType: TaxType = resolveTaxType(businessState, inv.placeOfSupply, settings?.invoice.defaultTaxType || "intra");
    const items = inv.items.map((it) => ({
      ...it,
      ...computeLine(it.quantity, it.rate, it.discountPct, taxApplicable ? it.gstRate : 0, taxType, taxApplicable),
    }));
    const totals = computeInvoiceTotals(items, inv.globalDiscountPct, settings?.invoice.enableRoundOff ?? true, taxApplicable, taxType);
    return { items, totals, taxType, taxApplicable };
  }, [inv.items, inv.type, inv.placeOfSupply, inv.globalDiscountPct, settings]);

  const current: Invoice = { ...inv, ...recomputed.totals, items: recomputed.items, balance: Math.max(0, recomputed.totals.grandTotal - inv.paidAmount) };

  const update = (patch: Partial<Invoice>) => setInv((c) => ({ ...c, ...patch }));
  const updateItem = (id: string, patch: Partial<LineItem>) => {
    update({
      items: current.items.map((it) => (it.id === id ? { ...it, ...patch } : it)),
    });
  };
  const addItem = () => update({ items: [...current.items, emptyLine()] });
  const removeItem = (id: string) => update({ items: current.items.filter((it) => it.id !== id) });
  const addProductLine = (productId: string) => {
    const p = products.find((x) => x.id === productId);
    if (!p) return;
    update({ items: [...current.items, lineFromProduct(p)] });
  };
  const onPickClient = (clientId: string) => {
    const c = clients.find((x) => x.id === clientId);
    if (!c) return;
    const snap = snapshotFromClient(c);
    const businessState = settings?.business.stateCode || "";
    const placeOfSupply = c.stateCode || businessState;
    update({ clientId, clientSnapshot: snap, placeOfSupply });
  };

  const onTypeChange = (type: InvoiceType) => {
    // If switching to a non-GST type, zero out gst on lines
    const applicable = isGstApplicable(type);
    update({
      type,
      items: current.items.map((it) => (applicable ? it : { ...it, gstRate: 0 })),
      placeOfSupply: settings?.business.stateCode || inv.placeOfSupply,
    });
  };

  const save = async (status: "draft" | "issued") => {
    if (!current.clientId) {
      toast.error("Please select a client");
      return;
    }
    if (current.items.length === 0 || current.items.every((i) => !i.description)) {
      toast.error("Add at least one line item");
      return;
    }
    const toSave: Invoice = {
      ...current,
      items: current.items.filter((it) => it.description.trim() !== "" || it.quantity > 0 || it.rate > 0),
      status,
      updatedAt: new Date().toISOString(),
    };
    await putInvoice(toSave);
    // Adjust stock for issued tax invoices / delivery challans
    if (status === "issued" && (toSave.type === "tax_invoice" || toSave.type === "delivery_challan")) {
      for (const it of toSave.items) {
        if (it.productId) await adjustStock(it.productId, -Math.abs(it.quantity));
      }
    }
    await reload();
    toast.success(status === "draft" ? "Draft saved" : "Invoice issued", { description: toSave.number });
    editInvoice(null);
    setView("invoices");
  };

  if (!settings) return null;
  const meta = INVOICE_TYPES.find((t) => t.value === current.type);
  const taxApplicable = recomputed.taxApplicable;
  const isInter = recomputed.taxType === "inter";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => { editInvoice(null); setView("invoices"); }}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-display flex items-center gap-2">
              {meta?.label}
              <Badge variant="outline" className="font-mono">{current.number}</Badge>
            </h1>
            <p className="text-xs text-muted-foreground">{meta ? descriptionFor(current.type) : ""}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => save("draft")}>
            <Save className="h-4 w-4 mr-1" /> Save Draft
          </Button>
          <Button className="bg-gold text-ink hover:bg-gold/90" onClick={() => save("issued")}>
            <FileText className="h-4 w-4 mr-1" /> Issue {meta?.short}
          </Button>
        </div>
      </div>

      {/* Invoice type selector */}
      <div className="flex flex-wrap gap-2">
        {INVOICE_TYPES.map((t) => (
          <button
            key={t.value}
            onClick={() => onTypeChange(t.value)}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-medium border transition-colors",
              current.type === t.value ? "bg-ink text-gold border-ink" : "border-border hover:bg-muted"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: client + meta */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Bill To</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs">Client</Label>
                <Select value={current.clientId} onValueChange={onPickClient}>
                  <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.businessName || c.name}{c.gstin ? ` · ${c.gstin}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {current.clientSnapshot.gstin && (
                <div className="text-xs text-muted-foreground">
                  GSTIN: <span className="font-mono">{current.clientSnapshot.gstin}</span>
                </div>
              )}
              {current.clientSnapshot.address && (
                <div className="text-xs text-muted-foreground">{current.clientSnapshot.address}</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Issue Date</Label>
                  <Input type="date" value={current.issueDate} onChange={(e) => update({ issueDate: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Due Date</Label>
                  <Input type="date" value={current.dueDate || ""} onChange={(e) => update({ dueDate: e.target.value || undefined })} />
                </div>
              </div>
              <div>
                <Label className="text-xs">Place of Supply</Label>
                <Select value={current.placeOfSupply} onValueChange={(v) => update({ placeOfSupply: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {INDIAN_STATES.map((s) => (
                      <SelectItem key={s.code} value={s.code}>{s.name} ({s.code})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Reference (PO/Challan)</Label>
                <Input value={current.reference || ""} onChange={(e) => update({ reference: e.target.value })} placeholder="Optional" />
              </div>
              {taxApplicable && (
                <div className="flex items-center justify-between rounded-md border p-2.5">
                  <div>
                    <div className="text-sm font-medium">Reverse Charge</div>
                    <div className="text-xs text-muted-foreground">Tax payable by recipient</div>
                  </div>
                  <Switch checked={current.reverseCharge} onCheckedChange={(v) => update({ reverseCharge: v })} />
                </div>
              )}
              <div className="flex items-center justify-between rounded-md border p-2.5">
                <div className="text-sm font-medium">Currency</div>
                <Select value={current.currency} onValueChange={(v) => update({ currency: v })}>
                  <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["INR", "USD", "EUR", "AED"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: items + totals (spans 2) */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">Line Items</CardTitle>
              <div className="flex gap-2">
                <Select value="" onValueChange={addProductLine}>
                  <SelectTrigger className="h-8 w-auto text-xs">
                    <Package className="h-3.5 w-3.5 mr-1" />
                    <span>Add from inventory</span>
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} · {inr(p.salePrice)}/{p.unit}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" variant="outline" onClick={addItem}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Line
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="w-20">HSN/SAC</TableHead>
                      <TableHead className="w-20">Unit</TableHead>
                      <TableHead className="w-20">Qty</TableHead>
                      <TableHead className="w-24">Rate</TableHead>
                      <TableHead className="w-20">Disc%</TableHead>
                      {taxApplicable && <TableHead className="w-20">GST%</TableHead>}
                      <TableHead className="w-28 text-right">Amount</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {current.items.map((it, idx) => (
                      <TableRow key={it.id}>
                        <TableCell className="text-muted-foreground text-xs">{idx + 1}</TableCell>
                        <TableCell>
                          <Input
                            value={it.description}
                            onChange={(e) => updateItem(it.id, { description: e.target.value })}
                            placeholder="Item description"
                            className="h-8"
                          />
                        </TableCell>
                        <TableCell>
                          <Input value={it.hsn} onChange={(e) => updateItem(it.id, { hsn: e.target.value })} className="h-8 font-mono text-xs" />
                        </TableCell>
                        <TableCell>
                          <Select value={it.unit} onValueChange={(v) => updateItem(it.id, { unit: v })}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input type="number" value={it.quantity} onChange={(e) => updateItem(it.id, { quantity: parseFloat(e.target.value) || 0 })} className="h-8 text-right" />
                        </TableCell>
                        <TableCell>
                          <Input type="number" value={it.rate} onChange={(e) => updateItem(it.id, { rate: parseFloat(e.target.value) || 0 })} className="h-8 text-right" />
                        </TableCell>
                        <TableCell>
                          <Input type="number" value={it.discountPct} onChange={(e) => updateItem(it.id, { discountPct: parseFloat(e.target.value) || 0 })} className="h-8 text-right" />
                        </TableCell>
                        {taxApplicable && (
                          <TableCell>
                            <Select value={String(it.gstRate)} onValueChange={(v) => updateItem(it.id, { gstRate: parseFloat(v) })}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {[0, 5, 12, 18, 28].map((r) => <SelectItem key={r} value={String(r)}>{r}%</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </TableCell>
                        )}
                        <TableCell className="text-right font-medium">{inr(it.total, current.currency, false)}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-red-600" onClick={() => removeItem(it.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile item cards */}
              <div className="md:hidden divide-y p-3 space-y-3">
                {current.items.map((it, idx) => (
                  <div key={it.id} className="rounded-md border p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Item {idx + 1}</span>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-red-600" onClick={() => removeItem(it.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <Input value={it.description} onChange={(e) => updateItem(it.id, { description: e.target.value })} placeholder="Description" className="h-8" />
                    <div className="grid grid-cols-3 gap-2">
                      <Input value={it.hsn} onChange={(e) => updateItem(it.id, { hsn: e.target.value })} placeholder="HSN" className="h-8 text-xs" />
                      <Select value={it.unit} onValueChange={(v) => updateItem(it.id, { unit: v })}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>{UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                      </Select>
                      {taxApplicable && (
                        <Select value={String(it.gstRate)} onValueChange={(v) => updateItem(it.id, { gstRate: parseFloat(v) })}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>{[0, 5, 12, 18, 28].map((r) => <SelectItem key={r} value={String(r)}>{r}%</SelectItem>)}</SelectContent>
                        </Select>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Qty</Label>
                        <Input type="number" value={it.quantity} onChange={(e) => updateItem(it.id, { quantity: parseFloat(e.target.value) || 0 })} className="h-8 text-right" />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Rate</Label>
                        <Input type="number" value={it.rate} onChange={(e) => updateItem(it.id, { rate: parseFloat(e.target.value) || 0 })} className="h-8 text-right" />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Disc%</Label>
                        <Input type="number" value={it.discountPct} onChange={(e) => updateItem(it.id, { discountPct: parseFloat(e.target.value) || 0 })} className="h-8 text-right" />
                      </div>
                    </div>
                    <div className="text-right text-sm font-medium">{inr(it.total, current.currency, false)}</div>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addItem} className="w-full">
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add line
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Notes + terms */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm font-medium text-muted-foreground">Notes</CardTitle></CardHeader>
              <CardContent>
                <Textarea value={current.notes || ""} onChange={(e) => update({ notes: e.target.value })} rows={3} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm font-medium text-muted-foreground">Terms & Conditions</CardTitle></CardHeader>
              <CardContent>
                <Textarea value={current.terms || ""} onChange={(e) => update({ terms: e.target.value })} rows={3} />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Sticky totals bar */}
      <div className="sticky bottom-0 z-20 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 bg-background/95 backdrop-blur border-t">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <Calculator className="h-4 w-4 text-gold" />
            <span className="text-sm text-muted-foreground">Global discount %</span>
            <Input
              type="number"
              value={current.globalDiscountPct}
              onChange={(e) => update({ globalDiscountPct: parseFloat(e.target.value) || 0 })}
              className="h-8 w-20 text-right"
            />
          </div>
          <div className="flex-1" />
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-x-6 gap-y-1 text-sm">
            <Totals label="Taxable" value={inr(current.taxableAmount, current.currency, false)} />
            {taxApplicable && (isInter ? (
              <Totals label="IGST" value={inr(current.igst, current.currency, false)} />
            ) : (
              <>
                <Totals label="CGST" value={inr(current.cgst, current.currency, false)} />
                <Totals label="SGST" value={inr(current.sgst, current.currency, false)} />
              </>
            ))}
            {current.roundOff !== 0 && <Totals label="Round" value={inr(current.roundOff, current.currency, false)} />}
            <div className="col-span-2 sm:text-right">
              <div className="text-xs text-muted-foreground uppercase tracking-wide">Grand Total</div>
              <div className="text-xl font-display text-gold">{inr(current.grandTotal, current.currency)}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Totals({ label, value }: { label: string; value: string }) {
  return (
    <div className="sm:text-right">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}

function descriptionFor(type: InvoiceType): string {
  switch (type) {
    case "tax_invoice": return "GST Tax Invoice — required for all taxable supplies to registered persons.";
    case "proforma": return "Proforma Invoice — a quote/estimate, not a tax document.";
    case "bill_of_supply": return "Bill of Supply — for exempt / composition dealers, no GST charged.";
    case "credit_note": return "Credit Note — reduces a previously issued invoice (returns / adjustments).";
    case "delivery_challan": return "Delivery Challan — for movement of goods without a tax invoice.";
    case "non_gst_cash_memo": return "Non-GST Cash Memo — for gitti (gravel) & balu (sand) cash sales that don't carry GST.";
  }
}
