import { createStore, del, get, set } from "idb-keyval";
import type { StateStorage } from "zustand/middleware";

/**
 * zustand StateStorage backed by IndexedDB, with every value encrypted using
 * AES-GCM. The key is a non-extractable CryptoKey kept in IndexedDB, so the
 * raw key material can't be read by page scripts or exported from devtools.
 * Falls back to in-memory storage when IndexedDB/WebCrypto are unavailable
 * (e.g. private browsing on some browsers).
 */

interface Sealed {
  iv: Uint8Array<ArrayBuffer>;
  data: ArrayBuffer;
}

const memory = new Map<string, string>();
const db = typeof indexedDB !== "undefined" ? createStore("scamshield", "vault") : null;
let keyPromise: Promise<CryptoKey> | null = null;

function getKey(): Promise<CryptoKey> {
  keyPromise ??= (async () => {
    const existing = await get<CryptoKey>("__key", db!);
    if (existing) return existing;
    const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
    await set("__key", key, db!);
    return key;
  })();
  return keyPromise;
}

async function available(): Promise<boolean> {
  if (!db || !globalThis.crypto?.subtle) return false;
  try {
    await getKey();
    return true;
  } catch {
    return false;
  }
}

export const secureStorage: StateStorage = {
  async getItem(name) {
    if (!(await available())) return memory.get(name) ?? null;
    const sealed = await get<Sealed>(name, db!);
    if (!sealed) return null;
    try {
      const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: sealed.iv }, await getKey(), sealed.data);
      return new TextDecoder().decode(plain);
    } catch {
      return null; // key rotated or data corrupted — start fresh
    }
  },
  async setItem(name, value) {
    if (!(await available())) {
      memory.set(name, value);
      return;
    }
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await getKey(), new TextEncoder().encode(value));
    await set(name, { iv, data } satisfies Sealed, db!);
  },
  async removeItem(name) {
    memory.delete(name);
    if (db) await del(name, db);
  },
};
