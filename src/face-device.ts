export type FaceDevice = { id: string; privateKey: CryptoKey; publicKey: JsonWebKey; username?: string };
const database = "my-day-face-devices";

async function devices() {
  if (!window.isSecureContext || !window.indexedDB || !window.crypto?.subtle)
    throw Error("This browser cannot save a device key. You can keep using your password.");
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(database, 1);
    request.onupgradeneeded = () => request.result.createObjectStore("devices");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(Error("Could not open device storage. You can keep using your password."));
    request.onblocked = () => reject(Error("Close other My Day tabs and try again."));
  });
}

async function accessDevice(userId: string, value?: FaceDevice | null): Promise<FaceDevice | null> {
  const db = await devices();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction("devices", value === undefined ? "readonly" : "readwrite");
      const store = tx.objectStore("devices");
      const request = value === undefined ? store.get(userId) : value === null ? store.delete(userId) : store.put(value, userId);
      tx.oncomplete = () => resolve(value === undefined ? request.result ?? null : value);
      tx.onabort = tx.onerror = () => reject(Error("Could not save the device key. You can keep using your password."));
    });
  } finally { db.close(); }
}

export const readFaceDevice = (userId: string) => accessDevice(userId);
export const removeFaceDevice = (userId: string) => accessDevice(userId, null);
export async function nameFaceDevice(userId: string, username: string) {
  const device = await readFaceDevice(userId);
  if (device) await accessDevice(userId, { ...device, username });
}
export async function listFaceDevices(): Promise<{ userId: string; device: FaceDevice }[]> {
  const db = await devices();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction("devices", "readonly");
      const store = tx.objectStore("devices");
      const keys = store.getAllKeys(), values = store.getAll();
      tx.oncomplete = () => resolve(keys.result.map((key, index) => ({ userId: String(key), device: values.result[index] })));
      tx.onabort = tx.onerror = () => reject(Error("Could not read face sign-in settings."));
    });
  } finally { db.close(); }
}
export async function createFaceDevice(userId: string): Promise<FaceDevice> {
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, false, ["sign", "verify"]);
  const device = { id: crypto.randomUUID(), privateKey: pair.privateKey, publicKey: await crypto.subtle.exportKey("jwk", pair.publicKey) };
  await accessDevice(userId, device);
  return device;
}

export function faceCaptureMessage(challenge: string, hashes: string[]) {
  return `${challenge}\n${hashes.join("\n")}`;
}

export async function signFaceCapture(device: FaceDevice, challenge: string, frames: string[]) {
  const hashes = await Promise.all(frames.map(async (frame) => {
    const bytes = Uint8Array.from(atob(frame), (char) => char.charCodeAt(0));
    const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
    return Array.from(hash, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }));
  const signature = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" },
    device.privateKey, new TextEncoder().encode(faceCaptureMessage(challenge, hashes))));
  return btoa(String.fromCharCode(...signature));
}
