"use client";
import { useEffect, useState } from "react";
import { useApp, type ViewKey } from "@/lib/store";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { FileText, Users, Package, BarChart3, Settings, Database, Plus, LayoutDashboard, Trash2 } from "lucide-react";
import { editDraftInvoice } from "@/lib/invoice-factory";

export function CommandPalette() {
  const open = useApp((s) => s.commandOpen);
  const setOpen = useApp((s) => s.setCommandOpen);
  const setView = useApp((s) => s.setView);
  const editInvoice = useApp((s) => s.editInvoice);
  const openInvoice = useApp((s) => s.openInvoice);
  const openClient = useApp((s) => s.openClient);
  const invoices = useApp((s) => s.invoices);
  const clients = useApp((s) => s.clients);
  const products = useApp((s) => s.products);
  const [q, setQ] = useState("");

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(!open);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, setOpen]);

  const closePalette = (b: boolean) => {
    setOpen(b);
    if (!b) setQ("");
  };

  const nav: { key: ViewKey; label: string; icon: any }[] = [
    { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { key: "invoices", label: "Invoices", icon: FileText },
    { key: "clients", label: "Clients", icon: Users },
    { key: "products", label: "Inventory", icon: Package },
    { key: "reports", label: "Reports & GST", icon: BarChart3 },
    { key: "settings", label: "Settings", icon: Settings },
    { key: "backup", label: "Backup & Restore", icon: Database },
    { key: "trash", label: "Trash Bin", icon: Trash2 },
  ];

  const ql = q.toLowerCase();
  const matchingInvoices = q
    ? invoices
        .filter((i) => i.number.toLowerCase().includes(ql) || i.clientSnapshot.name.toLowerCase().includes(ql))
        .slice(0, 6)
    : [];
  const matchingClients = q
    ? clients.filter((c) => c.name.toLowerCase().includes(ql) || c.businessName?.toLowerCase().includes(ql)).slice(0, 6)
    : [];
  const matchingProducts = q
    ? products.filter((p) => p.name.toLowerCase().includes(ql) || p.sku?.toLowerCase().includes(ql)).slice(0, 5)
    : [];

  const go = (v: ViewKey) => {
    setView(v);
    closePalette(false);
  };

  return (
    <CommandDialog open={open} onOpenChange={closePalette}>
      <CommandInput placeholder="Search invoices, clients, products or jump to..." value={q} onValueChange={setQ} />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {q && (
          <CommandGroup heading="Quick action">
            <CommandItem
              onSelect={() => {
                const draft = editDraftInvoice();
                editInvoice(draft);
                closePalette(false);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Create new Tax Invoice
            </CommandItem>
          </CommandGroup>
        )}

        <CommandGroup heading="Navigate">
          {nav.map((n) => (
            <CommandItem key={n.key} onSelect={() => go(n.key)}>
              <n.icon className="mr-2 h-4 w-4" />
              {n.label}
            </CommandItem>
          ))}
        </CommandGroup>

        {matchingInvoices.length > 0 && (
          <CommandGroup heading="Invoices">
            {matchingInvoices.map((i) => (
              <CommandItem
                key={i.id}
                onSelect={() => {
                  openInvoice(i.id);
                  closePalette(false);
                }}
              >
                <FileText className="mr-2 h-4 w-4" />
                <span className="font-mono">{i.number}</span>
                <span className="ml-2 text-muted-foreground truncate">{i.clientSnapshot.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {matchingClients.length > 0 && (
          <CommandGroup heading="Clients">
            {matchingClients.map((c) => (
              <CommandItem
                key={c.id}
                onSelect={() => {
                  openClient(c.id);
                  closePalette(false);
                }}
              >
                <Users className="mr-2 h-4 w-4" />
                {c.name}
                {c.businessName && c.businessName !== c.name && (
                  <span className="ml-2 text-muted-foreground">({c.businessName})</span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {matchingProducts.length > 0 && (
          <CommandGroup heading="Products">
            {matchingProducts.map((p) => (
              <CommandItem key={p.id} onSelect={() => { go("products"); }}>
                <Package className="mr-2 h-4 w-4" />
                {p.name}
                <span className="ml-2 text-muted-foreground">₹{p.salePrice}/{p.unit}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
