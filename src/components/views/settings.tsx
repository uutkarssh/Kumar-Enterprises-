"use client";
import { useState } from "react";
import { toast } from "sonner";
import { useApp, applyTheme } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Save,
  Building2,
  FileText,
  Palette,
  Info,
  Trash2,
  Check,
  Sun,
  Moon,
  ShieldAlert,
  RefreshCw,
  Smartphone,
  Link2,
  Cloud,
  CloudOff,
  Copy,
  Loader2,
  Wifi,
  WifiOff,
} from "lucide-react";
import { DESIGN_PRESETS } from "@/lib/defaults";
import { INDIAN_STATES, type AppSettings, type BusinessProfile, type InvoicePrefs, type TaxType } from "@/lib/types";
import { saveSettings, clearAllData } from "@/lib/db";
import { validateGstin, validatePan } from "@/lib/gst";
import { cn } from "@/lib/utils";
import { SyncTab } from "@/components/app/sync-tab";

export function SettingsView() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Business profile, invoice defaults, theme and device data.
        </p>
      </div>

      <Tabs defaultValue="business" className="w-full">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="business">
            <Building2 className="h-3.5 w-3.5 mr-1" /> Business Profile
          </TabsTrigger>
          <TabsTrigger value="invoice">
            <FileText className="h-3.5 w-3.5 mr-1" /> Invoice Preferences
          </TabsTrigger>
          <TabsTrigger value="appearance">
            <Palette className="h-3.5 w-3.5 mr-1" /> Appearance
          </TabsTrigger>
          <TabsTrigger value="sync">
            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Sync & Devices
          </TabsTrigger>
          <TabsTrigger value="about">
            <Info className="h-3.5 w-3.5 mr-1" /> About
          </TabsTrigger>
        </TabsList>

        <TabsContent value="business">
          <BusinessTab />
        </TabsContent>
        <TabsContent value="invoice">
          <InvoiceTab />
        </TabsContent>
        <TabsContent value="appearance">
          <AppearanceTab />
        </TabsContent>
        <TabsContent value="sync">
          <SyncTab />
        </TabsContent>
        <TabsContent value="about">
          <AboutTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================
// Helper — persist a partial settings update
// ============================================================
function usePersist() {
  const settings = useApp((s) => s.settings);
  const setSettings = useApp((s) => s.setSettings);
  const reload = useApp((s) => s.reload);

  return async (patch: Partial<AppSettings>) => {
    if (!settings) return;
    const next: AppSettings = { ...settings, ...patch, updatedAt: new Date().toISOString() };
    await saveSettings(next);
    setSettings(next);
    toast.success("Settings saved");
  };
}

