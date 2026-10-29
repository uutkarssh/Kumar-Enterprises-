"use client";
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
  RefreshCw, Smartphone, Link2, Cloud, CloudOff, Copy, Loader2, Wifi, WifiOff, Check, AlertCircle, QrCode,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  generatePairingCode,
  claimPairingCode,
  checkPairingHealth,
} from "@/lib/pairing";
import {
  setSyncOwner,
  isSyncActive,
  pullAll,
  pushAll,
  checkSupabaseHealth,
  disconnectSync,
} from "@/lib/sync";
import { ensureOwnerId, getOwnerId, setOwnerId, getDeviceLabel, isPaired } from "@/lib/owner";
import { listInvoices, listClients, listProducts, listPayments, listExpenses, getSettings } from "@/lib/db";
import { useApp } from "@/lib/store";

export function SyncTab() {
  const [paired, setPaired] = useState(false);
  const [health, setHealth] = useState<"checking" | "ok" | "down">("checking");
  const [healthMsg, setHealthMsg] = useState("");
  const [generating, setGenerating] = useState(false);
  const [pairCode, setPairCode] = useState("");
  const [claiming, setClaiming] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const reload = useApp((s) => s.reload);

  const refreshState = useCallback(() => {
    setPaired(isPaired());
    // Check Supabase health
    checkPairingHealth().then((r) => {
      setHealth(r.ok ? "ok" : "down");
      setHealthMsg(r.message);
    });
  }, []);

  useEffect(() => {
    refreshState();
  }, [refreshState]);

  // If already paired, initialize sync on mount
  useEffect(() => {
    const ownerId = getOwnerId();
    if (ownerId && health === "ok") {
      setSyncOwner(ownerId, () => {
        // Realtime change received — reload the store
        void reload();
      });
    }
  }, [health, reload]);

  // === First device: "Enable sync" (generates owner + uploads all local data) ===
  const enableSync = async () => {
    setSyncing(true);
    try {
      const ownerId = ensureOwnerId();
      // Upload all existing IndexedDB data to Supabase
      const [invoices, clients, products, payments, expenses, settings] = await Promise.all([
        listInvoices(true),
        listClients(true),
        listProducts(true),
        listPayments(true),
        listExpenses(true),
        getSettings(),
      ]);
      const result = await pushAll({ invoices, clients, products, payments, expenses, settings });
      // Start realtime
      setSyncOwner(ownerId, () => void reload());
      setPaired(true);
      toast.success("Sync enabled", {
        description: `${result.pushed} records uploaded. This device is now the sync source.`,
      });
    } catch (e: any) {
      toast.error("Failed to enable sync", { description: e?.message });
    } finally {
      setSyncing(false);
    }
  };

  // === Generate a 6-digit code for linking another device ===
  const generateCode = async () => {
    const ownerId = getOwnerId();
    if (!ownerId) {
      toast.error("Enable sync first");
      return;
    }
    setGenerating(true);
    try {
      const result = await generatePairingCode(ownerId);
      if ("error" in result) {
        toast.error("Failed to generate code", { description: result.error });
      } else {
        setPairCode(result.code);
        toast.success("Pairing code generated", {
          description: `Code "${result.code}" is valid for 10 minutes. Enter it on your other device.`,
        });
      }
    } finally {
      setGenerating(false);
    }
  };

  // === New device: claim a code and pull all data ===
  const [inputCode, setInputCode] = useState("");
  const claimAndPull = async () => {
    if (!inputCode.trim()) {
      toast.error("Enter a 6-character code");
      return;
    }
    setClaiming(true);
    try {
      const result = await claimPairingCode(inputCode);
      if ("error" in result) {
        toast.error("Pairing failed", { description: result.error });
        return;
      }
      // Code claimed — store the owner_id and pull all data
      setOwnerId(result.ownerId);
      setPaired(true);
      // Pull all data from Supabase → IndexedDB
      const data: any = await pullAll();
      // Write to IndexedDB
      const { importBundle } = await import("@/lib/db");
      await importBundle({
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        app: "Kumar Enterprises Billing",
        business: (data.settings?.[0] as any)?.business || {} as any,
        invoices: data.invoices || [],
        clients: data.clients || [],
        products: data.products || [],
        payments: data.payments || [],
        expenses: data.expenses || [],
        settings: (data.settings?.[0] as any) || {} as any,
      }, "merge");
      // Start realtime
      setSyncOwner(result.ownerId, () => void reload());
      await reload();
      setInputCode("");
      toast.success("Device linked!", {
        description: "All data has been synced to this device. Changes will now sync automatically.",
      });
    } catch (e: any) {
      toast.error("Failed to link device", { description: e?.message });
    } finally {
      setClaiming(false);
    }
  };

  const unpair = async () => {
    disconnectSync();
    setOwnerId("");
    setPaired(false);
    setPairCode("");
    toast.success("Sync disabled", {
      description: "This device now works standalone. Your data is still saved locally.",
    });
  };

  const copyCode = () => {
    if (pairCode) {
      navigator.clipboard.writeText(pairCode);
      toast.success("Code copied");
    }
  };

  // ---- Render ----
  return (
    <div className="space-y-4">
      {/* Health status banner */}
      <Card className={cn(
        "border-l-4",
        health === "ok" ? "border-l-emerald-500" :
        health === "down" ? "border-l-red-500" : "border-l-amber-500"
      )}>
        <CardContent className="p-4 flex items-center gap-3">
          {health === "checking" && <Loader2 className="h-5 w-5 animate-spin text-amber-500" />}
          {health === "ok" && <Wifi className="h-5 w-5 text-emerald-500" />}
          {health === "down" && <WifiOff className="h-5 w-5 text-red-500" />}
          <div className="flex-1">
            <div className="text-sm font-medium">
              {health === "checking" && "Checking Supabase connection..."}
              {health === "ok" && "Supabase is connected and ready"}
              {health === "down" && "Cannot connect to Supabase"}
            </div>
            <div className="text-xs text-muted-foreground">{healthMsg}</div>
          </div>
          <Button variant="ghost" size="sm" onClick={refreshState}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </CardContent>
      </Card>

      {health === "down" && (
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900">
          <CardContent className="p-4 text-sm">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-2">
                <p className="font-medium text-amber-900 dark:text-amber-200">Supabase setup needed</p>
                <p className="text-amber-800 dark:text-amber-300">
                  Your Supabase project may be <strong>paused</strong> (free tier auto-pauses after 7 days of inactivity)
                  or the sync tables haven&apos;t been created yet. To fix:
                </p>
                <ol className="list-decimal list-inside space-y-1 text-amber-800 dark:text-amber-300">
                  <li>Go to <a href="https://supabase.com/dashboard" target="_blank" rel="noopener" className="underline">supabase.com/dashboard</a> and restore your project if it&apos;s paused</li>
                  <li>Open <strong>SQL Editor</strong> → New query</li>
                  <li>Paste the contents of <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded">supabase/schema.sql</code> from the repo</li>
                  <li>Click <strong>Run</strong></li>
                  <li>Come back here and click the refresh button above</li>
                </ol>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Not paired: show enable + claim options */}
      {!paired ? (
        <>
          {/* Option A: This is the first device — enable sync */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Cloud className="h-4 w-4 text-gold" /> Enable Sync (First Device)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                If this is your first device, enable sync to upload your data to the cloud. Then generate a
                pairing code to link your phone or other devices.
              </p>
              <Button
                onClick={enableSync}
                disabled={syncing || health !== "ok"}
                className="bg-gold text-ink hover:bg-gold/90"
              >
                {syncing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Cloud className="h-4 w-4 mr-1" />}
                {syncing ? "Uploading data..." : "Enable Sync"}
              </Button>
            </CardContent>
          </Card>

          <Separator />

          {/* Option B: This is a new device — enter pairing code */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Link2 className="h-4 w-4 text-gold" /> Link This Device (Enter Code)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                If you already have data on another device, go to <strong>Settings → Sync</strong> on that device,
                generate a 6-character code, and enter it here to pull all your data.
              </p>
              <div>
                <Label>Pairing Code (6 characters)</Label>
                <div className="flex gap-2">
                  <Input
                    value={inputCode}
                    onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                    placeholder="e.g. K7M2XQ"
                    maxLength={6}
                    className="font-mono text-lg tracking-widest uppercase"
                  />
                  <Button
                    onClick={claimAndPull}
                    disabled={claiming || inputCode.length !== 6 || health !== "ok"}
                    className="bg-gold text-ink hover:bg-gold/90"
                  >
                    {claiming ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Link2 className="h-4 w-4 mr-1" />}
                    {claiming ? "Linking..." : "Link"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <>
          {/* Paired: show status + generate code + unpair */}
          <Card className="border-l-4 border-l-emerald-500">
            <CardContent className="p-4 flex items-center gap-3">
              <Check className="h-5 w-5 text-emerald-500" />
              <div className="flex-1">
                <div className="text-sm font-medium">Sync is active</div>
                <div className="text-xs text-muted-foreground">
                  This device ({getDeviceLabel()}) syncs automatically. Changes appear on all linked devices within seconds.
                </div>
              </div>
              <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                <Wifi className="h-3 w-3 mr-1" /> Online
              </Badge>
            </CardContent>
          </Card>

          {/* Generate pairing code */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-gold" /> Link Another Device
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Generate a one-time code to link your phone, tablet, or another PC. The code expires in 10 minutes.
              </p>
              {pairCode ? (
                <div className="rounded-lg border-2 border-dashed border-gold bg-accent p-4 text-center">
                  <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Your pairing code</div>
                  <div className="font-mono text-3xl font-bold tracking-[0.3em] text-ink">{pairCode}</div>
                  <div className="flex items-center justify-center gap-2 mt-3">
                    <Button size="sm" variant="outline" onClick={copyCode}>
                      <Copy className="h-3.5 w-3.5 mr-1" /> Copy
                    </Button>
                    <Button size="sm" variant="ghost" onClick={generateCode} disabled={generating}>
                      {generating ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
                      New code
                    </Button>
                  </div>
                  <div className="text-xs text-muted-foreground mt-2">
                    On your other device: open the app → Settings → Sync → &quot;Link This Device&quot; → enter this code
                  </div>
                </div>
              ) : (
                <Button onClick={generateCode} disabled={generating} className="bg-gold text-ink hover:bg-gold/90">
                  {generating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <QrCode className="h-4 w-4 mr-1" />}
                  Generate Pairing Code
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Unpair */}
          <Card className="border-red-200 dark:border-red-900">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2 text-red-600">
                <CloudOff className="h-4 w-4" /> Disable Sync
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Disconnects this device from cloud sync. Your data stays on this device (IndexedDB) and continues
                to work offline. Other linked devices are not affected.
              </p>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="text-red-600 border-red-300 hover:bg-red-50 dark:hover:bg-red-950">
                    <CloudOff className="h-4 w-4 mr-1" /> Disable Sync on This Device
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Disable sync?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This device will stop syncing with the cloud. Your data remains locally. You can re-enable
                      sync anytime by generating a new code from another device.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={unpair} className="bg-red-600 hover:bg-red-700">
                      Disable Sync
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
