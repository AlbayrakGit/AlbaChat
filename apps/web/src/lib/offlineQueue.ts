/**
 * IndexedDB tabanlı offline mesaj kuyruğu.
 * Socket bağlantısı yokken gönderilemeyen mesajlar burada saklanır.
 * Bağlantı kurulunca otomatik gönderilir ve kuyruktan silinir.
 */

const DB_NAME = 'AlbaChat-offline';
const STORE_NAME = 'message-queue';
const DB_VERSION = 1;

export interface QueuedMessage {
  id: string;        // idempotency key — benzersiz tanımlayıcı
  groupId: number;
  content: string;
  type: string;
  timestamp: number;
}

let dbInstance: IDBDatabase | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = (e) => {
      dbInstance = (e.target as IDBOpenDBRequest).result;
      resolve(dbInstance);
    };

    request.onerror = () => reject(request.error);
  });
}

/** Mesajı kuyruğa ekle (var ise güncelle) */
export async function enqueueMessage(msg: QueuedMessage): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const req = tx.objectStore(STORE_NAME).put(msg);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/** Tüm kuyruğu getir (zaman sırasına göre) */
export async function dequeueAll(): Promise<QueuedMessage[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => {
      const sorted = (req.result as QueuedMessage[]).sort((a, b) => a.timestamp - b.timestamp);
      resolve(sorted);
    };
    req.onerror = () => reject(req.error);
  });
}

/** Başarıyla gönderilen mesajı kuyruktan sil */
export async function removeFromQueue(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const req = tx.objectStore(STORE_NAME).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/** Kuyruktaki mesaj sayısı */
export async function queueSize(): Promise<number> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
