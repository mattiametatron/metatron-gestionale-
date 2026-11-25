/**
 * Archiviazione persistente foto per Commessa (stile Google Foto)
 * Salva in IndexedDB (istantaneo, offline-safe, alta risoluzione) + sincronizza con /api/photos
 * così le foto scattate dal telefono appaiono subito anche sul PC.
 */

import {
  authFetch,
  fetchAuthenticatedBlobUrl,
  getActiveUserId,
} from './authSession';

export interface CommessaPhotoItem {
  id: string;
  commessaId: string;
  commessaCode: string;
  commessaTitle: string;
  caption: string;
  capturedAt: string;
  width: number;
  height: number;
  sizeBytes: number;
  imageUrl: string; // dataUrl, objectUrl, or /api/photos/:id/file
  source: 'app_foto' | 'prova_101';
}

interface LocalPhotoRecord {
  id: string;
  commessaId: string;
  commessaCode: string;
  commessaTitle: string;
  caption: string;
  capturedAt: string;
  width: number;
  height: number;
  sizeBytes: number;
  dataUrl: string;
}

const PHOTOS_STORE_NAME = 'photos_v1';

function getPhotosDbName(): string {
  const uid = getActiveUserId() || 'anon';
  return `caricostudio_commessa_photos_db_${uid}`;
}

function openPhotosDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(getPhotosDbName(), 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(PHOTOS_STORE_NAME)) {
        db.createObjectStore(PHOTOS_STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('IndexedDB foto non disponibile'));
  });
}

async function getAllLocalPhotos(): Promise<LocalPhotoRecord[]> {
  try {
    const db = await openPhotosDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(PHOTOS_STORE_NAME, 'readonly');
      const req = tx.objectStore(PHOTOS_STORE_NAME).getAll();
      req.onsuccess = () => resolve((req.result as LocalPhotoRecord[]) || []);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

async function putLocalPhoto(rec: LocalPhotoRecord): Promise<void> {
  try {
    const db = await openPhotosDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(PHOTOS_STORE_NAME, 'readwrite');
      tx.objectStore(PHOTOS_STORE_NAME).put(rec);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // fallback silenzioso se IndexedDB è bloccato
  }
}

async function deleteLocalPhoto(id: string): Promise<void> {
  try {
    const db = await openPhotosDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(PHOTOS_STORE_NAME, 'readwrite');
      tx.objectStore(PHOTOS_STORE_NAME).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignore
  }
}

async function updateLocalPhotoCaption(id: string, caption: string): Promise<void> {
  try {
    const db = await openPhotosDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(PHOTOS_STORE_NAME, 'readwrite');
      const store = tx.objectStore(PHOTOS_STORE_NAME);
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const existing = getReq.result as LocalPhotoRecord | undefined;
        if (existing) {
          store.put({ ...existing, caption });
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignore
  }
}

/**
 * Restituisce tutte le foto scattate nell'App Foto unendo archivio locale (IndexedDB)
 * e archivio protetto del server (/api/photos) per sincronizzazione Telefono <-> PC.
 */
export async function listCommessaPhotos(): Promise<CommessaPhotoItem[]> {
  const [localList, serverList] = await Promise.all([
    getAllLocalPhotos(),
    authFetch('/api/photos')
      .then((r) => (r.ok ? r.json() : { photos: [] }))
      .then((d) => (Array.isArray(d?.photos) ? d.photos : []))
      .catch(() => []),
  ]);

  const localMap = new Map<string, LocalPhotoRecord>();
  for (const lp of localList) {
    if (lp?.id) localMap.set(lp.id, lp);
  }

  const map = new Map<string, CommessaPhotoItem>();

  // Risolve eventuali foto presenti solo sul server (es. scattate da un altro dispositivo)
  // usando fetchAuthenticatedBlobUrl (con header Authorization: Bearer)
  await Promise.all(
    serverList.map(async (sp: any) => {
      if (!sp?.id) return;
      const localVersion = localMap.get(sp.id);
      let imageUrl = localVersion?.dataUrl || '';
      if (!imageUrl) {
        const protectedUrl = `/api/photos/${encodeURIComponent(sp.id)}/file`;
        imageUrl = (await fetchAuthenticatedBlobUrl(protectedUrl)) || '';
      }
      if (!imageUrl) return;
      map.set(sp.id, {
        id: sp.id,
        commessaId: sp.commessaId || '',
        commessaCode: sp.commessaCode || 'COMMESSA',
        commessaTitle: sp.commessaTitle || '',
        caption: sp.caption || localVersion?.caption || '',
        capturedAt: sp.capturedAt || new Date().toISOString(),
        width: Number(sp.width) || 0,
        height: Number(sp.height) || 0,
        sizeBytes: Number(sp.sizeBytes) || 0,
        imageUrl,
        source: 'app_foto',
      });
    })
  );

  // Aggiunge eventuali foto locali non ancora sincronizzate
  for (const lp of localList) {
    if (!lp?.id || map.has(lp.id)) continue;
    map.set(lp.id, {
      id: lp.id,
      commessaId: lp.commessaId,
      commessaCode: lp.commessaCode,
      commessaTitle: lp.commessaTitle,
      caption: lp.caption,
      capturedAt: lp.capturedAt,
      width: lp.width,
      height: lp.height,
      sizeBytes: lp.sizeBytes,
      imageUrl: lp.dataUrl,
      source: 'app_foto',
    });
  }

  return Array.from(map.values()).sort(
    (a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime()
  );
}

/**
 * Salva una foto scattata nella commessa sia in IndexedDB sia sul server /api/photos
 */
export async function saveCommessaPhoto(params: {
  commessaId: string;
  commessaCode: string;
  commessaTitle: string;
  caption?: string;
  dataUrl: string;
  width: number;
  height: number;
  capturedAt?: string;
}): Promise<CommessaPhotoItem> {
  const id = `foto_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const capturedAt = params.capturedAt || new Date().toISOString();
  const sizeBytes = Math.round((params.dataUrl.length * 3) / 4);

  const localRec: LocalPhotoRecord = {
    id,
    commessaId: params.commessaId,
    commessaCode: params.commessaCode,
    commessaTitle: params.commessaTitle,
    caption: (params.caption || '').trim(),
    capturedAt,
    width: params.width,
    height: params.height,
    sizeBytes,
    dataUrl: params.dataUrl,
  };

  await putLocalPhoto(localRec);

  authFetch('/api/photos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(localRec),
  }).catch(() => {});

  return {
    id,
    commessaId: localRec.commessaId,
    commessaCode: localRec.commessaCode,
    commessaTitle: localRec.commessaTitle,
    caption: localRec.caption,
    capturedAt,
    width: localRec.width,
    height: localRec.height,
    sizeBytes,
    imageUrl: localRec.dataUrl,
    source: 'app_foto',
  };
}

export async function updateCommessaPhotoCaption(
  id: string,
  caption: string
): Promise<void> {
  await updateLocalPhotoCaption(id, caption);
  authFetch(`/api/photos/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ caption }),
  }).catch(() => {});
}

