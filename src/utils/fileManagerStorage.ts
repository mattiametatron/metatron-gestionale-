/**
 * Archiviazione persistente per l'App "File" (Cartelle + Documenti PDF, Excel, Word, Foto, ecc.)
 * Salva in IndexedDB locale (veloce e offline-safe) + sincronizza con il server (/api/files)
 * così cartelle e file caricati dal PC o importati dall'App Foto sono sempre disponibili.
 */

import {
  authFetch,
  fetchAuthenticatedBlobUrl,
  getActiveUserId,
} from './authSession';

export type FolderColorKey = 'blue' | 'amber' | 'emerald' | 'rose' | 'slate' | 'violet';

export interface FileManagerFolder {
  id: string;
  name: string;
  parentId: string | null;
  color: FolderColorKey;
  commessaCode?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FileManagerItem {
  id: string;
  folderId: string | null; // null = Radice (Archivio Principale)
  name: string;
  mimeType: string;
  extension: string;
  sizeBytes: number;
  source: 'upload' | 'app_foto';
  createdAt: string;
  updatedAt: string;
  fileUrl: string; // dataUrl locale o blob URL autenticato
}

interface LocalFileBlobRecord {
  id: string;
  meta: Omit<FileManagerItem, 'fileUrl'>;
  dataUrl: string;
}

const FM_FOLDERS_STORE = 'folders_v1';
const FM_FILES_STORE = 'files_v1';

function getFileManagerDbName(): string {
  const uid = getActiveUserId() || 'anon';
  return `caricostudio_file_manager_db_${uid}`;
}

function openFileManagerDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(getFileManagerDbName(), 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(FM_FOLDERS_STORE)) {
        db.createObjectStore(FM_FOLDERS_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(FM_FILES_STORE)) {
        db.createObjectStore(FM_FILES_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('IndexedDB File Manager non disponibile'));
  });
}

