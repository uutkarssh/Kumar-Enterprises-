"use client";
import { useEffect, useState, useCallback } from "react";
import { useApp, applyTheme, registerRefresh } from "@/lib/store";
import { getSettings, saveSettings, listInvoices, listClients, listProducts, listPayments, listExpenses } from "@/lib/db";
import { Sidebar } from "@/components/app/sidebar";
import { Topbar } from "@/components/app/topbar";
import { CommandPalette } from "@/components/app/command-palette";
import { SetupWizard } from "@/components/app/setup-wizard";
import { DashboardView } from "@/components/views/dashboard";
import { InvoicesView } from "@/components/views/invoices";
import { InvoiceBuilderView } from "@/components/views/invoice-builder";
import { InvoicePreviewView } from "@/components/views/invoice-preview";
import { ClientsView } from "@/components/views/clients";
import { ClientLedgerView } from "@/components/views/client-ledger";
import { ProductsView } from "@/components/views/products";
import { ReportsView } from "@/components/views/reports";
import { SettingsView } from "@/components/views/settings";
import { BackupView } from "@/components/views/backup";
import { TrashView } from "@/components/views/trash";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Database } from "lucide-react";

export default function Page() {
  const [booted, setBooted] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const loaded = useApp((s) => s.loaded);
  const setData = useApp((s) => s.setData);
  const settings = useApp((s) => s.settings);
  const view = useApp((s) => s.view);
  const setInstallPrompt = useApp((s) => s.setInstallPrompt);

  const refresh = useCallback(async () => {
    const [s, invoices, clients, products, payments, expenses] = await Promise.all([
      getSettings(),
      listInvoices(),
      listClients(),
      listProducts(),
      listPayments(),
      listExpenses(),
    ]);
    setData({ settings: s, invoices, clients, products, payments, expenses });
    applyTheme(s.theme);
  }, [setData]);

  useEffect(() => {
    registerRefresh(refresh);
    refresh().finally(() => setBooted(true));
  }, [refresh]);

  // PWA install prompt capture + service worker registration
  useEffect(() => {
    const onBeforeInstall = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    const onInstalled = () => {
      setInstallPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);

    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker.register("/sw.js").catch(() => {
          // SW registration is best-effort; app still works without it.
        });
      });
    }
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [setInstallPrompt]);

  if (!booted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <img src="/icons/logo-square.png" alt="Kumar Enterprises" className="h-20 w-20 mx-auto rounded-xl animate-pulse" />
          <p className="mt-4 text-sm text-muted-foreground">Loading Kumar Enterprises Billing...</p>
        </div>
      </div>
    );
  }

  // First-run setup
  if (settings && !settings.completedSetup) {
    return <SetupWizard />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="flex flex-1 min-h-0">
        {/* Desktop sidebar */}
        <div className="hidden lg:block flex-shrink-0">
          <Sidebar />
        </div>

        {/* Mobile sidebar (sheet) */}
        <Sheet open={mobileNav} onOpenChange={setMobileNav}>
          <SheetContent side="left" className="p-0 w-64">
            <Sidebar onClose={() => setMobileNav(false)} />
          </SheetContent>
        </Sheet>

        {/* Main */}
        <div className="flex-1 flex flex-col min-w-0">
          <Topbar onMenu={() => setMobileNav(true)} />
          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-7xl p-4 sm:p-6">
              {view === "dashboard" && <DashboardView />}
              {view === "invoices" && <InvoicesView />}
              {view === "invoice-builder" && <InvoiceBuilderView />}
              {view === "invoice-preview" && <InvoicePreviewView />}
              {view === "clients" && <ClientsView />}
              {view === "client-ledger" && <ClientLedgerView />}
              {view === "products" && <ProductsView />}
              {view === "reports" && <ReportsView />}
              {view === "settings" && <SettingsView />}
              {view === "backup" && <BackupView />}
              {view === "trash" && <TrashView />}
            </div>
          </main>
        </div>
      </div>

      <footer className="mt-auto bg-ink text-white/80 text-xs">
        <div className="mx-auto max-w-7xl px-4 py-2.5 flex flex-col sm:flex-row items-center justify-between gap-1.5">
          <div className="flex items-center gap-2">
            <Database className="h-3.5 w-3.5 text-gold" />
            <span>Kumar Enterprises Billing — records stored on this device (IndexedDB + OPFS/folder backup). No server required.</span>
          </div>
          <div className="text-white/50">GST Billing PWA · v1.0</div>
        </div>
      </footer>

      <CommandPalette />
    </div>
  );
}
