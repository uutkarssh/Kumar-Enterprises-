"use client";
import { useState } from "react";
import { useApp } from "@/lib/store";
import { saveSettings } from "@/lib/db";
import { detectStorageMode, pickFolder } from "@/lib/storage";
import { seedClients, seedProducts, DEFAULT_SETTINGS } from "@/lib/defaults";
import { putClient, putProduct } from "@/lib/db";
import { INDIAN_STATES } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, ArrowLeft, FolderOpen, HardDrive, Download, Check, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const STEPS = ["Welcome", "Business Profile", "Storage", "Sample Data", "Ready"] as const;

export function SetupWizard() {
  const setSettings = useApp((s) => s.setSettings);
  const reload = useApp((s) => s.reload);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ ...DEFAULT_SETTINGS.business });
  const [storageMode, setStorageMode] = useState<"folder" | "opfs" | "manual">(detectStorageMode());
  const [folderName, setFolderName] = useState<string | null>(null);
  const [seedData, setSeedData] = useState(true);

  const upd = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const chooseFolder = async () => {
    const name = await pickFolder();
    if (name) {
      setFolderName(name);
      setStorageMode("folder");
      toast.success(`Folder selected: ${name}`);
    }
  };

  const finish = async () => {
    const settings: typeof DEFAULT_SETTINGS = {
      ...DEFAULT_SETTINGS,
      business: { ...form, logoDataUrl: "/icons/logo-wide.png" },
      storageMode,
      folderName: folderName || undefined,
      completedSetup: true,
      updatedAt: new Date().toISOString(),
    };
    await saveSettings(settings);
    if (seedData) {
      await Promise.all(seedClients().map(putClient));
      await Promise.all(seedProducts().map(putProduct));
    }
    setSettings(settings);
    await reload();
    toast.success("Welcome to Kumar Enterprises Billing!");
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="brand-gradient flex-shrink-0">
        <div className="max-w-3xl mx-auto px-6 pt-10 pb-8 text-center">
          <img src="/icons/logo-stacked.png" alt="Kumar Enterprises" className="h-28 w-28 mx-auto rounded-xl bg-white p-2 shadow-lg" />
          <h1 className="mt-6 text-3xl font-display text-white">Kumar Enterprises Billing</h1>
          <p className="mt-2 text-gold text-sm tracking-wide uppercase">GST Billing · Building-Material Agency</p>
        </div>
      </div>

      <div className="flex-1 flex items-start justify-center px-4 py-8">
        <Card className="w-full max-w-2xl shadow-xl border-border">
          <CardHeader className="border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">{STEPS[step]}</CardTitle>
              <div className="flex gap-1">
                {STEPS.map((_, i) => (
                  <span
                    key={i}
                    className={cn(
                      "h-1.5 w-6 rounded-full transition-colors",
                      i <= step ? "bg-gold" : "bg-muted"
                    )}
                  />
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            {step === 0 && (
              <div className="space-y-4">
                <div className="rounded-lg bg-accent p-4 text-sm text-accent-foreground">
                  <p className="font-medium">Your records stay on this device.</p>
                  <p className="mt-1 text-muted-foreground">
                    Kumar Enterprises Billing is a standalone PWA — invoices, clients and inventory are stored in
                    your browser (IndexedDB). You can also pick a folder so you always have your own copy of the data,
                    just like the desktop app&apos;s <code className="rounded bg-muted px-1">data/</code> folder.
                  </p>
                </div>
                <ul className="space-y-2 text-sm">
                  {[
                    "Create GST Tax Invoices, Proforma, Bill of Supply, Credit Notes, Delivery Challans",
                    "Special Non-GST Cash Memo for gitti (gravel) & balu (sand) sales",
                    "Per-customer ledger, inventory tracking, GSTR-1/3B reports",
                    "Installable on Android — works fully offline after first load",
                  ].map((t) => (
                    <li key={t} className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-gold mt-0.5 shrink-0" />
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {step === 1 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <Label>Business Name *</Label>
                  <Input value={form.name} onChange={(e) => upd("name", e.target.value)} placeholder="Kumar Enterprises" />
                </div>
                <div>
                  <Label>Legal Name</Label>
                  <Input value={form.legalName || ""} onChange={(e) => upd("legalName", e.target.value)} />
                </div>
                <div>
                  <Label>GSTIN</Label>
                  <Input value={form.gstin || ""} onChange={(e) => upd("gstin", e.target.value.toUpperCase())} placeholder="20ABCDE1234F1Z5" className="uppercase" />
                </div>
                <div>
                  <Label>PAN</Label>
                  <Input value={form.pan || ""} onChange={(e) => upd("pan", e.target.value.toUpperCase())} className="uppercase" />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input value={form.phone || ""} onChange={(e) => upd("phone", e.target.value)} />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input value={form.email || ""} onChange={(e) => upd("email", e.target.value)} />
                </div>
                <div className="sm:col-span-2">
                  <Label>Address</Label>
                  <Textarea value={form.address || ""} onChange={(e) => upd("address", e.target.value)} rows={2} />
                </div>
                <div>
                  <Label>City</Label>
                  <Input value={form.city || ""} onChange={(e) => upd("city", e.target.value)} />
                </div>
                <div>
                  <Label>State</Label>
                  <Select value={form.stateCode || ""} onValueChange={(v) => {
                    const st = INDIAN_STATES.find((s) => s.code === v);
                    setForm((f) => ({ ...f, stateCode: v, state: st?.name || f.state }));
                  }}>
                    <SelectTrigger><SelectValue placeholder="Select state" /></SelectTrigger>
                    <SelectContent>
                      {INDIAN_STATES.map((s) => (
                        <SelectItem key={s.code} value={s.code}>{s.name} ({s.code})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>UPI ID (for QR on invoices)</Label>
                  <Input value={form.upiId || ""} onChange={(e) => upd("upiId", e.target.value)} placeholder="kumar@upi" />
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Choose where to keep your backup copy. Records are always saved on this device — this is an
                  additional safety copy you can find in your file manager.
                </p>
                <StorageOption
                  active={storageMode === "folder"}
                  onClick={chooseFolder}
                  icon={FolderOpen}
                  title="Pick a folder"
                  desc={folderName ? `Selected: ${folderName}` : "Best on desktop Chrome/Edge. Writes a JSON backup straight to the folder you choose."}
                  badge="Recommended"
                />
                <StorageOption
                  active={storageMode === "opfs"}
                  onClick={() => setStorageMode("opfs")}
                  icon={HardDrive}
                  title="On-device storage (OPFS)"
                  desc="Best on Android. Saves to app-private storage and downloads a backup file you can find in Downloads."
                  badge="Android"
                />
                <StorageOption
                  active={storageMode === "manual"}
                  onClick={() => setStorageMode("manual")}
                  icon={Download}
                  title="Manual download only"
                  desc="You'll trigger backups yourself from the Backup screen. No automatic folder sync."
                />
                <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground flex items-start gap-2">
                  <Smartphone className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>
                    Tip: On Android, if &quot;Pick a folder&quot; isn&apos;t available, choose OPFS — it still gives you a
                    downloadable backup file. You can change this any time in Settings.
                  </span>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Load sample clients & products (cement, gitti, balu, bricks, steel) so you can explore the app right away?
                  You can delete them later from each screen.
                </p>
                <label className={cn(
                  "flex items-start gap-3 rounded-lg border p-4 cursor-pointer transition-colors",
                  seedData ? "border-gold bg-accent" : "border-border hover:bg-muted/50"
                )}>
                  <input
                    type="checkbox"
                    checked={seedData}
                    onChange={(e) => setSeedData(e.target.checked)}
                    className="mt-1 h-4 w-4 accent-[#f0a800]"
                  />
                  <div>
                    <div className="font-medium">Yes, load sample data</div>
                    <div className="text-sm text-muted-foreground">5 clients (incl. Suresh & Shree Constructions) + 12 building-material products</div>
                  </div>
                </label>
              </div>
            )}

            {step === 4 && (
              <div className="text-center py-6 space-y-3">
                <div className="mx-auto h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center">
                  <Check className="h-8 w-8 text-emerald-600" />
                </div>
                <h3 className="text-xl font-display">You&apos;re all set!</h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  Kumar Enterprises Billing is ready. Tap <strong>Finish</strong> to open your dashboard. You can
                  install the app to your home screen from the top bar anytime.
                </p>
              </div>
            )}
          </CardContent>

          <div className="flex items-center justify-between border-t p-4 bg-muted/30">
            <Button
              variant="ghost"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
            >
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
            {step < STEPS.length - 1 ? (
              <Button
                onClick={() => setStep((s) => s + 1)}
                disabled={step === 1 && !form.name}
                className="bg-gold text-ink hover:bg-gold/90"
              >
                Next <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={finish} className="bg-gold text-ink hover:bg-gold/90">
                <Check className="h-4 w-4 mr-1" /> Finish
              </Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function StorageOption({
  active,
  onClick,
  icon: Icon,
  title,
  desc,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  icon: any;
  title: string;
  desc: string;
  badge?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left rounded-lg border p-4 transition-colors flex items-start gap-3",
        active ? "border-gold bg-accent" : "border-border hover:bg-muted/50"
      )}
    >
      <div className={cn(
        "h-10 w-10 rounded-md flex items-center justify-center shrink-0",
        active ? "bg-gold text-ink" : "bg-muted"
      )}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium">{title}</span>
          {badge && <span className="text-[10px] uppercase tracking-wide bg-gold/20 text-accent-foreground px-1.5 py-0.5 rounded">{badge}</span>}
          {active && <Check className="h-4 w-4 text-gold ml-auto" />}
        </div>
        <div className="text-sm text-muted-foreground mt-0.5">{desc}</div>
      </div>
    </button>
  );
}