export async function deleteCommessaPhoto(id: string): Promise<void> {
  await deleteLocalPhoto(id);
  authFetch(`/api/photos/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  }).catch(() => {});
}

/**
 * Converte un file immagine o un frame HTMLVideoElement in JPEG ottimizzato HD
 * con timbro opzionale discreto Data/Ora + Codice Commessa in basso.
 */
export function processImageSourceToJpeg(
  source: HTMLVideoElement | HTMLImageElement,
  options: {
    maxDim?: number;
    quality?: number;
    stampMeta?: {
      commessaCode: string;
      caption?: string;
      timestampIso: string;
    } | null;
  }
): { dataUrl: string; width: number; height: number } {
  const maxDim = options.maxDim ?? 1600;
  const quality = options.quality ?? 0.86;

  const srcW =
    source instanceof HTMLVideoElement ? source.videoWidth : source.naturalWidth || source.width;
  const srcH =
    source instanceof HTMLVideoElement ? source.videoHeight : source.naturalHeight || source.height;

  let width = Math.max(1, srcW);
  let height = Math.max(1, srcH);

  if (width > maxDim || height > maxDim) {
    const ratio = Math.min(maxDim / width, maxDim / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas non supportato');
  }

  ctx.drawImage(source, 0, 0, width, height);

  if (options.stampMeta) {
    const barH = Math.max(36, Math.round(height * 0.055));
    ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
    ctx.fillRect(0, height - barH, width, barH);

    const dt = new Date(options.stampMeta.timestampIso);
    const dtStr = `${dt.toLocaleDateString('it-IT')} ${dt.toLocaleTimeString('it-IT', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })}`;
    const fontSize = Math.max(12, Math.min(20, Math.round(barH * 0.48)));
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 ${fontSize}px ui-monospace, SFMono-Regular, Menlo, monospace`;
    const label = `${options.stampMeta.commessaCode}${
      options.stampMeta.caption ? ` · ${options.stampMeta.caption}` : ''
    }  |  ${dtStr}`;
    ctx.fillText(label, 14, height - Math.round(barH * 0.32), width - 28);
  }

  return {
    dataUrl: canvas.toDataURL('image/jpeg', quality),
    width,
    height,
  };
}

export function loadImageFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Impossibile leggere il file foto'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Formato immagine non valido'));
      img.onload = () => resolve(img);
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Scarica una foto (dataUrl o URL server) sul dispositivo come file .jpg
 */
export async function triggerPhotoDownload(photo: CommessaPhotoItem): Promise<void> {
  const safeCode = (photo.commessaCode || 'COMMESSA').replace(/[^a-zA-Z0-9_-]/g, '_');
  const dt = new Date(photo.capturedAt);
  const stamp = `${dt.getFullYear()}${String(dt.getMonth() + 1).padStart(2, '0')}${String(
    dt.getDate()
  ).padStart(2, '0')}_${String(dt.getHours()).padStart(2, '0')}${String(
    dt.getMinutes()
  ).padStart(2, '0')}${String(dt.getSeconds()).padStart(2, '0')}`;
  const fileName = `${safeCode}_${stamp}.jpg`;

  if (photo.imageUrl.startsWith('data:') || photo.imageUrl.startsWith('blob:')) {
    const a = document.createElement('a');
    a.href = photo.imageUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return;
  }

  try {
    const resp = await authFetch(photo.imageUrl);
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  } catch {
    const a = document.createElement('a');
    a.href = photo.imageUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}
