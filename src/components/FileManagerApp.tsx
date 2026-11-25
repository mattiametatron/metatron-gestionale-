import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Folder,
  FolderPlus,
  FolderOpen,
  Upload,
  Image as ImageIcon,
  FileText,
  FileSpreadsheet,
  File as FileIcon,
  Download,
  Trash2,
  Pencil,
  Search,
  ChevronRight,
  LayoutGrid,
  List,
  X,
  Check,
  RefreshCw,
  Eye,
  FolderInput,
  Camera,
  Loader2,
  ArrowLeft,
} from 'lucide-react';
import { CargoLoad } from '../types/warehouse';
import {
  createFileManagerFolder,
  deleteFileManagerFolder,
  deleteFileManagerItem,
  fetchUrlAsDataUrl,
  FileManagerFolder,
  FileManagerItem,
  FolderColorKey,
  formatFileSize,
  listFileManagerData,
  readFileAsDataUrl,
  saveFileManagerItem,
  triggerFileManagerDownload,
  updateFileManagerFolder,
  updateFileManagerItem,
} from '../utils/fileManagerStorage';
import { CommessaPhotoItem, listCommessaPhotos } from '../utils/commessaPhotosStorage';

interface FileManagerAppProps {
  loads: CargoLoad[];
}

const FOLDER_COLORS: Record<
  FolderColorKey,
  { label: string; iconClass: string; badgeClass: string; dotClass: string }
> = {
  blue: {
    label: 'Blu',
    iconClass: 'text-blue-600 fill-blue-100',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
    dotClass: 'bg-blue-600',
  },
  amber: {
    label: 'Giallo',
    iconClass: 'text-amber-500 fill-amber-100',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
    dotClass: 'bg-amber-500',
  },
  emerald: {
    label: 'Verde',
    iconClass: 'text-emerald-600 fill-emerald-100',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    dotClass: 'bg-emerald-600',
  },
  rose: {
    label: 'Rosso',
    iconClass: 'text-rose-600 fill-rose-100',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
    dotClass: 'bg-rose-600',
  },
  violet: {
    label: 'Viola',
    iconClass: 'text-violet-600 fill-violet-100',
    badgeClass: 'bg-violet-50 text-violet-700 border-violet-200',
    dotClass: 'bg-violet-600',
  },
  slate: {
    label: 'Grigio',
    iconClass: 'text-slate-600 fill-slate-200',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
    dotClass: 'bg-slate-600',
  },
};

function getFileTypeMeta(item: FileManagerItem): {
  kind: 'image' | 'pdf' | 'excel' | 'doc' | 'other';
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  bgColor: string;
} {
  const ext = (item.extension || '').toLowerCase();
  const mime = (item.mimeType || '').toLowerCase();

  if (
    mime.startsWith('image/') ||
    ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'svg'].includes(ext)
  ) {
    return {
      kind: 'image',
      label: ext.toUpperCase() || 'IMG',
      icon: ImageIcon,
      iconColor: 'text-blue-600',
      bgColor: 'bg-blue-50 border-blue-200',
    };
  }
  if (mime.includes('pdf') || ext === 'pdf') {
    return {
      kind: 'pdf',
      label: 'PDF',
      icon: FileText,
      iconColor: 'text-rose-600',
      bgColor: 'bg-rose-50 border-rose-200',
    };
  }
  if (
    mime.includes('spreadsheet') ||
    mime.includes('excel') ||
    mime.includes('csv') ||
    ['xlsx', 'xls', 'csv', 'ods'].includes(ext)
  ) {
    return {
      kind: 'excel',
      label: ext.toUpperCase() || 'XLSX',
      icon: FileSpreadsheet,
      iconColor: 'text-emerald-700',
      bgColor: 'bg-emerald-50 border-emerald-200',
    };
  }
  if (['doc', 'docx', 'odt', 'rtf', 'txt'].includes(ext) || mime.includes('word')) {
    return {
      kind: 'doc',
      label: ext.toUpperCase() || 'DOC',
      icon: FileText,
      iconColor: 'text-indigo-600',
      bgColor: 'bg-indigo-50 border-indigo-200',
    };
  }
  return {
    kind: 'other',
    label: (ext || 'FILE').toUpperCase(),
    icon: FileIcon,
    iconColor: 'text-slate-600',
    bgColor: 'bg-slate-100 border-slate-200',
  };
}

