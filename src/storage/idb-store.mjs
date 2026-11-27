// Keeps the local game database (a SQLite file) in IndexedDB.
// Two keys live in one object store: `meta` ({version, savedAt}) and `sqlite`
// (the database bytes). Both are written in the same transaction.

const dbName = 'stall-street';
const storeName = 'local-api';

function request(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function createIndexedDbStore({name = dbName} = {}) {
  let opening;
  const open = () => {
    opening ??= new Promise((resolve, reject) => {
      const req = indexedDB.open(name, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(storeName);
      req.onsuccess = () => {
        const connection = req.result;
        // Another tab deleting or upgrading the database must not be blocked by this one.
        connection.onversionchange = () => { connection.close(); opening = undefined; };
        resolve(connection);
      };
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('IndexedDB is blocked by another tab.'));
    }).catch(error => { opening = undefined; throw error; });
    return opening;
  };
  const read = async key => {
    const connection = await open();
    return request(connection.transaction(storeName, 'readonly').objectStore(storeName).get(key));
  };
  return {
    kind: 'indexeddb',
    readMeta: () => read('meta').then(value => value ?? null),
    async readBytes() {
      const value = await read('sqlite');
      return value ? new Uint8Array(value) : null;
    },
    async write(bytes, version) {
      const connection = await open();
      await new Promise((resolve, reject) => {
        const transaction = connection.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        store.put(bytes, 'sqlite');
        store.put({version, savedAt: Date.now(), bytes: bytes.byteLength}, 'meta');
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB write aborted.'));
      });
    },
    async clear() {
      const connection = await open();
      await new Promise((resolve, reject) => {
        const transaction = connection.transaction(storeName, 'readwrite');
        transaction.objectStore(storeName).clear();
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
    },
  };
}

// Used when IndexedDB is unavailable (some private modes). Data lasts for this tab only.
export function createMemoryStore() {
  let meta = null, bytes = null;
  return {
    kind: 'memory',
    readMeta: async () => meta,
    readBytes: async () => bytes,
    async write(next, version) { bytes = next; meta = {version, savedAt: Date.now(), bytes: next.byteLength}; },
    async clear() { meta = null; bytes = null; },
  };
}