// ============================================================
// Business Profile
// ============================================================
function BusinessTab() {
  const settings = useApp((s) => s.settings);
  const persist = usePersist();
  const [form, setForm] = useState<BusinessProfile>(
    () => settings?.business || ({} as BusinessProfile)
  );

  function set<K extends keyof BusinessProfile>(key: K, val: BusinessProfile[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  const gstinValid = validateGstin(form.gstin || "");
  const panValid = validatePan(form.pan || "");

  async function save() {
    await persist({ business: { ...form, gstin: (form.gstin || "").toUpperCase(), pan: (form.pan || "").toUpperCase() } });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-display">Business Profile</CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-6">
        {/* Logo preview */}
        <div className="flex items-center gap-4">
          <div className="h-16 w-40 rounded-md bg-ink flex items-center justify-center overflow-hidden">
            <img
              src={form.logoDataUrl || "/icons/logo-wide.png"}
              alt="Business logo"
              className="max-h-full max-w-full object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "/icons/logo-wide.png";
              }}
            />
          </div>
          <div className="text-xs text-muted-foreground">
            Logo is shown on every PDF invoice. Replace the file at{" "}
            <code className="text-foreground">public/icons/logo-wide.png</code> to update.
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Business Name" required>
            <Input value={form.name || ""} onChange={(e) => set("name", e.target.value)} />
          </Field>
          <Field label="Legal Name">
            <Input value={form.legalName || ""} onChange={(e) => set("legalName", e.target.value)} />
          </Field>
          <Field label="GSTIN" hint={!gstinValid && form.gstin ? "Invalid GSTIN format" : "Uppercase, 15 chars"}>
            <Input
              value={form.gstin || ""}
              onChange={(e) => set("gstin", e.target.value.toUpperCase())}
              placeholder="20ABCDE1234F1Z5"
              className={!gstinValid && form.gstin ? "border-destructive" : ""}
              maxLength={15}
            />
          </Field>
          <Field label="PAN" hint={!panValid && form.pan ? "Invalid PAN format" : ""}>
            <Input
              value={form.pan || ""}
              onChange={(e) => set("pan", e.target.value.toUpperCase())}
              placeholder="ABCDE1234F"
              className={!panValid && form.pan ? "border-destructive" : ""}
              maxLength={10}
            />
          </Field>
          <Field label="Phone">
            <Input value={form.phone || ""} onChange={(e) => set("phone", e.target.value)} placeholder="9876543210" />
          </Field>
          <Field label="Email">
            <Input type="email" value={form.email || ""} onChange={(e) => set("email", e.target.value)} />
          </Field>
        </div>

        <Field label="Address">
          <Textarea rows={2} value={form.address || ""} onChange={(e) => set("address", e.target.value)} />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="City">
            <Input value={form.city || ""} onChange={(e) => set("city", e.target.value)} />
          </Field>
          <Field label="State" hint="Sets state code automatically">
            <Select
              value={form.stateCode || ""}
              onValueChange={(code) => {
                const st = INDIAN_STATES.find((s) => s.code === code);
                if (st) {
                  setForm((f) => ({ ...f, stateCode: st.code, state: st.name }));
                }
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select state" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {INDIAN_STATES.map((s) => (
                  <SelectItem key={s.code} value={s.code}>
                    {s.code} · {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <Separator />

        <div>
          <h3 className="font-display text-sm mb-3">Bank Details</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Bank Name">
              <Input value={form.bankName || ""} onChange={(e) => set("bankName", e.target.value)} />
            </Field>
            <Field label="Account Number">
              <Input value={form.accountNo || ""} onChange={(e) => set("accountNo", e.target.value)} />
            </Field>
            <Field label="IFSC">
              <Input
                value={form.ifsc || ""}
                onChange={(e) => set("ifsc", e.target.value.toUpperCase())}
                placeholder="HDFC0001234"
              />
            </Field>
            <Field label="Branch">
              <Input value={form.branch || ""} onChange={(e) => set("branch", e.target.value)} />
            </Field>
            <Field label="UPI ID">
              <Input value={form.upiId || ""} onChange={(e) => set("upiId", e.target.value)} placeholder="kumar@upi" />
            </Field>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button className="bg-gold text-ink hover:bg-gold/90" onClick={save}>
            <Save className="h-4 w-4 mr-1" /> Save Business Profile
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// Invoice Preferences
// ============================================================
function InvoiceTab() {
  const settings = useApp((s) => s.settings);
  const persist = usePersist();
  const [form, setForm] = useState<InvoicePrefs>(
    () => settings?.invoice || ({} as InvoicePrefs)
  );

  function set<K extends keyof InvoicePrefs>(key: K, val: InvoicePrefs[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function save() {
    await persist({ invoice: form });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-display">Invoice Preferences</CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Invoice Prefix">
            <Input value={form.prefix} onChange={(e) => set("prefix", e.target.value)} placeholder="INV" />
          </Field>
          <Field label="Number Padding" hint="Number of digits in the serial (4 = 0001)">
            <Input
              type="number"
              min={1}
              max={8}
              value={form.numberPadding}
              onChange={(e) => set("numberPadding", parseInt(e.target.value || "4", 10))}
            />
          </Field>
          <Field label="Default Tax Type">
            <Select
              value={form.defaultTaxType}
              onValueChange={(v) => set("defaultTaxType", v as TaxType)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="intra">Intra-state (CGST + SGST)</SelectItem>
                <SelectItem value="inter">Inter-state (IGST)</SelectItem>
                <SelectItem value="exempt">Exempt (no GST)</SelectItem>
                <SelectItem value="zero">Zero-rated (0%)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Default Currency">
            <Input value={form.defaultCurrency} onChange={(e) => set("defaultCurrency", e.target.value)} />
          </Field>
          <Field label="Print Style">
            <Select value={form.printStyle} onValueChange={(v) => set("printStyle", v as InvoicePrefs["printStyle"])}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="classic">Classic</SelectItem>
                <SelectItem value="modern">Modern</SelectItem>
                <SelectItem value="compact">Compact</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>

        <div className="space-y-3">
          <ToggleRow
            label="Reset invoice numbers every year"
            description="Restart from 0001 on 1st January"
            checked={form.resetYearly}
            onCheckedChange={(v) => set("resetYearly", v)}
          />
          <ToggleRow
            label="Enable UPI QR code on invoices"
            description="Show a payable QR if balance is due and UPI ID is set"
            checked={form.enableUpiQr}
            onCheckedChange={(v) => set("enableUpiQr", v)}
          />
          <ToggleRow
            label="Enable round-off"
            description="Round grand total to nearest rupee"
            checked={form.enableRoundOff}
            onCheckedChange={(v) => set("enableRoundOff", v)}
          />
        </div>

        <Field label="Default Terms & Conditions">
          <Textarea rows={4} value={form.defaultTerms} onChange={(e) => set("defaultTerms", e.target.value)} />
        </Field>
        <Field label="Default Notes">
          <Textarea rows={2} value={form.defaultNotes} onChange={(e) => set("defaultNotes", e.target.value)} />
        </Field>

        <div className="flex justify-end pt-2">
          <Button className="bg-gold text-ink hover:bg-gold/90" onClick={save}>
            <Save className="h-4 w-4 mr-1" /> Save Invoice Preferences
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// Appearance
// ============================================================
function AppearanceTab() {
  const settings = useApp((s) => s.settings);
  const persist = usePersist();
  const [theme, setTheme] = useState<"light" | "dark">(() => settings?.theme || "light");
  const [preset, setPreset] = useState<string>(() => settings?.preset || "kumar-gold");

  function pickPreset(id: string) {
    const p = DESIGN_PRESETS.find((x) => x.id === id);
    if (!p) return;
    setPreset(id);
    if (typeof document !== "undefined") {
      document.documentElement.style.setProperty("--gold", p.primary);
    }
  }

  function pickTheme(t: "light" | "dark") {
    setTheme(t);
    applyTheme(t);
  }

  async function save() {
    await persist({ theme, preset });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-display">Appearance</CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-6">
        <div>
          <h3 className="font-display text-sm mb-2">Theme</h3>
          <div className="flex gap-2">
            <Button
              variant={theme === "light" ? "default" : "outline"}
              onClick={() => pickTheme("light")}
              className={theme === "light" ? "bg-gold text-ink hover:bg-gold/90" : ""}
            >
              <Sun className="h-4 w-4 mr-1" /> Light
            </Button>
            <Button
              variant={theme === "dark" ? "default" : "outline"}
              onClick={() => pickTheme("dark")}
              className={theme === "dark" ? "bg-gold text-ink hover:bg-gold/90" : ""}
            >
              <Moon className="h-4 w-4 mr-1" /> Dark
            </Button>
          </div>
        </div>

        <Separator />

        <div>
          <h3 className="font-display text-sm mb-3">Color Preset</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {DESIGN_PRESETS.map((p) => {
              const active = p.id === preset;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => pickPreset(p.id)}
                  className={cn(
                    "rounded-lg border p-3 text-left transition-all hover:border-gold hover:shadow-sm",
                    active ? "border-gold gold-glow" : "border-border"
                  )}
                >
                  <div
                    className="h-10 w-full rounded-md mb-2"
                    style={{ backgroundColor: p.primary }}
                  />
                  <div className="text-xs font-medium flex items-center justify-between">
                    {p.name}
                    {active && <Check className="h-3 w-3 text-gold" />}
                  </div>
                  <div className="text-[10px] text-muted-foreground font-mono">{p.primary}</div>
                </button>
              );
            })}
          </div>
        </div>

        <Separator />

        <div>
          <h3 className="font-display text-sm mb-2">Live Preview</h3>
          <div className="flex flex-wrap items-center gap-3 p-4 rounded-md border bg-muted/30">
            <Button className="bg-gold text-ink hover:bg-gold/90">Primary button</Button>
            <Button variant="outline">Secondary</Button>
            <Badge className="bg-ink text-gold">Badge</Badge>
            <span className="text-sm">Sample text in foreground color</span>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button className="bg-gold text-ink hover:bg-gold/90" onClick={save}>
            <Save className="h-4 w-4 mr-1" /> Save Appearance
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// About
// ============================================================
function AboutTab() {
  const reload = useApp((s) => s.reload);

  async function resetAll() {
    await clearAllData();
    await reload();
    toast.success("All data erased from this device");
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-display">About Kumar Enterprises Billing</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-3 text-sm">
          <Row label="App Name" value="Kumar Enterprises Billing" />
          <Row label="Version" value="1.0.0" />
          <Row label="Build" value="Standalone PWA" />
          <Separator />
          <div>
            <h3 className="font-display text-sm mb-1">Architecture</h3>
            <p className="text-muted-foreground leading-relaxed">
              Standalone PWA — records are stored on this device via IndexedDB. Optional folder/OPFS
              backup. No server required. The backup is a single JSON file with the same schema as
              the desktop app&apos;s <code className="text-foreground">data/</code> folder, so a folder
              export is interchangeable with the desktop build.
            </p>
          </div>
          <Separator />
          <div>
            <h3 className="font-display text-sm mb-1">Credits</h3>
            <p className="text-muted-foreground">
              Built with Next.js 16, TypeScript, Tailwind CSS 4, shadcn/ui, Recharts and jsPDF.
              Crafted for Indian building-material dealers under the GST regime.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-destructive/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-display flex items-center gap-2 text-destructive">
            <ShieldAlert className="h-4 w-4" /> Danger Zone
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-md border border-destructive/30 bg-destructive/5">
            <div>
              <div className="font-medium text-sm">Reset all data on this device</div>
              <div className="text-xs text-muted-foreground">
                Removes all invoices, clients, products, payments and expenses. This cannot be undone.
              </div>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">
                  <Trash2 className="h-4 w-4 mr-1" /> Reset All Data
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Erase everything?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently deletes every invoice, client, product, payment and expense on
                    this device. Make sure you have a backup. Settings will be preserved. This action
                    cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-white hover:bg-destructive/90"
                    onClick={resetAll}
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
// Small shared bits
// ============================================================
function Field({
  label,
  children,
  hint,
  required,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border p-3">
      <div>
        <div className="text-sm font-medium">{label}</div>
        {description && <div className="text-xs text-muted-foreground">{description}</div>}
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
