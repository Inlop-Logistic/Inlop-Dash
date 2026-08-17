/**
 * KARAM · db.js
 * -----------------------------------------------------------------------
 * Capa de persistencia sobre IndexedDB (offline-first, sin backend).
 *
 * Decisiones de simplificación documentadas (V1):
 *  - "order_items" y "purchase_items" NO son stores separados: se
 *    guardan como array embebido dentro de "orders" / "purchases".
 *    IndexedDB es un almacén de documentos, no relacional; normalizar
 *    esos ítems no aporta valor en V1 y complica las consultas.
 *  - "inventory" no es un store separado: el stock vive directamente en
 *    el store "ingredients" (campo stock/minStock). Los movimientos de
 *    inventario (entradas, consumo, ajustes, merma) sí se registran en
 *    "inventory_movements" para trazabilidad.
 *  - Todas las entidades usan id de texto (uid()) como keyPath, generado
 *    en el cliente, para simplificar una futura migración a Supabase
 *    (mismos IDs, sin remapeo de autoincrementales).
 * -----------------------------------------------------------------------
 */
(function (global) {
  const DB_NAME = 'karam_db';
  const DB_VERSION = 1;

  const STORES = [
    'users',
    'settings',
    'products',
    'ingredients',
    'recipes',
    'orders',
    'sales',
    'purchases',
    'expenses',
    'inventory_movements',
    'promotions',
    'cash_movements',
    'partners',
    'withdrawals',
    'daily_closings',
  ];

  let dbPromise = null;

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (ev) => {
        const db = req.result;
        STORES.forEach((name) => {
          if (!db.objectStoreNames.contains(name)) {
            db.createObjectStore(name, { keyPath: 'id' });
          }
        });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  function tx(storeName, mode) {
    return openDB().then((db) => db.transaction(storeName, mode).objectStore(storeName));
  }

  function wrap(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  const DB = {
    async getAll(store) {
      const os = await tx(store, 'readonly');
      return wrap(os.getAll());
    },
    async get(store, id) {
      const os = await tx(store, 'readonly');
      return wrap(os.get(id));
    },
    async put(store, value) {
      const os = await tx(store, 'readwrite');
      await wrap(os.put(value));
      return value;
    },
    async bulkPut(store, values) {
      const os = await tx(store, 'readwrite');
      values.forEach((v) => os.put(v));
      return new Promise((resolve, reject) => {
        os.transaction.oncomplete = () => resolve(values);
        os.transaction.onerror = () => reject(os.transaction.error);
      });
    },
    async delete(store, id) {
      const os = await tx(store, 'readwrite');
      await wrap(os.delete(id));
      return true;
    },
    async clear(store) {
      const os = await tx(store, 'readwrite');
      await wrap(os.clear());
      return true;
    },
    async count(store) {
      const os = await tx(store, 'readonly');
      return wrap(os.count());
    },
  };

  global.KaramDB = DB;
  global.KaramDB.STORES = STORES;
})(window);
