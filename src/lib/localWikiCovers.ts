type LocalWikiCover = { id: string; file: Blob | null };

const DATABASE_NAME = 'rede-nex-wiki-covers';
const STORE_NAME = 'covers';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Não foi possível abrir o armazenamento local.'));
  });
}

export async function listLocalWikiCovers(): Promise<LocalWikiCover[]> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const request = transaction.objectStore(STORE_NAME).getAll();
    transaction.oncomplete = () => {
      database.close();
      resolve(request.result as LocalWikiCover[]);
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error || new Error('Não foi possível carregar as capas locais.'));
    };
  });
}

export async function saveLocalWikiCover(id: string, file: Blob | null): Promise<void> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put({ id, file } satisfies LocalWikiCover);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error || new Error('Não foi possível salvar a capa local.'));
    };
  });
}

export async function deleteLocalWikiCover(id: string): Promise<void> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).delete(id);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error || new Error('Não foi possível restaurar a capa original.'));
    };
  });
}