async function getAllLocalFolders(): Promise<FileManagerFolder[]> {
  try {
    const db = await openFileManagerDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(FM_FOLDERS_STORE, 'readonly');
      const req = tx.objectStore(FM_FOLDERS_STORE).getAll();
      req.onsuccess = () => resolve((req.result as FileManagerFolder[]) || []);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

async function putLocalFolder(folder: FileManagerFolder): Promise<void> {
  try {
    const db = await openFileManagerDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(FM_FOLDERS_STORE, 'readwrite');
      tx.objectStore(FM_FOLDERS_STORE).put(folder);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignore
  }
}

async function deleteLocalFolder(folderId: string): Promise<void> {
  try {
    const db = await openFileManagerDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(FM_FOLDERS_STORE, 'readwrite');
      tx.objectStore(FM_FOLDERS_STORE).delete(folderId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignore
  }
}

async function getAllLocalFiles(): Promise<LocalFileBlobRecord[]> {
  try {
    const db = await openFileManagerDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(FM_FILES_STORE, 'readonly');
      const req = tx.objectStore(FM_FILES_STORE).getAll();
      req.onsuccess = () => resolve((req.result as LocalFileBlobRecord[]) || []);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

async function putLocalFile(rec: LocalFileBlobRecord): Promise<void> {
  try {
    const db = await openFileManagerDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(FM_FILES_STORE, 'readwrite');
      tx.objectStore(FM_FILES_STORE).put(rec);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignore
  }
}

async function updateLocalFileMeta(
  fileId: string,
  updates: Partial<Omit<FileManagerItem, 'fileUrl'>>
): Promise<void> {
  try {
    const db = await openFileManagerDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(FM_FILES_STORE, 'readwrite');
      const store = tx.objectStore(FM_FILES_STORE);
      const getReq = store.get(fileId);
      getReq.onsuccess = () => {
        const existing = getReq.result as LocalFileBlobRecord | undefined;
        if (existing) {
          store.put({
            ...existing,
            meta: { ...existing.meta, ...updates },
          });
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignore
  }
}

async function deleteLocalFile(fileId: string): Promise<void> {
  try {
    const db = await openFileManagerDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(FM_FILES_STORE, 'readwrite');
      tx.objectStore(FM_FILES_STORE).delete(fileId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignore
  }
}

export function extractFileExtension(fileName: string, mimeType = ''): string {
  const parts = fileName.trim().split('.');
  if (parts.length > 1) {
    const ext = parts[parts.length - 1].toLowerCase().replace(/[^a-z0-9]/g, '');
    if (ext && ext.length <= 10) return ext;
  }
  if (mimeType.includes('pdf')) return 'pdf';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return 'xlsx';
  if (mimeType.includes('csv')) return 'csv';
  if (mimeType.includes('jpeg') || mimeType.includes('jpg')) return 'jpg';
  if (mimeType.includes('png')) return 'png';
  if (mimeType.includes('webp')) return 'webp';
  if (mimeType.includes('word')) return 'docx';
  return 'bin';
}

export function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Impossibile leggere il file ${file.name}`));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(file);
  });
}

export async function fetchUrlAsDataUrl(url: string): Promise<string> {
  if (url.startsWith('data:')) return url;
  const resp = await authFetch(url);
  if (!resp.ok) throw new Error('Impossibile leggere la foto dal server');
  const blob = await resp.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Errore conversione foto'));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(blob);
  });
}

export async function listFileManagerData(): Promise<{
  folders: FileManagerFolder[];
  files: FileManagerItem[];
}> {
  const [localFolders, localFiles, serverData] = await Promise.all([
    getAllLocalFolders(),
    getAllLocalFiles(),
    authFetch('/api/files')
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null),
  ]);

  const folderMap = new Map<string, FileManagerFolder>();
  const serverFolders: FileManagerFolder[] = Array.isArray(serverData?.folders)
    ? serverData.folders
    : [];
  for (const f of serverFolders) {
    if (f?.id) folderMap.set(f.id, f);
  }
  for (const lf of localFolders) {
    if (lf?.id && !folderMap.has(lf.id)) {
      folderMap.set(lf.id, lf);
    }
  }

  const localFileMap = new Map<string, LocalFileBlobRecord>();
  for (const lf of localFiles) {
    if (lf?.id) localFileMap.set(lf.id, lf);
  }

  const fileMap = new Map<string, FileManagerItem>();
  const serverFiles: any[] = Array.isArray(serverData?.files) ? serverData.files : [];
  await Promise.all(
    serverFiles.map(async (sf) => {
      if (!sf?.id) return;
      const localRec = localFileMap.get(sf.id);
      let fileUrl = localRec?.dataUrl || '';
      if (!fileUrl) {
        const protectedUrl = `/api/files/${encodeURIComponent(sf.id)}/content`;
        fileUrl = (await fetchAuthenticatedBlobUrl(protectedUrl)) || protectedUrl;
      }
      fileMap.set(sf.id, {
        id: sf.id,
        folderId: sf.folderId ?? null,
        name: sf.name || 'File',
        mimeType: sf.mimeType || 'application/octet-stream',
        extension: sf.extension || extractFileExtension(sf.name || '', sf.mimeType || ''),
        sizeBytes: Number(sf.sizeBytes) || 0,
        source: sf.source === 'app_foto' ? 'app_foto' : 'upload',
        createdAt: sf.createdAt || new Date().toISOString(),
        updatedAt: sf.updatedAt || sf.createdAt || new Date().toISOString(),
        fileUrl,
      });
    })
  );

  for (const lf of localFiles) {
    if (!lf?.id || !lf.meta || fileMap.has(lf.id)) continue;
    fileMap.set(lf.id, {
      ...lf.meta,
      fileUrl: lf.dataUrl || '',
    });
  }

  const folders = Array.from(folderMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name, 'it')
  );
  const files = Array.from(fileMap.values()).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  return { folders, files };
}

export async function createFileManagerFolder(params: {
  name: string;
  parentId: string | null;
  color: FolderColorKey;
  commessaCode?: string;
}): Promise<FileManagerFolder> {
  const nowIso = new Date().toISOString();
  const folder: FileManagerFolder = {
    id: `fld_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: params.name.trim() || 'Nuova Cartella',
    parentId: params.parentId,
    color: params.color,
    commessaCode: params.commessaCode?.trim() || undefined,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  await putLocalFolder(folder);
  authFetch('/api/files/folders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(folder),
  }).catch(() => {});

  return folder;
}

export async function updateFileManagerFolder(
  folder: FileManagerFolder,
  updates: { name?: string; color?: FolderColorKey; commessaCode?: string; parentId?: string | null }
): Promise<FileManagerFolder> {
  const updated: FileManagerFolder = {
    ...folder,
    name: updates.name !== undefined ? updates.name.trim() || folder.name : folder.name,
    color: updates.color ?? folder.color,
    commessaCode:
      updates.commessaCode !== undefined
        ? updates.commessaCode.trim() || undefined
        : folder.commessaCode,
    parentId: updates.parentId !== undefined ? updates.parentId : folder.parentId,
    updatedAt: new Date().toISOString(),
  };

  await putLocalFolder(updated);
  authFetch(`/api/files/folders/${encodeURIComponent(folder.id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updated),
  }).catch(() => {});

  return updated;
}

export async function deleteFileManagerFolder(
  folderId: string,
  childFolderIds: string[],
  childFileIds: string[]
): Promise<void> {
  await deleteLocalFolder(folderId);
  for (const cid of childFolderIds) {
    await deleteLocalFolder(cid);
  }
  for (const fid of childFileIds) {
    await deleteLocalFile(fid);
  }
  authFetch(`/api/files/folders/${encodeURIComponent(folderId)}`, {
    method: 'DELETE',
  }).catch(() => {});
}

export async function saveFileManagerItem(params: {
  folderId: string | null;
  name: string;
  mimeType: string;
  dataUrl: string;
  sizeBytes?: number;
  source: 'upload' | 'app_foto';
}): Promise<FileManagerItem> {
  const nowIso = new Date().toISOString();
  const id = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const extension = extractFileExtension(params.name, params.mimeType);
  const sizeBytes =
    params.sizeBytes ?? Math.round(((params.dataUrl.split(',')[1] || '').length * 3) / 4);

  const meta: Omit<FileManagerItem, 'fileUrl'> = {
    id,
    folderId: params.folderId,
    name: params.name.trim() || `file.${extension}`,
    mimeType: params.mimeType || 'application/octet-stream',
    extension,
    sizeBytes,
    source: params.source,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  await putLocalFile({ id, meta, dataUrl: params.dataUrl });

  authFetch('/api/files/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...meta, dataUrl: params.dataUrl }),
  }).catch(() => {});

  return {
    ...meta,
    fileUrl: params.dataUrl,
  };
}

export async function updateFileManagerItem(
  item: FileManagerItem,
  updates: { name?: string; folderId?: string | null }
): Promise<FileManagerItem> {
  const nextName =
    updates.name !== undefined ? updates.name.trim() || item.name : item.name;
  const nextFolderId =
    updates.folderId !== undefined ? updates.folderId : item.folderId;
  const updatedAt = new Date().toISOString();

  const updated: FileManagerItem = {
    ...item,
    name: nextName,
    extension: extractFileExtension(nextName, item.mimeType),
    folderId: nextFolderId,
    updatedAt,
  };

  const { fileUrl: _ignore, ...metaOnly } = updated;
  await updateLocalFileMeta(item.id, metaOnly);

  authFetch(`/api/files/${encodeURIComponent(item.id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: updated.name,
      folderId: updated.folderId,
      extension: updated.extension,
      updatedAt,
    }),
  }).catch(() => {});

  return updated;
}

export async function deleteFileManagerItem(fileId: string): Promise<void> {
  await deleteLocalFile(fileId);
  authFetch(`/api/files/${encodeURIComponent(fileId)}`, {
    method: 'DELETE',
  }).catch(() => {});
}

export async function triggerFileManagerDownload(item: FileManagerItem): Promise<void> {
  if (item.fileUrl.startsWith('data:') || item.fileUrl.startsWith('blob:')) {
    const a = document.createElement('a');
    a.href = item.fileUrl;
    a.download = item.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return;
  }

  try {
    const resp = await authFetch(item.fileUrl);
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = item.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  } catch {
    const a = document.createElement('a');
    a.href = item.fileUrl;
    a.download = item.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}
