export interface StoredTrack {
  id: string;
  name: string;
  file: Blob;
  artist: string;
}
const open = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("motr-library", 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("tracks", { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
async function transact<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("tracks", mode);
    const req = action(tx.objectStore("tracks"));
    tx.oncomplete = () => {
      db.close();
      resolve(req.result);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
    tx.onabort = () => {
      db.close();
      reject(tx.error || new Error("Storage transaction cancelled"));
    };
  });
}
export const readLibrary = () =>
  transact<StoredTrack[]>("readonly", (s) => s.getAll());
export const saveTrack = (track: StoredTrack) =>
  transact("readwrite", (s) => s.put(track));
export const deleteTrack = (id: string) =>
  transact("readwrite", (s) => s.delete(id));
