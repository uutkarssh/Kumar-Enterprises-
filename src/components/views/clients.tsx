"use client";
import * as React from "react";
import { useApp } from "@/lib/store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  Users,
  Plus,
  Search,
  Upload,
  MoreVertical,
  Eye,
  Pencil,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { INDIAN_STATES, type Client } from "@/lib/types";
import { putClient, softDeleteClient } from "@/lib/db";
import { parseCsv } from "@/lib/csv";
import { inr, uid, validateGstin, validatePan, validatePhone } from "@/lib/gst";

type TagFilter = "all" | "b2b" | "retail" | "cash";

interface FormState {
  id?: string;
  name: string;
  businessName: string;
  gstin: string;
  pan: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  stateCode: string;
  openingBalance: string;
  creditLimit: string;
  tags: string;
  notes: string;
}

const EMPTY_FORM: FormState = {
  name: "",
  businessName: "",
  gstin: "",
  pan: "",
  phone: "",
  email: "",
  address: "",
  city: "",
  stateCode: "",
  openingBalance: "0",
  creditLimit: "",
  tags: "",
  notes: "",
};

function clientCategory(c: Client): TagFilter {
  const tags = (c.tags || []).map((t) => t.toLowerCase());
  if (tags.includes("cash")) return "cash";
  if (tags.includes("b2b") || (c.gstin && !tags.includes("retail"))) return "b2b";
  return "retail";
}

