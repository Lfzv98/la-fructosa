// Modo sin conexión: guarda en el teléfono la última copia de tus datos (para abrir la app sin
// internet) y una cola de movimientos nuevos que se suben automáticamente cuando vuelve la conexión.
// Todo vive en IndexedDB de este navegador y se borra al cerrar sesión (salvo lo que falte por subir).

const DB = 'fructosa';
const STORE = 'kv';
let dbp;
function db() {
  if (!('indexedDB' in window)) return Promise.reject(new Error('sin IndexedDB'));
  return (dbp ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => { dbp = null; reject(req.error); };
  }));
}
async function tx(mode, fn) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const t = d.transaction(STORE, mode);
    const out = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(out?.result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}
export const kv = {
  get: (k) => tx('readonly', (s) => s.get(k)).catch(() => undefined),
  set: (k, v) => tx('readwrite', (s) => s.put(v, k)).catch(() => undefined),
  del: (k) => tx('readwrite', (s) => s.delete(k)).catch(() => undefined),
};

export const isNetworkError = (e) => !navigator.onLine
  || e instanceof TypeError
  || /Failed to fetch|NetworkError|Load failed|network|fetch failed|ERR_INTERNET/i.test(e?.message || String(e || ''));

// Última copia de los datos (para abrir sin conexión).
export const snapshot = {
  read: (uid) => kv.get('snap-' + uid),
  write: (uid, data) => kv.set('snap-' + uid, { at: new Date().toISOString(), data }),
  clear: (uid) => kv.del('snap-' + uid),
};

// Cola de movimientos nuevos pendientes por subir: [{ table, row }]
export const queue = {
  read: async (uid) => (await kv.get('queue-' + uid)) || [],
  write: (uid, list) => (list.length ? kv.set('queue-' + uid, list) : kv.del('queue-' + uid)),
};

export const uuid = () => (crypto.randomUUID ? crypto.randomUUID()
  : '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) => (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)));
