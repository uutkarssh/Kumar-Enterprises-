"use client";
import { useMemo, useRef, useState } from "react";
import { useApp } from "@/lib/store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Search,
  Upload,
  Download,
  MoreVertical,
  Pencil,
  SlidersHorizontal,
  Trash2,
  Package,
  AlertTriangle,
  XCircle,
  IndianRupee,
  Boxes,
  Minus,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { inr, uid } from "@/lib/gst";
import { putProduct, softDeleteProduct, adjustStock } from "@/lib/db";
import { parseCsv, downloadCsv } from "@/lib/csv";
import { UNITS, type Product } from "@/lib/types";

const GST_RATES = [0, 5, 12, 18, 28];

interface FormState {
  name: string;
  sku: string;
  hsn: string;
  unit: string;
  category: string;
  gstRate: number;
  salePrice: string;
  purchasePrice: string;
  stock: string;
  lowStockThreshold: string;
  isGstExempt: boolean;
  notes: string;
}

const emptyForm: FormState = {
  name: "",
  sku: "",
  hsn: "",
  unit: "BAG",
  category: "",
  gstRate: 18,
  salePrice: "",
  purchasePrice: "",
  stock: "0",
  lowStockThreshold: "10",
  isGstExempt: false,
  notes: "",
};

export function ProductsView() {
  const products = useApp((s) => s.products);
  const reload = useApp((s) => s.reload);

  const [search, setSearch] = useState("");
  const [cat, setCat] = useState<string>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [stockOpen, setStockOpen] = useState(false);
  const [stockProduct, setStockProduct] = useState<Product | null>(null);
  const [stockDelta, setStockDelta] = useState<number>(0);
  const [stockReason, setStockReason] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set).sort();
  }, [products]);

  const lowStockCount = products.filter((p) => p.stock <= p.lowStockThreshold).length;
  const outOfStockCount = products.filter((p) => p.stock <= 0).length;
  const totalStockValue = products.reduce(
    (s, p) => s + p.stock * (p.purchasePrice || 0),
    0
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (cat === "low" && p.stock > p.lowStockThreshold) return false;
      if (cat !== "all" && cat !== "low" && p.category !== cat) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.sku || "").toLowerCase().includes(q) ||
        (p.hsn || "").toLowerCase().includes(q) ||
        (p.category || "").toLowerCase().includes(q)
      );
    });
  }, [products, search, cat]);

  function openAdd() {
    setEditing(null);
    setForm(emptyForm);
    setFormOpen(true);
  }

  function openEdit(p: Product) {
    setEditing(p);
    setForm({
      name: p.name,
      sku: p.sku || "",
      hsn: p.hsn,
      unit: p.unit,
      category: p.category || "",
      gstRate: p.gstRate,
      salePrice: String(p.salePrice ?? ""),
      purchasePrice: String(p.purchasePrice ?? ""),
      stock: String(p.stock ?? 0),
      lowStockThreshold: String(p.lowStockThreshold ?? 10),
      isGstExempt: !!p.isGstExempt,
      notes: p.notes || "",
    });
    setFormOpen(true);
  }

  function openAdjust(p: Product) {
    setStockProduct(p);
    setStockDelta(0);
    setStockReason("");
    setStockOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error("Product name is required");
      return;
    }
    if (!form.hsn.trim()) {
      toast.error("HSN code is required");
      return;
    }
    if (!form.unit) {
      toast.error("Unit is required");
      return;
    }
    const salePrice = parseFloat(form.salePrice);
    if (isNaN(salePrice) || salePrice < 0) {
      toast.error("Sale price must be a valid number");
      return;
    }
    const stock = parseFloat(form.stock);
    if (isNaN(stock)) {
      toast.error("Stock must be a valid number");
      return;
    }
    const low = parseFloat(form.lowStockThreshold);
    if (isNaN(low)) {
      toast.error("Low stock threshold must be a valid number");
      return;
    }
    const purchase = parseFloat(form.purchasePrice) || 0;

    setSaving(true);
    try {
      const now = new Date().toISOString();
      const product: Product = {
        id: editing?.id || uid("prod_"),
        name: form.name.trim(),
        sku: form.sku.trim() || undefined,
        hsn: form.hsn.trim(),
        unit: form.unit,
        category: form.category.trim() || undefined,
        gstRate: form.isGstExempt ? 0 : form.gstRate,
        salePrice,
        purchasePrice: purchase > 0 ? purchase : undefined,
        stock,
        lowStockThreshold: low,
        isGstExempt: form.isGstExempt,
        notes: form.notes.trim() || undefined,
        createdAt: editing?.createdAt || now,
        updatedAt: now,
        deletedAt: null,
      };
      await putProduct(product);
      await reload();
      toast.success(editing ? "Product updated" : "Product added");
      setFormOpen(false);
    } catch {
      toast.error("Failed to save product");
    } finally {
      setSaving(false);
    }
  }

  async function handleStockConfirm() {
    if (!stockProduct) return;
    if (!Number.isFinite(stockDelta) || stockDelta === 0) {
      toast.error("Enter a non-zero quantity");
      return;
    }
    try {
      await adjustStock(stockProduct.id, stockDelta);
      await reload();
      toast.success(
        `Stock adjusted by ${stockDelta > 0 ? "+" : ""}${stockDelta} ${stockProduct.unit}`
      );
      setStockOpen(false);
      setStockDelta(0);
      setStockReason("");
    } catch {
      toast.error("Failed to adjust stock");
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await softDeleteProduct(deleteTarget.id);
      await reload();
      toast.success("Product deleted");
      setDeleteTarget(null);
    } catch {
      toast.error("Failed to delete");
    }
  }

  function handleExport() {
    if (products.length === 0) {
      toast.error("No products to export");
      return;
    }
    const rows: (string | number)[][] = [
      [
        "name",
        "sku",
        "hsn",
        "unit",
        "category",
        "gstRate",
        "salePrice",
        "purchasePrice",
        "stock",
        "lowStockThreshold",
      ],
      ...products.map((p) => [
        p.name,
        p.sku || "",
        p.hsn,
        p.unit,
        p.category || "",
        p.gstRate,
        p.salePrice,
        p.purchasePrice || 0,
        p.stock,
        p.lowStockThreshold,
      ]),
    ];
    downloadCsv(rows, `products-${new Date().toISOString().slice(0, 10)}.csv`);
    toast.success(`Exported ${products.length} products`);
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (rows.length < 2) {
        toast.error("CSV has no data rows");
        return;
      }
      const header = rows[0].map((h) => h.trim().toLowerCase());
      const idx = (name: string) => header.indexOf(name);
      const required = ["name", "hsn", "unit"];
      for (const n of required) {
        if (idx(n) < 0) {
          toast.error(`CSV missing required column: ${n}`);
          return;
        }
      }
      let count = 0;
      const now = new Date().toISOString();
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        if (r.length === 1 && r[0] === "") continue;
        const name = (r[idx("name")] || "").trim();
        if (!name) continue;
        const product: Product = {
          id: uid("prod_"),
          name,
          sku: (r[idx("sku")] || "").trim() || undefined,
          hsn: (r[idx("hsn")] || "").trim(),
          unit: (r[idx("unit")] || "BAG").trim() || "BAG",
          category: (r[idx("category")] || "").trim() || undefined,
          gstRate: parseFloat(r[idx("gstRate")] || "0") || 0,
          salePrice: parseFloat(r[idx("salePrice")] || "0") || 0,
          purchasePrice: parseFloat(r[idx("purchasePrice")] || "0") || undefined,
          stock: parseFloat(r[idx("stock")] || "0") || 0,
          lowStockThreshold: parseFloat(r[idx("lowStockThreshold")] || "10") || 10,
          isGstExempt: false,
          notes: undefined,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        };
        await putProduct(product);
        count++;
      }
      await reload();
      toast.success(`Imported ${count} product${count === 1 ? "" : "s"}`);
    } catch {
      toast.error("Failed to import CSV");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const stockTone = (p: Product): "out" | "low" | "ok" =>
    p.stock <= 0 ? "out" : p.stock <= p.lowStockThreshold ? "low" : "ok";

  return (
    <div className="space-y-6">
      {/* Hidden file input for CSV import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={handleImportFile}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display">Inventory</h1>
          <p className="text-sm text-muted-foreground">
            {products.length} products · Stock value {inr(totalStockValue)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4 mr-1" /> Import CSV
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-1" /> Export CSV
          </Button>
          <Button className="bg-gold text-ink hover:bg-gold/90" onClick={openAdd}>
            <Plus className="h-4 w-4 mr-1" /> Add Product
          </Button>
        </div>
      </div>

      {/* Low Stock Alert Banner */}
      {lowStockCount > 0 && (
        <Card className="border-amber-300/60 bg-amber-50/60 dark:border-amber-700/40 dark:bg-amber-950/30">
          <CardContent className="p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-9 w-9 shrink-0 rounded-md bg-amber-500/20 text-amber-600 flex items-center justify-center">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium">Low stock alert</div>
                <div className="text-xs text-muted-foreground truncate">
                  {lowStockCount} product{lowStockCount === 1 ? "" : "s"} at or below threshold
                  {outOfStockCount > 0 && ` · ${outOfStockCount} out of stock`}
                </div>
              </div>
            </div>
            <Button
              size="sm"
              variant={cat === "low" ? "default" : "outline"}
              className={cn(
                cat === "low" &&
                  "bg-amber-500 text-white hover:bg-amber-600 border-transparent"
              )}
              onClick={() => setCat(cat === "low" ? "all" : "low")}
            >
              {cat === "low" ? "Showing low stock" : "View low stock"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: "Total Products", value: String(products.length), icon: Boxes, tone: "gold" },
          { label: "Stock Value", value: inr(totalStockValue), icon: IndianRupee, tone: "green" },
          { label: "Low Stock", value: String(lowStockCount), icon: AlertTriangle, tone: "amber" },
          { label: "Out of Stock", value: String(outOfStockCount), icon: XCircle, tone: "red" },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label}>
              <CardContent className="p-4 sm:p-5">
                <div
                  className={cn(
                    "h-9 w-9 rounded-md flex items-center justify-center",
                    s.tone === "gold" && "bg-gold/15 text-gold",
                    s.tone === "red" && "bg-red-500/15 text-red-600",
                    s.tone === "green" && "bg-emerald-500/15 text-emerald-600",
                    s.tone === "amber" && "bg-amber-500/15 text-amber-600",
                    s.tone === "muted" && "bg-muted text-muted-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="mt-3 text-xl sm:text-2xl font-display">{s.value}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Search + category pills */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, SKU, HSN or category…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Pill active={cat === "all"} onClick={() => setCat("all")}>
            All <span className="ml-1 opacity-70">({products.length})</span>
          </Pill>
          {categories.map((c) => {
            const n = products.filter((p) => p.category === c).length;
            return (
              <Pill key={c} active={cat === c} onClick={() => setCat(c)}>
                {c} <span className="ml-1 opacity-70">({n})</span>
              </Pill>
            );
          })}
          <Pill active={cat === "low"} onClick={() => setCat("low")} tone="amber">
            Low Stock <span className="ml-1 opacity-70">({lowStockCount})</span>
          </Pill>
        </div>
      </div>

      {/* Desktop table */}
      <Card className="hidden md:block">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>HSN</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>GST</TableHead>
                <TableHead className="text-right">Sale Price</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead className="text-right">Stock Value</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-sm text-muted-foreground py-10">
                    <Package className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                    No products found. Click <strong>Add Product</strong> to create your first one.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((p) => {
                  const tone = stockTone(p);
                  const value = p.stock * (p.purchasePrice || 0);
                  return (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div className="font-medium">{p.name}</div>
                        {p.sku && (
                          <div className="text-xs text-muted-foreground font-mono">{p.sku}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        {p.category ? (
                          <Badge variant="secondary">{p.category}</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{p.hsn}</TableCell>
                      <TableCell className="text-xs">{p.unit}</TableCell>
                      <TableCell>
                        {p.isGstExempt ? (
                          <Badge variant="outline" className="text-amber-600 border-amber-400">
                            Exempt
                          </Badge>
                        ) : (
                          <span className="text-xs">{p.gstRate}%</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{inr(p.salePrice)}</TableCell>
                      <TableCell className="text-right">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium",
                            tone === "out" &&
                              "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
                            tone === "low" &&
                              "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
                            tone === "ok" && "text-foreground"
                          )}
                        >
                          {p.stock} {p.unit}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-xs">{inr(value)}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(p)}>
                              <Pencil className="h-3.5 w-3.5 mr-2" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openAdjust(p)}>
                              <SlidersHorizontal className="h-3.5 w-3.5 mr-2" /> Adjust Stock
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-red-600 focus:text-red-700"
                              onClick={() => setDeleteTarget(p)}
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {filtered.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              <Package className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
              No products found.
            </CardContent>
          </Card>
        ) : (
          filtered.map((p) => {
            const tone = stockTone(p);
            const value = p.stock * (p.purchasePrice || 0);
            return (
              <Card key={p.id}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{p.name}</div>
                      {p.sku && (
                        <div className="text-xs text-muted-foreground font-mono truncate">
                          {p.sku}
                        </div>
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(p)}>
                          <Pencil className="h-3.5 w-3.5 mr-2" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openAdjust(p)}>
                          <SlidersHorizontal className="h-3.5 w-3.5 mr-2" /> Adjust Stock
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-600 focus:text-red-700"
                          onClick={() => setDeleteTarget(p)}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {p.category && <Badge variant="secondary">{p.category}</Badge>}
                    {p.isGstExempt ? (
                      <Badge variant="outline" className="text-amber-600 border-amber-400">
                        GST-exempt
                      </Badge>
                    ) : (
                      <Badge variant="outline">{p.gstRate}% GST</Badge>
                    )}
                    <Badge variant="outline" className="font-mono">
                      HSN {p.hsn}
                    </Badge>
                    <Badge variant="outline">{p.unit}</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <div className="text-xs text-muted-foreground">Sale Price</div>
                      <div className="font-medium">{inr(p.salePrice)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Stock Value</div>
                      <div className="font-medium">{inr(value)}</div>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Stock</div>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium",
                        tone === "out" &&
                          "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
                        tone === "low" &&
                          "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
                        tone === "ok" &&
                          "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                      )}
                    >
                      {p.stock} {p.unit}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">
              {editing ? "Edit Product" : "Add Product"}
            </DialogTitle>
            <DialogDescription>
              {editing ? "Update product details" : "Add a new product to your inventory"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="p-name">Name *</Label>
              <Input
                id="p-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. UltraTech Cement 53 Grade"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-sku">SKU</Label>
              <Input
                id="p-sku"
                value={form.sku}
                onChange={(e) => setForm({ ...form, sku: e.target.value })}
                placeholder="e.g. UTC-53"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-hsn">HSN *</Label>
              <Input
                id="p-hsn"
                value={form.hsn}
                onChange={(e) => setForm({ ...form, hsn: e.target.value })}
                placeholder="e.g. 2523"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Unit *</Label>
              <Select value={form.unit} onValueChange={(v) => setForm({ ...form, unit: v })}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select unit" />
                </SelectTrigger>
                <SelectContent>
                  {UNITS.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-category">Category</Label>
              <Input
                id="p-category"
                list="p-category-list"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="Cement, Sand, Gravel…"
              />
              <datalist id="p-category-list">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div className="space-y-1.5">
              <Label>GST Rate</Label>
              <Select
                value={String(form.gstRate)}
                onValueChange={(v) => setForm({ ...form, gstRate: parseInt(v, 10) })}
                disabled={form.isGstExempt}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GST_RATES.map((r) => (
                    <SelectItem key={r} value={String(r)}>
                      {r}%
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-sale">Sale Price (₹) *</Label>
              <Input
                id="p-sale"
                type="number"
                min="0"
                step="0.01"
                value={form.salePrice}
                onChange={(e) => setForm({ ...form, salePrice: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-purchase">Purchase Price (₹)</Label>
              <Input
                id="p-purchase"
                type="number"
                min="0"
                step="0.01"
                value={form.purchasePrice}
                onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-stock">Stock *</Label>
              <Input
                id="p-stock"
                type="number"
                step="0.01"
                value={form.stock}
                onChange={(e) => setForm({ ...form, stock: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-low">Low Stock Threshold *</Label>
              <Input
                id="p-low"
                type="number"
                min="0"
                step="0.01"
                value={form.lowStockThreshold}
                onChange={(e) => setForm({ ...form, lowStockThreshold: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2 flex items-center justify-between rounded-lg border border-border p-3 gap-3">
              <div className="min-w-0">
                <Label htmlFor="p-exempt" className="cursor-pointer">
                  GST-exempt (gitti/balu cash sales)
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Sets GST rate to 0% for cash sales of gravel/sand.
                </p>
              </div>
              <Switch
                id="p-exempt"
                checked={form.isGstExempt}
                onCheckedChange={(v) =>
                  setForm({ ...form, isGstExempt: v, gstRate: v ? 0 : form.gstRate })
                }
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="p-notes">Notes</Label>
              <Textarea
                id="p-notes"
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Internal notes (optional)"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-gold text-ink hover:bg-gold/90"
              disabled={saving}
              onClick={handleSave}
            >
              {saving ? "Saving…" : editing ? "Save Changes" : "Add Product"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Adjust Stock Dialog */}
      <Dialog open={stockOpen} onOpenChange={setStockOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Adjust Stock</DialogTitle>
            <DialogDescription>
              {stockProduct && `Manually correct stock for ${stockProduct.name}`}
            </DialogDescription>
          </DialogHeader>
          {stockProduct && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted/50 p-3 flex items-center justify-between">
                <div>
                  <div className="text-xs text-muted-foreground">Current Stock</div>
                  <div className="text-lg font-display">
                    {stockProduct.stock} {stockProduct.unit}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">After adjustment</div>
                  <div className="text-lg font-display">
                    {stockProduct.stock + stockDelta} {stockProduct.unit}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setStockDelta((d) => d - 1)}
                  aria-label="Decrease"
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <Input
                  type="number"
                  className="text-center"
                  value={stockDelta}
                  onChange={(e) => setStockDelta(parseFloat(e.target.value) || 0)}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setStockDelta((d) => d + 1)}
                  aria-label="Increase"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="stock-reason">Reason</Label>
                <Input
                  id="stock-reason"
                  placeholder="Damage, pilferage, recount…"
                  value={stockReason}
                  onChange={(e) => setStockReason(e.target.value)}
                />
              </div>
              {stockReason && (
                <p className="text-xs text-muted-foreground">
                  Note: reason is for your reference only. Adjustments do not generate audit
                  entries in this release.
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setStockOpen(false)}>
              Cancel
            </Button>
            <Button className="bg-gold text-ink hover:bg-gold/90" onClick={handleStockConfirm}>
              Confirm Adjustment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Delete product?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget &&
                `This will move "${deleteTarget.name}" to trash. Existing invoices that reference it will not be affected.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={handleDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Pill({
  children,
  active,
  onClick,
  tone,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  tone?: "amber";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
        active
          ? tone === "amber"
            ? "bg-amber-500 text-white border-amber-500"
            : "bg-ink text-gold border-ink"
          : "bg-transparent text-muted-foreground border-border hover:border-foreground/30 hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}
