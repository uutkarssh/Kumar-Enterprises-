"use client";
import Link from "next/link";
import { useApp } from "@/lib/store";
import {
  LayoutDashboard,
  FileText,
  Users,
  Package,
  BarChart3,
  Settings,
  Database,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const NAV = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "invoices", label: "Invoices", icon: FileText },
  { key: "clients", label: "Clients", icon: Users },
  { key: "products", label: "Inventory", icon: Package },
  { key: "reports", label: "Reports & GST", icon: BarChart3 },
  { key: "settings", label: "Settings", icon: Settings },
  { key: "backup", label: "Backup & Restore", icon: Database },
  { key: "trash", label: "Trash Bin", icon: Trash2 },
] as const;

export function Sidebar({ onClose }: { onClose?: () => void }) {
  const view = useApp((s) => s.view);
  const setView = useApp((s) => s.setView);
  const settings = useApp((s) => s.settings);

  return (
    <aside className="flex h-full w-64 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
      <div className="flex items-center justify-between px-4 h-16 border-b border-sidebar-border bg-ink">
        <Link href="/" className="flex items-center gap-2">
          <img
            src="/icons/logo-wide.png"
            alt="Kumar Enterprises"
            className="h-9 w-auto"
          />
        </Link>
        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            className="text-sidebar-foreground hover:bg-sidebar-accent lg:hidden"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </Button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2 scrollbar-thin">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active =
            view === item.key ||
            (item.key === "invoices" && (view === "invoice-builder" || view === "invoice-preview")) ||
            (item.key === "clients" && view === "client-ledger");
          return (
            <button
              key={item.key}
              onClick={() => {
                setView(item.key as any);
                onClose?.();
              }}
              className={cn(
                "flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors mb-0.5",
                active
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-3 text-xs text-sidebar-foreground/60">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
          <span>Records saved on this device</span>
        </div>
        {settings?.storageMode === "folder" && (
          <div className="mt-1 truncate">Folder: {settings.folderName}</div>
        )}
        <div className="mt-2 text-[10px] uppercase tracking-wide text-gold">v1.0 · PWA</div>
      </div>
    </aside>
  );
}