export const FileManagerApp: React.FC<FileManagerAppProps> = ({ loads }) => {
  const [folders, setFolders] = useState<FileManagerFolder[]>([]);
  const [files, setFiles] = useState<FileManagerItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Navigazione
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'image' | 'pdf' | 'excel' | 'other'>('all');
  const [isDragOver, setIsDragOver] = useState(false);

  // Modale Crea / Modifica Cartella
  const [folderModalMode, setFolderModalMode] = useState<'create' | 'edit' | null>(null);
  const [editingFolder, setEditingFolder] = useState<FileManagerFolder | null>(null);
  const [folderNameInput, setFolderNameInput] = useState('');
  const [folderColorInput, setFolderColorInput] = useState<FolderColorKey>('blue');
  const [folderCommessaInput, setFolderCommessaInput] = useState('');

  // Modale Rinomina / Sposta File
  const [editingFile, setEditingFile] = useState<FileManagerItem | null>(null);
  const [fileNameInput, setFileNameInput] = useState('');
  const [fileMoveFolderId, setFileMoveFolderId] = useState<string>('');

  // Conferma eliminazione inline
  const [confirmDeleteFolderId, setConfirmDeleteFolderId] = useState<string | null>(null);
  const [confirmDeleteFileId, setConfirmDeleteFileId] = useState<string | null>(null);

  // Modale Anteprima File
  const [previewFile, setPreviewFile] = useState<FileManagerItem | null>(null);

  // Modale Importa Foto dall'App Foto
  const [showPhotoPicker, setShowPhotoPicker] = useState(false);
  const [appPhotosList, setAppPhotosList] = useState<CommessaPhotoItem[]>([]);
  const [loadingAppPhotos, setLoadingAppPhotos] = useState(false);
  const [photoPickerCommessa, setPhotoPickerCommessa] = useState<string>('all');
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string>>(new Set());
  const [isImportingPhotos, setIsImportingPhotos] = useState(false);

  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    window.setTimeout(() => {
      setToastMsg((prev) => (prev === msg ? null : prev));
    }, 3000);
  };

  const refreshAll = async (spinner = false) => {
    if (spinner) setIsRefreshing(true);
    try {
      const data = await listFileManagerData();
      setFolders(data.folders);
      setFiles(data.files);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    refreshAll(false);
  }, []);

  // Breadcrumb gerarchico
  const breadcrumbs = useMemo(() => {
    const trail: FileManagerFolder[] = [];
    const byId = new Map(folders.map((f) => [f.id, f]));
    let cursor = currentFolderId;
    const seen = new Set<string>();
    while (cursor && !seen.has(cursor)) {
      seen.add(cursor);
      const found = byId.get(cursor);
      if (!found) break;
      trail.unshift(found);
      cursor = found.parentId;
    }
    return trail;
  }, [folders, currentFolderId]);

  const currentFolder = useMemo(
    () => (currentFolderId ? folders.find((f) => f.id === currentFolderId) || null : null),
    [folders, currentFolderId]
  );

  // Cartelle e File visibili nella vista corrente (o su ricerca globale)
  const visibleFolders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      return folders.filter(
        (f) =>
          f.name.toLowerCase().includes(q) ||
          (f.commessaCode || '').toLowerCase().includes(q)
      );
    }
    return folders.filter((f) => (f.parentId || null) === currentFolderId);
  }, [folders, currentFolderId, searchQuery]);

  const visibleFiles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return files.filter((file) => {
      if (!q && (file.folderId || null) !== currentFolderId) return false;
      if (q && !file.name.toLowerCase().includes(q)) return false;
      if (typeFilter !== 'all') {
        const meta = getFileTypeMeta(file);
        if (typeFilter === 'other') {
          if (meta.kind === 'image' || meta.kind === 'pdf' || meta.kind === 'excel') {
            return false;
          }
        } else if (meta.kind !== typeFilter) {
          return false;
        }
      }
      return true;
    });
  }, [files, currentFolderId, searchQuery, typeFilter]);

  const countItemsInFolder = (folderId: string): number => {
    const directFiles = files.filter((f) => f.folderId === folderId).length;
    const subFolders = folders.filter((f) => f.parentId === folderId).length;
    return directFiles + subFolders;
  };

  // --- CRUD CARTELLE ---
  const openCreateFolderModal = () => {
    setEditingFolder(null);
    setFolderNameInput('');
    setFolderColorInput('blue');
    setFolderCommessaInput('');
    setFolderModalMode('create');
  };

  const openEditFolderModal = (folder: FileManagerFolder) => {
    setEditingFolder(folder);
    setFolderNameInput(folder.name);
    setFolderColorInput(folder.color || 'blue');
    setFolderCommessaInput(folder.commessaCode || '');
    setFolderModalMode('edit');
  };

  const handleSubmitFolderModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderNameInput.trim()) return;

    if (folderModalMode === 'create') {
      const created = await createFileManagerFolder({
        name: folderNameInput.trim(),
        parentId: currentFolderId,
        color: folderColorInput,
        commessaCode: folderCommessaInput || undefined,
      });
      setFolders((prev) =>
        [...prev, created].sort((a, b) => a.name.localeCompare(b.name, 'it'))
      );
      showToast(`Cartella "${created.name}" creata`);
    } else if (folderModalMode === 'edit' && editingFolder) {
      const updated = await updateFileManagerFolder(editingFolder, {
        name: folderNameInput.trim(),
        color: folderColorInput,
        commessaCode: folderCommessaInput,
      });
      setFolders((prev) =>
        prev
          .map((f) => (f.id === updated.id ? updated : f))
          .sort((a, b) => a.name.localeCompare(b.name, 'it'))
      );
      showToast(`Cartella "${updated.name}" aggiornata`);
    }

    setFolderModalMode(null);
    setEditingFolder(null);
  };

  const collectDescendantFolderIds = (rootId: string): string[] => {
    const result: string[] = [];
    const queue = [rootId];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      for (const f of folders) {
        if (f.parentId === cur) {
          result.push(f.id);
          queue.push(f.id);
        }
      }
    }
    return result;
  };

  const handleDeleteFolder = async (folder: FileManagerFolder) => {
    const descIds = collectDescendantFolderIds(folder.id);
    const allFolderIds = new Set([folder.id, ...descIds]);
    const childFiles = files.filter((fl) => fl.folderId && allFolderIds.has(fl.folderId));
    const childFileIds = childFiles.map((fl) => fl.id);

    await deleteFileManagerFolder(folder.id, descIds, childFileIds);

    setFolders((prev) => prev.filter((f) => !allFolderIds.has(f.id)));
    setFiles((prev) => prev.filter((fl) => !fl.folderId || !allFolderIds.has(fl.folderId)));
    if (currentFolderId && allFolderIds.has(currentFolderId)) {
      setCurrentFolderId(folder.parentId || null);
    }
    setConfirmDeleteFolderId(null);
    showToast(`Cartella "${folder.name}" eliminata`);
  };

  // --- CARICAMENTO FILE LOCALI (PDF, Excel, Word, Foto, ecc.) ---
  const uploadFileList = async (fileList: FileList | File[]) => {
    const arr = Array.from(fileList);
    if (arr.length === 0) return;
    setIsUploading(true);
    try {
      const savedList: FileManagerItem[] = [];
      for (const file of arr) {
        const dataUrl = await readFileAsDataUrl(file);
        const saved = await saveFileManagerItem({
          folderId: currentFolderId,
          name: file.name,
          mimeType: file.type || 'application/octet-stream',
          dataUrl,
          sizeBytes: file.size,
          source: 'upload',
        });
        savedList.push(saved);
      }
      setFiles((prev) => [...savedList.reverse(), ...prev]);
      showToast(
        savedList.length === 1
          ? `Caricato "${savedList[0].name}"`
          : `Caricati ${savedList.length} file`
      );
    } catch (err: any) {
      showToast(err?.message || 'Errore durante il caricamento dei file');
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await uploadFileList(e.target.files);
      e.target.value = '';
    }
  };

  const handleDropFiles = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await uploadFileList(e.dataTransfer.files);
    }
  };

  // --- IMPORTA FOTO DALL'APP FOTO ---
  const handleOpenPhotoPicker = async () => {
    setShowPhotoPicker(true);
    setSelectedPhotoIds(new Set());
    setPhotoPickerCommessa('all');
    setLoadingAppPhotos(true);
    try {
      const appFotos = await listCommessaPhotos();
      // Includi anche le foto delle Prove Imballo 101%
      const proofPhotos: CommessaPhotoItem[] = [];
      loads.forEach((ld) => {
        (ld.packingProofs || []).forEach((pr) => {
          (pr.photos || []).forEach((ph) => {
            proofPhotos.push({
              id: `proof_${ld.id}_${ph.id}`,
              commessaId: ld.id,
              commessaCode: ld.code,
              commessaTitle: ld.title,
              caption: `${pr.targetCode} · ${ph.stageLabel}`,
              capturedAt: ph.capturedAt || pr.certifiedAt,
              width: 0,
              height: 0,
              sizeBytes: 0,
              imageUrl: ph.dataUrl,
              source: 'prova_101',
            });
          });
        });
      });
      const combined = [...appFotos, ...proofPhotos].sort(
        (a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime()
      );
      setAppPhotosList(combined);
    } finally {
      setLoadingAppPhotos(false);
    }
  };

  const filteredAppPhotos = useMemo(() => {
    if (photoPickerCommessa === 'all') return appPhotosList;
    return appPhotosList.filter(
      (p) =>
        p.commessaCode.trim().toUpperCase() === photoPickerCommessa.trim().toUpperCase()
    );
  }, [appPhotosList, photoPickerCommessa]);

  const handleImportSelectedAppPhotos = async () => {
    const targets = appPhotosList.filter((p) => selectedPhotoIds.has(p.id));
    if (targets.length === 0) return;
    setIsImportingPhotos(true);
    try {
      const imported: FileManagerItem[] = [];
      for (let i = 0; i < targets.length; i++) {
        const photo = targets[i];
        const dataUrl = await fetchUrlAsDataUrl(photo.imageUrl);
        const safeCode = (photo.commessaCode || 'FOTO').replace(/[^a-zA-Z0-9_-]/g, '_');
        const safeCap = (photo.caption || '')
          .replace(/[^a-zA-Z0-9_-]/g, '_')
          .slice(0, 28);
        const dt = new Date(photo.capturedAt);
        const stamp = `${dt.getFullYear()}${String(dt.getMonth() + 1).padStart(2, '0')}${String(
          dt.getDate()
        ).padStart(2, '0')}_${String(dt.getHours()).padStart(2, '0')}${String(
          dt.getMinutes()
        ).padStart(2, '0')}`;
        const fileName = `${safeCode}${safeCap ? `_${safeCap}` : ''}_${stamp}.jpg`;

        const saved = await saveFileManagerItem({
          folderId: currentFolderId,
          name: fileName,
          mimeType: 'image/jpeg',
          dataUrl,
          source: 'app_foto',
        });
        imported.push(saved);
      }

      setFiles((prev) => [...imported.reverse(), ...prev]);
      setShowPhotoPicker(false);
      showToast(
        imported.length === 1
          ? '1 foto importata dall\'App Foto'
          : `${imported.length} foto importate dall'App Foto`
      );
    } catch (err: any) {
      showToast(err?.message || 'Errore importazione foto');
    } finally {
      setIsImportingPhotos(false);
    }
  };

  // --- MODIFICA / SPOSTA / ELIMINA FILE ---
  const openEditFileModal = (item: FileManagerItem) => {
    setEditingFile(item);
    setFileNameInput(item.name);
    setFileMoveFolderId(item.folderId || '');
  };

  const handleSubmitEditFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFile || !fileNameInput.trim()) return;
    const updated = await updateFileManagerItem(editingFile, {
      name: fileNameInput.trim(),
      folderId: fileMoveFolderId || null,
    });
    setFiles((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
    setEditingFile(null);
    showToast(`File "${updated.name}" aggiornato`);
  };

  const handleDeleteFile = async (item: FileManagerItem) => {
    await deleteFileManagerItem(item.id);
    setFiles((prev) => prev.filter((f) => f.id !== item.id));
    if (previewFile?.id === item.id) setPreviewFile(null);
    setConfirmDeleteFileId(null);
    showToast(`File "${item.name}" eliminato`);
  };

  const rootFolders = useMemo(
    () => folders.filter((f) => !f.parentId),
    [folders]
  );

  return (
    <div className="h-full flex bg-slate-50 text-slate-900 overflow-hidden relative">
      {/* =================================================================
          SIDEBAR SINISTRA: ALBERO CARTELLE
      ================================================================= */}
      <aside className="w-56 lg:w-64 bg-white border-r border-slate-200 flex flex-col shrink-0 hidden md:flex">
        <div className="p-3.5 border-b border-slate-200 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <FolderOpen className="w-4 h-4 text-blue-600 shrink-0" />
            <span className="text-xs font-bold text-slate-900 uppercase tracking-wider truncate">
              Archivio File
            </span>
          </div>
          <button
            type="button"
            onClick={openCreateFolderModal}
            className="p-1.5 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-700 cursor-pointer"
            title="Nuova Cartella"
          >
            <FolderPlus className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          <button
            type="button"
            onClick={() => {
              setCurrentFolderId(null);
              setSearchQuery('');
            }}
            className={`w-full px-2.5 py-2 rounded-lg text-xs font-semibold flex items-center justify-between gap-2 cursor-pointer transition-colors ${
              currentFolderId === null
                ? 'bg-slate-900 text-white'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <span className="flex items-center gap-2 truncate">
              <FolderOpen className="w-4 h-4 shrink-0" />
              <span className="truncate">Cartella Principale</span>
            </span>
            <span className="font-mono text-[11px] opacity-75">
              {files.filter((f) => !f.folderId).length}
            </span>
          </button>

          {rootFolders.length > 0 && (
            <div className="pt-2 px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Le tue cartelle ({folders.length})
            </div>
          )}

          {folders.map((folder) => {
            const isSelected = currentFolderId === folder.id;
            const colorCfg = FOLDER_COLORS[folder.color] || FOLDER_COLORS.blue;
            const isSub = Boolean(folder.parentId);
            return (
              <button
                key={folder.id}
                type="button"
                onClick={() => {
                  setCurrentFolderId(folder.id);
                  setSearchQuery('');
                }}
                className={`w-full py-1.5 px-2.5 rounded-lg text-xs font-medium flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                  isSub ? 'pl-6' : ''
                } ${
                  isSelected
                    ? 'bg-blue-600 text-white font-semibold'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span className="flex items-center gap-2 min-w-0">
                  <Folder
                    className={`w-4 h-4 shrink-0 ${
                      isSelected ? 'text-white' : colorCfg.iconClass
                    }`}
                  />
                  <span className="truncate">{folder.name}</span>
                </span>
                <span className="font-mono text-[11px] opacity-75 shrink-0">
                  {countItemsInFolder(folder.id)}
                </span>
              </button>
            );
          })}
        </div>

        <div className="p-3 border-t border-slate-200 bg-slate-50 text-[11px] text-slate-500 font-mono flex items-center justify-between">
          <span>{folders.length} cartelle</span>
          <span>{files.length} file</span>
        </div>
      </aside>

      {/* =================================================================
          AREA PRINCIPALE: TOOLBAR + CONTENUTO CARTELLE & FILE
      ================================================================= */}
      <div
        className="flex-1 flex flex-col min-w-0 overflow-hidden"
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDropFiles}
      >
        {/* Top Action Toolbar */}
        <div className="bg-white border-b border-slate-200 px-4 py-3 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
            {currentFolder && (
              <button
                type="button"
                onClick={() => setCurrentFolderId(currentFolder.parentId || null)}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 cursor-pointer mr-1"
                title="Torna alla cartella superiore"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setCurrentFolderId(null)}
              className={`text-xs font-bold cursor-pointer hover:underline ${
                currentFolderId === null ? 'text-slate-900' : 'text-slate-500'
              }`}
            >
              Archivio File
            </button>
            {breadcrumbs.map((crumb) => (
              <React.Fragment key={crumb.id}>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <button
                  type="button"
                  onClick={() => setCurrentFolderId(crumb.id)}
                  className={`text-xs font-bold cursor-pointer hover:underline truncate max-w-[140px] ${
                    crumb.id === currentFolderId ? 'text-slate-900' : 'text-slate-500'
                  }`}
                >
                  {crumb.name}
                </button>
              </React.Fragment>
            ))}
          </div>

          {/* Pulsanti Operativi Principali */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={openCreateFolderModal}
              className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <FolderPlus className="w-3.5 h-3.5 text-amber-600" />
              <span>Nuova Cartella</span>
            </button>

            <button
              type="button"
              onClick={handleOpenPhotoPicker}
              className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-800 text-xs font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Camera className="w-3.5 h-3.5 text-indigo-600" />
              <span>Importa da App Foto</span>
            </button>

            <label className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap">
              {isUploading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Upload className="w-3.5 h-3.5" />
              )}
              <span>{isUploading ? 'Caricamento...' : 'Carica File (PDF, Excel, Foto...)'}</span>
              <input
                type="file"
                multiple
                accept="*/*"
                onChange={handleFileInputChange}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* Barra Filtri + Ricerca + Switch Griglia/Lista */}
        <div className="bg-white border-b border-slate-200 px-4 py-2 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {(
              [
                ['all', 'Tutti'],
                ['image', 'Foto'],
                ['pdf', 'PDF'],
                ['excel', 'Excel / CSV'],
                ['other', 'Altri'],
              ] as const
            ).map(([val, lbl]) => (
              <button
                key={val}
                type="button"
                onClick={() => setTypeFilter(val)}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer whitespace-nowrap ${
                  typeFilter === val
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {lbl}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-48 sm:w-56">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cerca cartelle o file..."
                className="w-full pl-8 pr-2.5 py-1 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:border-blue-600"
              />
            </div>

            <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-1 rounded cursor-pointer ${
                  viewMode === 'grid' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500'
                }`}
                title="Vista Griglia"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`p-1 rounded cursor-pointer ${
                  viewMode === 'list' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500'
                }`}
                title="Vista Lista"
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => refreshAll(true)}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 cursor-pointer"
              title="Aggiorna archivio"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Corpo Cartelle + File */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6 relative">
          {isDragOver && (
            <div className="fixed inset-4 z-40 rounded-2xl border-2 border-dashed border-blue-500 bg-blue-50/90 flex flex-col items-center justify-center gap-2 pointer-events-none">
              <Upload className="w-10 h-10 text-blue-600" />
              <p className="text-sm font-bold text-blue-900">
                Rilascia qui PDF, Excel, Word o Foto per caricarli in{' '}
                {currentFolder ? `"${currentFolder.name}"` : 'Archivio Principale'}
              </p>
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-20 text-slate-400 gap-2 text-xs">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Caricamento archivio file...</span>
            </div>
          ) : visibleFolders.length === 0 && visibleFiles.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center max-w-lg mx-auto mt-6 space-y-3">
              <FolderOpen className="w-10 h-10 text-slate-400 mx-auto" />
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-900">
                  {currentFolder
                    ? `La cartella "${currentFolder.name}" è vuota`
                    : 'Archivio File pronto'}
                </h3>
                <p className="text-xs text-slate-500">
                  Crea una cartella, trascina qui PDF / Excel / documenti dal PC oppure importa foto scattate nell&apos;App Foto.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={openCreateFolderModal}
                  className="px-3 py-2 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 text-xs font-semibold text-slate-800 cursor-pointer flex items-center gap-1.5"
                >
                  <FolderPlus className="w-3.5 h-3.5 text-amber-600" />
                  Nuova Cartella
                </button>
                <button
                  type="button"
                  onClick={handleOpenPhotoPicker}
                  className="px-3 py-2 rounded-lg bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-xs font-semibold text-indigo-800 cursor-pointer flex items-center gap-1.5"
                >
                  <Camera className="w-3.5 h-3.5" />
                  Importa da App Foto
                </button>
                <label className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5" />
                  Carica File dal PC
                  <input
                    type="file"
                    multiple
                    accept="*/*"
                    onChange={handleFileInputChange}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          ) : (
            <>
              {/* SEZIONE CARTELLE */}
              {visibleFolders.length > 0 && (
                <section className="space-y-2.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Cartelle ({visibleFolders.length})
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {visibleFolders.map((folder) => {
                      const colorCfg = FOLDER_COLORS[folder.color] || FOLDER_COLORS.blue;
                      const itemCount = countItemsInFolder(folder.id);
                      const isConfirming = confirmDeleteFolderId === folder.id;

                      return (
                        <div
                          key={folder.id}
                          className="bg-white border border-slate-200 hover:border-slate-400 rounded-xl p-3 flex items-center justify-between gap-2.5 transition-colors"
                        >
                          <button
                            type="button"
                            onClick={() => setCurrentFolderId(folder.id)}
                            className="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer"
                          >
                            <Folder className={`w-8 h-8 shrink-0 ${colorCfg.iconClass}`} />
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-slate-900 truncate">
                                {folder.name}
                              </div>
                              <div className="text-[11px] text-slate-500 font-mono truncate">
                                {itemCount} {itemCount === 1 ? 'elemento' : 'elementi'}
                                {folder.commessaCode ? ` · ${folder.commessaCode}` : ''}
                              </div>
                            </div>
                          </button>

                          {isConfirming ? (
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleDeleteFolder(folder)}
                                className="px-2 py-1 rounded bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold cursor-pointer"
                              >
                                Elimina
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteFolderId(null)}
                                className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => openEditFolderModal(folder)}
                                className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500 hover:text-slate-900 cursor-pointer"
                                title="Modifica cartella"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteFolderId(folder.id)}
                                className="p-1.5 rounded-md hover:bg-rose-50 text-slate-500 hover:text-rose-600 cursor-pointer"
                                title="Elimina cartella"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* SEZIONE FILE */}
              {visibleFiles.length > 0 && (
                <section className="space-y-2.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    File ({visibleFiles.length})
                  </h3>

                  {viewMode === 'grid' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
                      {visibleFiles.map((file) => {
                        const meta = getFileTypeMeta(file);
                        const TypeIcon = meta.icon;
                        const isConfirming = confirmDeleteFileId === file.id;

                        return (
                          <div
                            key={file.id}
                            className="bg-white border border-slate-200 hover:border-slate-400 rounded-xl overflow-hidden flex flex-col transition-colors"
                          >
                            {/* Anteprima superiore */}
                            <button
                              type="button"
                              onClick={() => setPreviewFile(file)}
                              className="h-32 bg-slate-100 relative flex items-center justify-center overflow-hidden cursor-pointer border-b border-slate-100"
                            >
                              {meta.kind === 'image' ? (
                                <img
                                  src={file.fileUrl}
                                  alt={file.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="flex flex-col items-center gap-1.5">
                                  <div
                                    className={`w-12 h-12 rounded-xl border flex items-center justify-center ${meta.bgColor}`}
                                  >
                                    <TypeIcon className={`w-6 h-6 ${meta.iconColor}`} />
                                  </div>
                                  <span className="font-mono text-[10px] font-bold text-slate-500">
                                    {meta.label}
                                  </span>
                                </div>
                              )}
                            </button>

                            {/* Info + Azioni */}
                            <div className="p-3 space-y-2 flex-1 flex flex-col justify-between">
                              <div className="min-w-0">
                                <div
                                  className="text-xs font-bold text-slate-900 truncate"
                                  title={file.name}
                                >
                                  {file.name}
                                </div>
                                <div className="text-[11px] font-mono text-slate-500 tabular-nums mt-0.5">
                                  {formatFileSize(file.sizeBytes)} ·{' '}
                                  {new Date(file.updatedAt).toLocaleDateString('it-IT')}
                                </div>
                              </div>

                              {isConfirming ? (
                                <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-slate-100">
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteFile(file)}
                                    className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold cursor-pointer"
                                  >
                                    Conferma Elimina
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteFileId(null)}
                                    className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold cursor-pointer"
                                  >
                                    Annulla
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                                  <button
                                    type="button"
                                    onClick={() => setPreviewFile(file)}
                                    className="text-[11px] font-semibold text-blue-700 hover:underline flex items-center gap-1 cursor-pointer"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                    Apri
                                  </button>

                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => triggerFileManagerDownload(file)}
                                      className="p-1.5 rounded hover:bg-slate-100 text-slate-600 hover:text-blue-700 cursor-pointer"
                                      title="Scarica file"
                                    >
                                      <Download className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => openEditFileModal(file)}
                                      className="p-1.5 rounded hover:bg-slate-100 text-slate-600 hover:text-slate-900 cursor-pointer"
                                      title="Rinomina o sposta in un'altra cartella"
                                    >
                                      <FolderInput className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setConfirmDeleteFileId(file.id)}
                                      className="p-1.5 rounded hover:bg-rose-50 text-slate-600 hover:text-rose-600 cursor-pointer"
                                      title="Elimina file"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    /* VISTA TABELLA / LISTA */
                    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-500 uppercase">
                            <th className="py-2.5 px-3">Nome File</th>
                            <th className="py-2.5 px-3">Tipo</th>
                            <th className="py-2.5 px-3 text-right">Dimensione</th>
                            <th className="py-2.5 px-3">Data</th>
                            <th className="py-2.5 px-3 text-right">Azioni</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {visibleFiles.map((file) => {
                            const meta = getFileTypeMeta(file);
                            const TypeIcon = meta.icon;
                            const isConfirming = confirmDeleteFileId === file.id;

                            return (
                              <tr key={file.id} className="hover:bg-slate-50">
                                <td className="py-2.5 px-3">
                                  <button
                                    type="button"
                                    onClick={() => setPreviewFile(file)}
                                    className="flex items-center gap-2.5 text-left font-semibold text-slate-900 hover:text-blue-700 cursor-pointer"
                                  >
                                    <TypeIcon className={`w-4 h-4 shrink-0 ${meta.iconColor}`} />
                                    <span className="truncate max-w-[260px]">{file.name}</span>
                                  </button>
                                </td>
                                <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">
                                  {meta.label}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-600">
                                  {formatFileSize(file.sizeBytes)}
                                </td>
                                <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">
                                  {new Date(file.updatedAt).toLocaleString('it-IT', {
                                    day: '2-digit',
                                    month: '2-digit',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </td>
                                <td className="py-2.5 px-3 text-right whitespace-nowrap">
                                  {isConfirming ? (
                                    <div className="inline-flex items-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteFile(file)}
                                        className="px-2 py-1 rounded bg-rose-600 text-white text-[11px] font-bold cursor-pointer"
                                      >
                                        Elimina
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setConfirmDeleteFileId(null)}
                                        className="px-2 py-1 rounded bg-slate-100 text-slate-700 text-[11px] cursor-pointer"
                                      >
                                        Annulla
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="inline-flex items-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() => setPreviewFile(file)}
                                        className="p-1.5 rounded hover:bg-slate-100 text-slate-600 cursor-pointer"
                                        title="Anteprima"
                                      >
                                        <Eye className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => triggerFileManagerDownload(file)}
                                        className="p-1.5 rounded hover:bg-slate-100 text-slate-600 cursor-pointer"
                                        title="Scarica"
                                      >
                                        <Download className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => openEditFileModal(file)}
                                        className="p-1.5 rounded hover:bg-slate-100 text-slate-600 cursor-pointer"
                                        title="Rinomina / Sposta"
                                      >
                                        <FolderInput className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setConfirmDeleteFileId(file.id)}
                                        className="p-1.5 rounded hover:bg-rose-50 text-slate-600 hover:text-rose-600 cursor-pointer"
                                        title="Elimina"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              )}
            </>
          )}
        </div>
      </div>

      {/* Toast discreto */}
      {toastMsg && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
          <Check className="w-3.5 h-3.5 text-emerald-400" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* =================================================================
          MODALE CREA / MODIFICA CARTELLA
      ================================================================= */}
      {folderModalMode && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-sm font-bold text-slate-900">
                {folderModalMode === 'create' ? 'Nuova Cartella' : 'Modifica Cartella'}
              </h3>
              <button
                type="button"
                onClick={() => setFolderModalMode(null)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitFolderModal} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Nome Cartella *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={folderNameInput}
                  onChange={(e) => setFolderNameInput(e.target.value)}
                  placeholder="es. DDT Clienti, Schemi PDF, Commessa COM-001..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Collega a Commessa (opzionale)
                </label>
                <select
                  value={folderCommessaInput}
                  onChange={(e) => setFolderCommessaInput(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:border-blue-600"
                >
                  <option value="">Nessuna commessa specifica</option>
                  {loads.map((l) => (
                    <option key={l.id} value={l.code}>
                      {l.code} — {l.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1.5">
                  Colore Cartella
                </label>
                <div className="flex items-center gap-2">
                  {(Object.keys(FOLDER_COLORS) as FolderColorKey[]).map((key) => {
                    const cfg = FOLDER_COLORS[key];
                    const active = folderColorInput === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setFolderColorInput(key)}
                        className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer ${
                          active
                            ? 'border-slate-900 bg-slate-900 text-white'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span className={`w-2.5 h-2.5 rounded-full ${cfg.dotClass}`} />
                        <span>{cfg.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setFolderModalMode(null)}
                  className="px-3.5 py-2 text-slate-600 hover:text-slate-900 font-semibold cursor-pointer"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold cursor-pointer"
                >
                  {folderModalMode === 'create' ? 'Crea Cartella' : 'Salva Modifiche'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================
          MODALE RINOMINA / SPOSTA FILE
      ================================================================= */}
      {editingFile && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-sm font-bold text-slate-900">
                Modifica / Sposta File
              </h3>
              <button
                type="button"
                onClick={() => setEditingFile(null)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitEditFile} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Nome File
                </label>
                <input
                  type="text"
                  required
                  value={fileNameInput}
                  onChange={(e) => setFileNameInput(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Cartella di destinazione
                </label>
                <select
                  value={fileMoveFolderId}
                  onChange={(e) => setFileMoveFolderId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:border-blue-600"
                >
                  <option value="">Archivio Principale (Radice)</option>
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                      {f.commessaCode ? ` (${f.commessaCode})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingFile(null)}
                  className="px-3.5 py-2 text-slate-600 hover:text-slate-900 font-semibold cursor-pointer"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold cursor-pointer"
                >
                  Salva
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================
          MODALE IMPORTA FOTO DALL'APP FOTO
      ================================================================= */}
      {showPhotoPicker && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Importa Foto dall&apos;App Foto
                </h3>
                <p className="text-xs text-slate-500">
                  Seleziona le foto da copiare in{' '}
                  <strong>{currentFolder ? currentFolder.name : 'Archivio Principale'}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPhotoPicker(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <select
                value={photoPickerCommessa}
                onChange={(e) => setPhotoPickerCommessa(e.target.value)}
                className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-300 rounded-lg"
              >
                <option value="all">Tutte le Commesse ({appPhotosList.length} foto)</option>
                {loads.map((l) => (
                  <option key={l.id} value={l.code}>
                    {l.code} — {l.title}
                  </option>
                ))}
              </select>

              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() =>
                    setSelectedPhotoIds(new Set(filteredAppPhotos.map((p) => p.id)))
                  }
                  className="text-blue-700 font-semibold hover:underline cursor-pointer"
                >
                  Seleziona tutte ({filteredAppPhotos.length})
                </button>
                {selectedPhotoIds.size > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedPhotoIds(new Set())}
                    className="text-slate-500 hover:text-slate-800 cursor-pointer"
                  >
                    Deseleziona
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {loadingAppPhotos ? (
                <div className="py-16 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Caricamento foto dall&apos;App Foto...</span>
                </div>
              ) : filteredAppPhotos.length === 0 ? (
                <div className="py-16 text-center text-xs text-slate-500">
                  Nessuna foto presente nell&apos;App Foto per questa selezione.
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2.5">
                  {filteredAppPhotos.map((photo) => {
                    const isPicked = selectedPhotoIds.has(photo.id);
                    return (
                      <button
                        key={photo.id}
                        type="button"
                        onClick={() => {
                          setSelectedPhotoIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(photo.id)) next.delete(photo.id);
                            else next.add(photo.id);
                            return next;
                          });
                        }}
                        className={`relative aspect-square rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${
                          isPicked
                            ? 'border-blue-600 ring-2 ring-blue-600/30'
                            : 'border-slate-200 hover:border-slate-400'
                        }`}
                      >
                        <img
                          src={photo.imageUrl}
                          alt={photo.caption || photo.commessaCode}
                          className="w-full h-full object-cover"
                        />
                        <div
                          className={`absolute top-1.5 left-1.5 w-5 h-5 rounded-full border flex items-center justify-center ${
                            isPicked
                              ? 'bg-blue-600 border-blue-600 text-white'
                              : 'bg-black/40 border-white text-transparent'
                          }`}
                        >
                          <Check className="w-3 h-3" />
                        </div>
                        <div className="absolute inset-x-0 bottom-0 bg-black/70 px-1.5 py-1 text-[10px] text-white font-mono truncate">
                          {photo.commessaCode}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-2">
              <span className="text-xs font-mono text-slate-600">
                {selectedPhotoIds.size} foto selezionate
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowPhotoPicker(false)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Annulla
                </button>
                <button
                  type="button"
                  disabled={selectedPhotoIds.size === 0 || isImportingPhotos}
                  onClick={handleImportSelectedAppPhotos}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-bold cursor-pointer flex items-center gap-1.5"
                >
                  {isImportingPhotos && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Importa nella Cartella</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================
          MODALE ANTEPRIMA FILE (PORTAL SU DOCUMENT.BODY)
      ================================================================= */}
      {previewFile &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 h-[100dvh] w-screen z-[9999] bg-slate-950/90 text-white flex flex-col">
            <div className="px-4 py-3 bg-black/80 border-b border-white/10 flex items-center justify-between gap-3 shrink-0">
              <div className="min-w-0">
                <div className="text-sm font-bold truncate">{previewFile.name}</div>
                <div className="text-[11px] font-mono text-slate-400">
                  {formatFileSize(previewFile.sizeBytes)} ·{' '}
                  {previewFile.extension.toUpperCase()} ·{' '}
                  {new Date(previewFile.updatedAt).toLocaleString('it-IT')}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => triggerFileManagerDownload(previewFile)}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Scarica
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteFile(previewFile)}
                  className="px-3 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600 border border-rose-500/40 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Elimina
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewFile(null)}
                  className="p-2 rounded-lg bg-white/10 hover:bg-white/25 text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 min-h-0 flex items-center justify-center p-4 overflow-hidden">
              {getFileTypeMeta(previewFile).kind === 'image' ? (
                <img
                  src={previewFile.fileUrl}
                  alt={previewFile.name}
                  className="max-w-full max-h-full object-contain rounded"
                />
              ) : getFileTypeMeta(previewFile).kind === 'pdf' ? (
                <iframe
                  title={previewFile.name}
                  src={previewFile.fileUrl}
                  className="w-full h-full bg-white rounded-lg border border-white/10"
                />
              ) : (
                <div className="bg-slate-900 border border-white/15 rounded-xl p-8 text-center max-w-md space-y-3">
                  <FileSpreadsheet className="w-12 h-12 text-emerald-400 mx-auto" />
                  <div className="text-sm font-bold">{previewFile.name}</div>
                  <p className="text-xs text-slate-300">
                    Questo formato ({previewFile.extension.toUpperCase()}) è salvato nell&apos;archivio e pronto per il download sul tuo computer o telefono.
                  </p>
                  <button
                    type="button"
                    onClick={() => triggerFileManagerDownload(previewFile)}
                    className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    Scarica File
                  </button>
                </div>
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
