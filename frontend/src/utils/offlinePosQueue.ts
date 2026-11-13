export interface OfflineSaleRecord {
  id: string;
  createdAt: string;
  payload: any;
  retryCount: number;
  lastError?: string;
}

const DB_NAME = 'SteelTrackPosOfflineDb';
const DB_VERSION = 1;
const STORE_NAME = 'offline_sales';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB is not supported on this platform.'));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function enqueueOfflineSale(payload: any): Promise<string> {
  const db = await openDatabase();
  const id = `TX-OFFLINE-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

  const record: OfflineSaleRecord = {
    id,
    createdAt: new Date().toISOString(),
    payload: {
      ...payload,
      offlineTransactionId: id,
      offlineRecordedAt: new Date().toISOString(),
    },
    retryCount: 0,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(record);

    req.onsuccess = () => resolve(id);
    req.onerror = () => reject(req.error);
  });
}

export async function getPendingOfflineSales(): Promise<OfflineSaleRecord[]> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function getPendingOfflineSalesCount(): Promise<number> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.count();

      req.onsuccess = () => resolve(req.result || 0);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return 0;
  }
}

export async function removeOfflineSale(id: string): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Ignore error on delete
  }
}

export async function syncOfflineSales(
  processFn: (payload: any) => Promise<any>
): Promise<{ synced: number; failed: number }> {
  const pending = await getPendingOfflineSales();
  if (pending.length === 0) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;

  for (const record of pending) {
    try {
      await processFn(record.payload);
      await removeOfflineSale(record.id);
      synced++;
    } catch (err: any) {
      console.warn(`[Offline POS Sync] Failed to sync offline transaction ${record.id}:`, err);
      failed++;
    }
  }

  return { synced, failed };
}

