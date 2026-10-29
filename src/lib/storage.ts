// Folder-backed persistence for the standalone PWA.
// Priority: File System Access API > OPFS > download.
// Mirrors the upstream Node app's "data/ folder of JSON files" model so a
// user can copy the folder across to the desktop build.

import type { BackupBundle } from "./types";
import { exportBundle, importBundle } from "./db";

const BUNDLE_FILENAME = "kumar-billing-backup.json";

/** Feature detection — which folder strategy is available on this device? */
export function detectStorageMode(): "folder" | "opfs" | "manual" {
  if (typeof window !== "undefined" && "showDirectoryPicker" in window) return "folder";
  if (typeof navigator !== "undefined" && navigator.storage && "getDirectory" in navigator.storage) {
    return "opfs";
  }
  return "manual";
}

export function supportsFileSystemAccess(): boolean {
  return typeof window !== "undefined" && "showDirectoryPicker" in window;
}

export function supportsSaveFilePicker(): boolean {
  return typeof window !== "undefined" && "showSaveFilePicker" in window;
}

export function supportsOpfs(): boolean {
  return typeof navigator !== "undefined" && !!navigator.storage && "getDirectory" in navigator.storage;
}

// ---------- Folder mode (File System Access API) ----------
let chosenDir: any = null;

export async function pickFolder(): Promise<string | null> {
  if (!supportsFileSystemAccess()) return null;
  try {
    // @ts-ignore - showDirectoryPicker is not in TS DOM lib yet
    chosenDir = await window.showDirectoryPicker({ mode: "readwrite" });
    return chosenDir.name || "Selected folder";
  } catch (e) {
    // user cancelled
    return null;
  }
}

export async function writeBundleToFolder(bundle: BackupBundle): Promise<void> {
  if (!chosenDir) throw new Error("No folder chosen");
  const fileHandle = await chosenDir.getFileHandle(BUNDLE_FILENAME, { create: true });
  // @ts-ignore
  const writable = await fileHandle.createWritable();
  await writable.write(JSON.stringify(bundle, null, 2));
  await writable.close();
}

export async function readBundleFromFolder(): Promise<BackupBundle | null> {
  if (!chosenDir) return null;
  try {
    const fileHandle = await chosenDir.getFileHandle(BUNDLE_FILENAME);
    const file = await fileHandle.getFile();
    const text = await file.text();
    return JSON.parse(text) as BackupBundle;
  } catch {
    return null;
  }
}

// ---------- OPFS mode (Android / fallback) ----------
async function opfsRoot(): Promise<any> {
  // @ts-ignore
  return await navigator.storage.getDirectory();
}

export async function writeBundleToOpfs(bundle: BackupBundle): Promise<void> {
  if (!supportsOpfs()) throw new Error("OPFS not supported");
  const root = await opfsRoot();
  const fileHandle = await root.getFileHandle(BUNDLE_FILENAME, { create: true });
  // @ts-ignore
  const writable = await fileHandle.createWritable();
  await writable.write(JSON.stringify(bundle, null, 2));
  await writable.close();
}

export async function readBundleFromOpfs(): Promise<BackupBundle | null> {
  if (!supportsOpfs()) return null;
  try {
    const root = await opfsRoot();
    const fileHandle = await root.getFileHandle(BUNDLE_FILENAME);
    const file = await fileHandle.getFile();
    const text = await file.text();
    return JSON.parse(text) as BackupBundle;
  } catch {
    return null;
  }
}

// ---------- Manual download / upload (works everywhere) ----------
export async function downloadBundle(bundle: BackupBundle): Promise<void> {
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const stamp = new Date().toISOString().slice(0, 10);
  a.download = `kumar-billing-backup-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function pickBundleFile(): Promise<BackupBundle | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      try {
        const text = await file.text();
        resolve(JSON.parse(text) as BackupBundle);
      } catch {
        resolve(null);
      }
    };
    input.click();
  });
}

// ---------- High-level save / restore used by the UI ----------
export async function saveBackup(mode: "folder" | "opfs" | "manual"): Promise<{ ok: boolean; mode: string; message: string }> {
  const bundle = await exportBundle();
  try {
    if (mode === "folder" && chosenDir) {
      await writeBundleToFolder(bundle);
      return { ok: true, mode, message: `Saved to folder "${chosenDir.name}"` };
    }
    if (mode === "opfs" && supportsOpfs()) {
      await writeBundleToOpfs(bundle);
      // also offer a downloadable copy so the user has a human-findable file
      await downloadBundle(bundle);
      return { ok: true, mode, message: "Saved to device + downloaded a copy" };
    }
  } catch (e: any) {
    // fall through to download
    return { ok: false, mode, message: `Auto-save failed: ${e?.message}. Downloaded instead.` };
  }
  await downloadBundle(bundle);
  return { ok: true, mode: "manual", message: "Backup downloaded" };
}

export async function restoreBackup(mode: "folder" | "opfs" | "manual"): Promise<{ ok: boolean; message: string }> {
  let bundle: BackupBundle | null = null;
  if (mode === "folder" && chosenDir) bundle = await readBundleFromFolder();
  else if (mode === "opfs" && supportsOpfs()) bundle = await readBundleFromOpfs();
  if (!bundle) bundle = await pickBundleFile();
  if (!bundle) return { ok: false, message: "No backup selected" };
  await importBundle(bundle, "merge");
  return { ok: true, message: "Backup restored" };
}

export { exportBundle, importBundle };