export function ClientsView() {
  const clients = useApp((s) => s.clients);
  const openClient = useApp((s) => s.openClient);
  const reload = useApp((s) => s.reload);

  const [search, setSearch] = React.useState("");
  const [tagFilter, setTagFilter] = React.useState<TagFilter>("all");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Client | null>(null);
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return clients.filter((c) => {
      if (tagFilter !== "all" && clientCategory(c) !== tagFilter) return false;
      if (!q) return true;
      const hay = [c.name, c.businessName, c.gstin, c.phone, c.city, c.state, c.email]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [clients, search, tagFilter]);

  function openAdd() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setDialogOpen(true);
  }

  function openEdit(c: Client) {
    setEditing(c);
    setForm({
      id: c.id,
      name: c.name,
      businessName: c.businessName || "",
      gstin: c.gstin || "",
      pan: c.pan || "",
      phone: c.phone || "",
      email: c.email || "",
      address: c.address || "",
      city: c.city || "",
      stateCode: c.stateCode || "",
      openingBalance: String(c.openingBalance ?? 0),
      creditLimit: c.creditLimit != null ? String(c.creditLimit) : "",
      tags: (c.tags || []).join(", "),
      notes: c.notes || "",
    });
    setErrors({});
    setDialogOpen(true);
  }

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = "Name is required";
    if (form.gstin && !validateGstin(form.gstin)) errs.gstin = "Invalid GSTIN format";
    if (form.pan && !validatePan(form.pan)) errs.pan = "Invalid PAN format";
    if (form.phone && !validatePhone(form.phone))
      errs.phone = "Invalid phone (10 digits, starts 6-9)";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function save() {
    if (!validate()) return;
    const now = new Date().toISOString();
    const stateObj = INDIAN_STATES.find((s) => s.code === form.stateCode);
    const client: Client = {
      id: editing?.id || uid("cli_"),
      name: form.name.trim(),
      businessName: form.businessName.trim() || undefined,
      gstin: form.gstin.trim().toUpperCase() || undefined,
      pan: form.pan.trim().toUpperCase() || undefined,
      phone: form.phone.trim() || undefined,
      email: form.email.trim() || undefined,
      address: form.address.trim() || undefined,
      city: form.city.trim() || undefined,
      state: stateObj?.name,
      stateCode: stateObj?.code,
      openingBalance: parseFloat(form.openingBalance) || 0,
      creditLimit: form.creditLimit ? parseFloat(form.creditLimit) : undefined,
      tags: form.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      notes: form.notes.trim() || undefined,
      createdAt: editing?.createdAt || now,
      updatedAt: now,
      deletedAt: null,
    };
    await putClient(client);
    await reload();
    toast.success(editing ? "Client updated" : "Client added", {
      description: client.name,
    });
    setDialogOpen(false);
  }

  async function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (rows.length < 2) {
        toast.error("CSV is empty");
        return;
      }
      const header = rows[0].map((h) => h.trim().toLowerCase());
      const idx = (name: string) => header.indexOf(name);
      if (idx("name") < 0) {
        toast.error("CSV missing required column: name");
        return;
      }
      let count = 0;
      const now = new Date().toISOString();
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.every((c) => !c.trim())) continue;
        const name = row[idx("name")]?.trim();
        if (!name) continue;
        const stateCode = row[idx("statecode")]?.trim() || "";
        const stateObj = INDIAN_STATES.find((s) => s.code === stateCode);
        const client: Client = {
          id: uid("cli_"),
          name,
          businessName: row[idx("businessname")]?.trim() || undefined,
          gstin: row[idx("gstin")]?.trim().toUpperCase() || undefined,
          phone: row[idx("phone")]?.trim() || undefined,
          email: row[idx("email")]?.trim() || undefined,
          address: row[idx("address")]?.trim() || undefined,
          city: row[idx("city")]?.trim() || undefined,
          state: stateObj?.name,
          stateCode: stateObj?.code,
          openingBalance: parseFloat(row[idx("openingbalance")] || "0") || 0,
          tags: [],
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        };
        await putClient(client);
        count++;
      }
      await reload();
      toast.success(`Imported ${count} client${count === 1 ? "" : "s"}`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to import CSV");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function confirmDelete() {
    if (!deleteId) return;
    const c = clients.find((x) => x.id === deleteId);
    await softDeleteClient(deleteId);
    await reload();
    toast.success("Client deleted", { description: c?.name });
    setDeleteId(null);
  }

  const tags: { value: TagFilter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "b2b", label: "B2B" },
    { value: "retail", label: "Retail" },
    { value: "cash", label: "Cash" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display">Clients</h1>
          <p className="text-sm text-muted-foreground">
            {clients.length} client{clients.length === 1 ? "" : "s"} in your book
          </p>
        </div>
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={onImportFile}
          />
          <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4 mr-1" /> Import CSV
          </Button>
          <Button className="bg-gold text-ink hover:bg-gold/90" onClick={openAdd}>
            <Plus className="h-4 w-4 mr-1" /> Add Client
          </Button>
        </div>
      </div>

      {/* Search + filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, GSTIN, phone, city…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {tags.map((t) => (
            <Button
              key={t.value}
              size="sm"
              variant={tagFilter === t.value ? "default" : "outline"}
              onClick={() => setTagFilter(t.value)}
              className={cn(
                tagFilter === t.value && "bg-ink text-gold hover:bg-ink/90"
              )}
            >
              {t.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Desktop table */}
      <Card className="hidden md:block">
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">
              <Users className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
              No clients found. Click <strong>Add Client</strong> to add one.
            </div>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto scrollbar-thin">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>GSTIN</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>City / State</TableHead>
                    <TableHead className="text-right">Opening</TableHead>
                    <TableHead className="text-right">Credit Limit</TableHead>
                    <TableHead>Tags</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <button
                          className="text-left"
                          onClick={() => openClient(c.id)}
                        >
                          <div className="font-medium hover:text-gold transition-colors">
                            {c.name}
                          </div>
                          {c.businessName && (
                            <div className="text-xs text-muted-foreground">
                              {c.businessName}
                            </div>
                          )}
                        </button>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {c.gstin || "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {c.phone || "—"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {[c.city, c.state].filter(Boolean).join(", ") || "—"}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {inr(c.openingBalance || 0)}
                      </TableCell>
                      <TableCell className="text-right">
                        {c.creditLimit != null ? inr(c.creditLimit) : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {(c.tags || []).slice(0, 2).map((t) => (
                            <Badge
                              key={t}
                              variant="secondary"
                              className="text-[10px]"
                            >
                              {t}
                            </Badge>
                          ))}
                          {(c.tags || []).length > 2 && (
                            <Badge variant="outline" className="text-[10px]">
                              +{(c.tags || []).length - 2}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <ClientActions
                          client={c}
                          onView={() => openClient(c.id)}
                          onEdit={() => openEdit(c)}
                          onDelete={() => setDeleteId(c.id)}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {filtered.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              <Users className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
              No clients found.
            </CardContent>
          </Card>
        ) : (
          filtered.map((c) => (
            <Card key={c.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <button
                    className="min-w-0 text-left"
                    onClick={() => openClient(c.id)}
                  >
                    <div className="font-medium truncate hover:text-gold transition-colors">
                      {c.name}
                    </div>
                    {c.businessName && (
                      <div className="text-xs text-muted-foreground truncate">
                        {c.businessName}
                      </div>
                    )}
                  </button>
                  <ClientActions
                    client={c}
                    onView={() => openClient(c.id)}
                    onEdit={() => openEdit(c)}
                    onDelete={() => setDeleteId(c.id)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                  <div>
                    <div className="text-muted-foreground">GSTIN</div>
                    <div className="font-mono truncate">{c.gstin || "—"}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Phone</div>
                    <div className="font-mono truncate">{c.phone || "—"}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">City / State</div>
                    <div className="truncate">
                      {[c.city, c.state].filter(Boolean).join(", ") || "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Opening</div>
                    <div className="font-medium">
                      {inr(c.openingBalance || 0)}
                    </div>
                  </div>
                </div>
                {(c.tags || []).length > 0 && (
                  <div className="flex gap-1 flex-wrap mt-3">
                    {(c.tags || []).map((t) => (
                      <Badge
                        key={t}
                        variant="secondary"
                        className="text-[10px]"
                      >
                        {t}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">
              {editing ? "Edit Client" : "Add Client"}
            </DialogTitle>
            <DialogDescription>
              {editing ? "Update client details." : "Create a new client record."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="c-name">Name *</Label>
              <Input
                id="c-name"
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                className={errors.name ? "border-destructive" : ""}
              />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-biz">Business Name</Label>
              <Input
                id="c-biz"
                value={form.businessName}
                onChange={(e) => update("businessName", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-gstin">GSTIN</Label>
              <Input
                id="c-gstin"
                value={form.gstin}
                onChange={(e) => update("gstin", e.target.value.toUpperCase())}
                placeholder="22AAAAA0000A1Z5"
                className={cn(
                  "font-mono uppercase",
                  errors.gstin && "border-destructive"
                )}
              />
              {errors.gstin && (
                <p className="text-xs text-destructive">{errors.gstin}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-pan">PAN</Label>
              <Input
                id="c-pan"
                value={form.pan}
                onChange={(e) => update("pan", e.target.value.toUpperCase())}
                placeholder="AAAAA0000A"
                className={cn(
                  "font-mono uppercase",
                  errors.pan && "border-destructive"
                )}
              />
              {errors.pan && (
                <p className="text-xs text-destructive">{errors.pan}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-phone">Phone</Label>
              <Input
                id="c-phone"
                value={form.phone}
                onChange={(e) => update("phone", e.target.value)}
                placeholder="9876543210"
                className={cn("font-mono", errors.phone && "border-destructive")}
              />
              {errors.phone && (
                <p className="text-xs text-destructive">{errors.phone}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-email">Email</Label>
              <Input
                id="c-email"
                type="email"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="c-addr">Address</Label>
              <Textarea
                id="c-addr"
                rows={2}
                value={form.address}
                onChange={(e) => update("address", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-city">City</Label>
              <Input
                id="c-city"
                value={form.city}
                onChange={(e) => update("city", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-state">State</Label>
              <Select
                value={form.stateCode || undefined}
                onValueChange={(v) => update("stateCode", v)}
              >
                <SelectTrigger id="c-state" className="w-full">
                  <SelectValue placeholder="Select state" />
                </SelectTrigger>
                <SelectContent>
                  {INDIAN_STATES.map((s) => (
                    <SelectItem key={s.code} value={s.code}>
                      {s.code} — {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-ob">Opening Balance (₹)</Label>
              <Input
                id="c-ob"
                type="number"
                value={form.openingBalance}
                onChange={(e) => update("openingBalance", e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                +ve = they owe you
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-cl">Credit Limit (₹)</Label>
              <Input
                id="c-cl"
                type="number"
                value={form.creditLimit}
                onChange={(e) => update("creditLimit", e.target.value)}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="c-tags">Tags (comma separated)</Label>
              <Input
                id="c-tags"
                value={form.tags}
                onChange={(e) => update("tags", e.target.value)}
                placeholder="b2b, retail, cash"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="c-notes">Notes</Label>
              <Textarea
                id="c-notes"
                rows={2}
                value={form.notes}
                onChange={(e) => update("notes", e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button className="bg-gold text-ink hover:bg-gold/90" onClick={save}>
              {editing ? "Save Changes" : "Add Client"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete client?</AlertDialogTitle>
            <AlertDialogDescription>
              This will soft-delete the client. Their invoices and payments
              remain on file. You can restore from Trash later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={confirmDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ClientActions({
  client,
  onView,
  onEdit,
  onDelete,
}: {
  client: Client;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{client.name}</DropdownMenuLabel>
        <DropdownMenuItem onClick={onView}>
          <Eye className="h-4 w-4 mr-2" /> View Ledger
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onEdit}>
          <Pencil className="h-4 w-4 mr-2" /> Edit
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={onDelete}>
          <Trash2 className="h-4 w-4 mr-2" /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
