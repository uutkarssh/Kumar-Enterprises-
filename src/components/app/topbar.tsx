"use client";
import { useState } from "react";
import { useApp } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Menu, Search, Sun, Moon, Download, Bell, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { saveBackup } from "@/lib/storage";
import { applyTheme } from "@/lib/store";

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const settings = useApp((s) => s.settings);
  const setSettings = useApp((s) => s.setSettings);
  const setCommandOpen = useApp((s) => s.setCommandOpen);
  const installPromptEvent = useApp((s) => s.installPromptEvent);
  const setInstallPrompt = useApp((s) => s.setInstallPrompt);
  const reload = useApp((s) => s.reload);
  const [installing, setInstalling] = useState(false);

  const toggleTheme = () => {
    if (!settings) return;
    const next = settings.theme === "dark" ? "light" : "dark";
    const updated = { ...settings, theme: next };
    setSettings(updated);
    applyTheme(next);
    import("@/lib/db").then((m) => m.saveSettings(updated));
  };

  const handleInstall = async () => {
    if (!installPromptEvent) {
      toast.info("Install", {
        description: "Use your browser menu → 'Install app' / 'Add to Home Screen' to install Kumar Enterprises Billing.",
      });
      return;
    }
    setInstalling(true);
    try {
      installPromptEvent.prompt();
      await installPromptEvent.userChoice;
      setInstallPrompt(null);
    } finally {
      setInstalling(false);
    }
  };

  const quickBackup = async () => {
    if (!settings) return;
    const t = toast.loading("Saving backup...");
    const r = await saveBackup(settings.storageMode);
    toast.dismiss(t);
    if (r.ok) toast.success("Backup saved", { description: r.message });
    else toast.error("Backup issue", { description: r.message });
    await reload();
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-border bg-background/95 backdrop-blur px-3 sm:px-4">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenu}>
        <Menu className="h-5 w-5" />
      </Button>

      <button
        onClick={() => setCommandOpen(true)}
        className="hidden md:flex items-center gap-2 h-9 px-3 rounded-md border border-input bg-muted/50 text-sm text-muted-foreground hover:bg-muted w-64 lg:w-80"
      >
        <Search className="h-4 w-4" />
        <span>Search invoices, clients...</span>
        <kbd className="ml-auto rounded bg-background px-1.5 py-0.5 text-[10px] border">Ctrl K</kbd>
      </button>

      <div className="flex-1" />

      <Button
        size="sm"
        variant="outline"
        onClick={quickBackup}
        className="hidden sm:inline-flex"
        title="Quick backup"
      >
        <Download className="h-4 w-4 mr-1" /> Backup
      </Button>

      <Button
        size="sm"
        onClick={handleInstall}
        disabled={installing}
        className="bg-gold text-ink hover:bg-gold/90 hidden sm:inline-flex"
      >
        <Smartphone className="h-4 w-4 mr-1" />
        {installPromptEvent ? "Install App" : "Get App"}
      </Button>

      <Button variant="ghost" size="icon" onClick={toggleTheme} title="Toggle theme">
        {settings?.theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
      </Button>

      <Button variant="ghost" size="icon" className="relative" title="Notifications">
        <Bell className="h-5 w-5" />
        <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-gold" />
      </Button>
    </header>
  );
}
