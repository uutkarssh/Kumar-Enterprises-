"use client";
import { useState } from "react";
import { toast } from "sonner";
import { useApp } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  Download,
  Upload,
  Folder,
  HardDrive,
  FileJson,
  Database,
  ShieldAlert,
  Check,
  Loader2,
  Info,
} from "lucide-react";
import { saveSettings, clearAllData } from "@/lib/db";
import {
  pickFolder,
  saveBackup,
  restoreBackup,
  supportsFileSystemAccess,
  supportsOpfs,
} from "@/lib/storage";
import { cn } from "@/lib/utils";

export function BackupView() {
  const settings = useApp((s) => s.settings);
  const setSettings = useApp((s) => s.setSettings);
  const reload = useApp((s) => s.reload);

  const [busy, setBusy] = useState<"backup" | "restore" | "download" | null>(null);

  async function patchSettings(patch: Partial<NonNullable<typeof settings>>) {
    if (!settings) return;
    const next = { ...settings, ...patch, updatedAt: new Date().toISOString() };
    await saveSettings(next);
    setSettings(next);
  }

  async function chooseFolder() {
    const name = await pickFolder();
    if (!name) {
      toast("Folder selection cancelled");
      return;
    }
    await patchSettings({ storageMode: "folder", folderName: name });
    toast.success(`Folder "${name}" selected for backups`);
  }

  async function setMode(mode: "folder" | "opfs" | "manual") {
    await patchSettings({ storageMode: mode });
    toast.success(`Storage mode set to ${mode}`);
  }

  async function doBackup() {
    if (!settings) return;
    setBusy("backup");
    try {
      const res = await saveBackup(settings.storageMode);
      if (res.ok) toast.success(res.message);
      else toast.error(res.message);
      await reload();
    } finally {
      setBusy(null);
    }
  }

  async function doRestore() {
    if (!settings) return;
    setBusy("restore");
    try {
      const res = await restoreBackup(settings.storageMode);
      if (res.ok) toast.success(res.message);
      else toast.error(res.message);
      await reload();
    } finally {
      setBusy(null);
    }
  }

  async function downloadFile() {
    setBusy("download");
    try {
      const res = await saveBackup("manual");
      if (res.ok) toast.success(res.message);
      else toast.error(res.message);
      await reload();
    } finally {
      setBusy(null);
    }
  }

  async function eraseAll() {
    await clearAllData();
    await reload();
    toast.success("All data erased from this device");
  }

  const mode = settings?.storageMode || "manual";
  const folderName = settings?.folderName;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display">Backup &amp; Restore</h1>
        <p className="text-sm text-muted-foreground">
          Export a copy of all your records, or restore them on this device.
        </p>
      </div>

      {/* Explanation */}
      <Card className="bg-muted/30 border-dashed">
        <CardContent className="p-4 sm:p-5">
          <div className="flex gap-3">
            <Info className="h-5 w-5 text-gold shrink-0 mt-0.5" />
            <p className="text-sm text-muted-foreground leading-relaxed">
              Your records are always saved on this device (IndexedDB). This screen lets you export a
              backup copy you can keep in your own folder, email, or move to another device. The
              backup is a single JSON file containing all invoices, clients, products, payments,
              expenses, and settings — same schema as the desktop app&apos;s{" "}
              <code className="text-foreground">data/</code> folder.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Current storage mode */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-display flex items-center gap-2">
            <Database className="h-4 w-4 text-gold" /> Current Storage Mode
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-wrap items-center gap-3">
            <Badge className="bg-ink text-gold uppercase tracking-wide">{mode}</Badge>
            {folderName && (
              <span className="text-sm text-muted-foreground">
                Folder: <span className="text-foreground font-medium">{folderName}</span>
              </span>
            )}
            {!folderName && mode === "folder" && (
              <span className="text-xs text-muted-foreground">
                No folder picked yet — backups will download instead.
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Storage mode chooser */}
      <div>
        <h2 className="font-display text-sm mb-3">Choose where backups go</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <ModeCard
            icon={Folder}
            title="Folder"
            description="Pick a folder on this device — backups write to that folder automatically."
            active={mode === "folder"}
            disabled={!supportsFileSystemAccess()}
            disabledHint={supportsFileSystemAccess() ? undefined : "Not supported in this browser"}
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={chooseFolder}
                disabled={!supportsFileSystemAccess()}
              >
                <Folder className="h-4 w-4 mr-1" /> {folderName ? "Change folder" : "Choose folder"}
              </Button>
            }
          />
          <ModeCard
            icon={HardDrive}
            title="OPFS"
            description="Use the browser's private file system. Survives reloads, but stays in this browser."
            active={mode === "opfs"}
            disabled={!supportsOpfs()}
            disabledHint={supportsOpfs() ? undefined : "Not supported in this browser"}
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMode("opfs")}
                disabled={!supportsOpfs()}
              >
                Use OPFS
              </Button>
            }
          />
          <ModeCard
            icon={FileJson}
            title="Manual"
            description="Download a JSON file each time you back up. Works everywhere."
            active={mode === "manual"}
            action={
              <Button variant="outline" size="sm" onClick={() => setMode("manual")}>
                Use manual
              </Button>
            }
          />
        </div>
      </div>

      <Separator />

      {/* Backup / Restore actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-gold/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-display flex items-center gap-2">
              <Download className="h-4 w-4 text-gold" /> Backup Now
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            <p className="text-sm text-muted-foreground">
              Write a fresh backup to the selected storage mode ({mode}). Folder mode writes the file
              silently; OPFS and Manual also download a copy.
            </p>
            <Button
              className="bg-gold text-ink hover:bg-gold/90 w-full"
              size="lg"
              onClick={doBackup}
              disabled={busy !== null}
            >
              {busy === "backup" ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-1" />
              )}
              Backup now
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-display flex items-center gap-2">
              <Upload className="h-4 w-4 text-gold" /> Restore from Backup
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            <p className="text-sm text-muted-foreground">
              Merge a backup into this device. Existing records with the same ID are overwritten;
              everything else is kept.
            </p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="w-full" disabled={busy !== null}>
                  {busy === "restore" ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4 mr-1" />
                  )}
                  Restore from backup
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Restore backup?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This merges the backup into your current data. Records with the same ID will be
                    replaced. Consider taking a fresh backup first. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-gold text-ink hover:bg-gold/90"
                    onClick={doRestore}
                  >
                    Restore
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-display">Download a Backup File</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          <p className="text-sm text-muted-foreground">
            Always available — downloads a timestamped JSON file regardless of storage mode. Handy
            for emailing or moving to another device.
          </p>
          <Button variant="outline" onClick={downloadFile} disabled={busy !== null}>
            {busy === "download" ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <FileJson className="h-4 w-4 mr-1" />
            )}
            Download backup file
          </Button>
        </CardContent>
      </Card>

      <Separator />

      {/* Auto-backup settings */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-display">Auto-backup</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-4">
          <div className="flex items-center justify-between gap-3 rounded-md border p-3">
            <div>
              <div className="text-sm font-medium">Enable auto-backup</div>
              <div className="text-xs text-muted-foreground">
                Periodically write a backup to the selected storage mode.
              </div>
            </div>
            <Switch
              checked={settings?.autoBackup ?? false}
              onCheckedChange={(v) => patchSettings({ autoBackup: v })}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Backup interval (invoice count)</Label>
              <Input
                type="number"
                min={1}
                value={settings?.backupInterval ?? 20}
                onChange={(e) =>
                  patchSettings({ backupInterval: parseInt(e.target.value || "20", 10) })
                }
              />
              <p className="text-[11px] text-muted-foreground">
                A backup is suggested after this many new invoices.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Last backup</Label>
              <div className="text-sm text-muted-foreground py-2">
                Backup not yet automated in this preview.
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Danger zone */}
      <Card className="border-destructive/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-display flex items-center gap-2 text-destructive">
            <ShieldAlert className="h-4 w-4" /> Danger Zone
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-md border border-destructive/30 bg-destructive/5">
            <div>
              <div className="font-medium text-sm">Erase all data on this device</div>
              <div className="text-xs text-muted-foreground">
                Permanently removes every invoice, client, product, payment and expense. Settings are
                preserved. Cannot be undone.
              </div>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">Erase everything</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Erase all data on this device?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Every invoice, client, product, payment and expense will be permanently deleted
                    from this browser. Make sure you have a backup first. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-white hover:bg-destructive/90"
                    onClick={eraseAll}
                  >
                    Yes, erase everything
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================
// Mode card
// ============================================================
function ModeCard({
  icon: Icon,
  title,
  description,
  active,
  disabled,
  disabledHint,
  action,
}: {
  icon: any;
  title: string;
  description: string;
  active: boolean;
  disabled?: boolean;
  disabledHint?: string;
  action: React.ReactNode;
}) {
  return (
    <Card className={cn("relative", active && "border-gold gold-glow")}>
      <CardContent className="p-4 sm:p-5 space-y-3">
        <div className="flex items-start justify-between">
          <div className="h-9 w-9 rounded-md bg-gold/15 text-gold flex items-center justify-center">
            <Icon className="h-4 w-4" />
          </div>
          {active && (
            <Badge className="bg-gold text-ink">
              <Check className="h-3 w-3 mr-1" /> Active
            </Badge>
          )}
        </div>
        <div>
          <div className="font-display text-sm">{title}</div>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{description}</p>
          {disabled && disabledHint && (
            <p className="text-[11px] text-amber-600 mt-1">{disabledHint}</p>
          )}
        </div>
        <div className={cn(disabled && "pointer-events-none opacity-50")}>{action}</div>
      </CardContent>
    </Card>
  );
}
