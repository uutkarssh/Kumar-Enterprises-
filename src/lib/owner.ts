// Owner ID management — each installation gets a UUID "owner" that acts as
// the sync account. The 6-digit pairing code transfers this owner_id to a
// new device. Stored in IndexedDB `meta` table.

const OWNER_KEY = "ke_owner_id";
const DEVICE_LABEL_KEY = "ke_device_label";

export function getOwnerId(): string | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(OWNER_KEY);
}

export function setOwnerId(id: string): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(OWNER_KEY, id);
}

export function getDeviceLabel(): string {
  if (typeof localStorage === "undefined") return "Unknown device";
  return localStorage.getItem(DEVICE_LABEL_KEY) || detectDeviceLabel();
}

export function setDeviceLabel(label: string): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(DEVICE_LABEL_KEY, label);
}

export function ensureOwnerId(): string {
  let id = getOwnerId();
  if (!id) {
    id = crypto.randomUUID();
    setOwnerId(id);
  }
  return id;
}

export function clearOwnerId(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(OWNER_KEY);
}

function detectDeviceLabel(): string {
  if (typeof navigator === "undefined") return "Device";
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return "Android device";
  if (/iPhone|iPad|iPod/i.test(ua)) return "iOS device";
  if (/Mac/i.test(ua)) return "Mac";
  if (/Windows/i.test(ua)) return "Windows PC";
  if (/Linux/i.test(ua)) return "Linux PC";
  return "This device";
}

export function isPaired(): boolean {
  return getOwnerId() !== null;
}
