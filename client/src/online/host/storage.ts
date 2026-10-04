// Persistencia do banco do mestre no IndexedDB do navegador. O banco inteiro
// (todas as campanhas, como o rpg-manager.db do servidor) e um blob unico.
const DB_NAME = 'eva-s';
const STORE = 'kv';
const DB_KEY = 'database';
const META_KEY = 'meta';

export interface StorageMeta { savedAt: string; size: number }

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest | void): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    t.oncomplete = () => { db.close(); resolve((req ? req.result : undefined) as T); };
    t.onerror = () => { db.close(); reject(t.error); };
    t.onabort = () => { db.close(); reject(t.error); };
  });
}

export async function loadDatabase(): Promise<Uint8Array | null> {
  const data = await tx<Uint8Array | undefined>('readonly', (s) => s.get(DB_KEY));
  return data ?? null;
}

export async function saveDatabase(bytes: Uint8Array): Promise<void> {
  const meta: StorageMeta = { savedAt: new Date().toISOString(), size: bytes.byteLength };
  await tx('readwrite', (s) => { s.put(bytes, DB_KEY); s.put(meta, META_KEY); });
}

export async function loadMeta(): Promise<StorageMeta | null> {
  return (await tx<StorageMeta | undefined>('readonly', (s) => s.get(META_KEY))) ?? null;
}

/** Pede ao navegador para nao apagar os dados sozinho quando faltar espaco. */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
