import { SavedContent } from "../types";
import { normalizeSavedItem } from "./api";

const DB_NAME = "mindshelf-library";
const STORE_NAME = "snapshots";
const SNAPSHOT_KEY = "saved-items";
const LEGACY_STORAGE_KEY = "mindshelf_items";

export type StorageMode = "indexeddb" | "localstorage";

interface SnapshotRecord {
  key: string;
  items: SavedContent[];
  updatedAt: number;
}

interface StorageLoadResult {
  items: SavedContent[];
  mode: StorageMode;
  migrated: boolean;
}

interface StorageSaveResult {
  mode: StorageMode;
}

function readLegacyItems() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(LEGACY_STORAGE_KEY);

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as SavedContent[];
    return parsed.map(normalizeSavedItem);
  } catch {
    return [];
  }
}

function buildBackupItems(items: SavedContent[]) {
  return items.map((item) => ({
    ...item,
    image: item.originalImage || item.image,
  }));
}

function writeLegacyBackup(items: SavedContent[]) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(buildBackupItems(items)));
  } catch {
    // Ignore backup failures; IndexedDB remains the primary storage layer.
  }
}

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function readIndexedDbItems() {
  return new Promise<SavedContent[]>(async (resolve, reject) => {
    try {
      const database = await openDatabase();
      const transaction = database.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(SNAPSHOT_KEY);

      request.onsuccess = () => {
        const result = request.result as SnapshotRecord | undefined;
        resolve((result?.items || []).map(normalizeSavedItem));
      };
      request.onerror = () => reject(request.error);
      transaction.oncomplete = () => database.close();
      transaction.onerror = () => reject(transaction.error);
    } catch (error) {
      reject(error);
    }
  });
}

function writeIndexedDbItems(items: SavedContent[]) {
  return new Promise<void>(async (resolve, reject) => {
    try {
      const database = await openDatabase();
      const transaction = database.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const record: SnapshotRecord = {
        key: SNAPSHOT_KEY,
        items,
        updatedAt: Date.now(),
      };

      store.put(record);
      transaction.oncomplete = () => {
        database.close();
        resolve();
      };
      transaction.onerror = () => reject(transaction.error);
    } catch (error) {
      reject(error);
    }
  });
}

export async function loadSavedItems(): Promise<StorageLoadResult> {
  if (typeof window === "undefined" || typeof window.indexedDB === "undefined") {
    return {
      items: readLegacyItems(),
      mode: "localstorage",
      migrated: false,
    };
  }

  try {
    const indexedDbItems = await readIndexedDbItems();

    if (indexedDbItems.length > 0) {
      return {
        items: indexedDbItems,
        mode: "indexeddb",
        migrated: false,
      };
    }

    const legacyItems = readLegacyItems();

    if (legacyItems.length > 0) {
      await writeIndexedDbItems(legacyItems);
      writeLegacyBackup(legacyItems);

      return {
        items: legacyItems,
        mode: "indexeddb",
        migrated: true,
      };
    }

    return {
      items: [],
      mode: "indexeddb",
      migrated: false,
    };
  } catch {
    return {
      items: readLegacyItems(),
      mode: "localstorage",
      migrated: false,
    };
  }
}

export async function saveSavedItems(items: SavedContent[]): Promise<StorageSaveResult> {
  const normalizedItems = items.map(normalizeSavedItem);

  if (typeof window === "undefined" || typeof window.indexedDB === "undefined") {
    writeLegacyBackup(normalizedItems);
    return { mode: "localstorage" };
  }

  try {
    await writeIndexedDbItems(normalizedItems);
    writeLegacyBackup(normalizedItems);
    return { mode: "indexeddb" };
  } catch {
    writeLegacyBackup(normalizedItems);
    return { mode: "localstorage" };
  }
}
