/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus } from 'lucide-react';
import {
  AuthUser,
  BOX_SPECS,
  BoxType,
  CalendarEventRecord,
  CalendarRecord,
  CargoBox,
  CargoLoad,
  CargoPallet,
  ChecklistItem,
  CrmContact,
  DdtDocument,
  ElectronicSignature,
  FinishingCartello,
  PackageVerificationProof,
  PALLET_SPECS,
  PalletType,
  PurchaseOrder,
  ServerNotificationRecord,
  ShipmentHandoverProof,
  StockMovement,
  WarehouseInventoryState,
  WarehouseStockItem,
} from './types/warehouse';
import { INITIAL_LOADS } from './data/initialLoads';
import {
  calculateLoadSummary,
  exportLoadToCSV,
  saveCommessaToPCFolder,
} from './utils/calculations';
import { SynologyDesktopOS, SynologyAppId } from './components/SynologyDesktopOS';
import { UnifiedNotification } from './components/NotificationCenter';
import { ChecklistWorkspace } from './components/ChecklistWorkspace';
import { HierarchicalLoadTree } from './components/HierarchicalLoadTree';
import { Pallet3DVisualizer } from './components/Pallet3DVisualizer';
import { PalletWeightsWorkspace } from './components/PalletWeightsWorkspace';
import { PaintingTagsWorkspace } from './components/PaintingTagsWorkspace';
import { StockMovementsWorkspace } from './components/StockMovementsWorkspace';
import { CommessaPhotosApp } from './components/CommessaPhotosApp';
import { FileManagerApp } from './components/FileManagerApp';
import { WarehouseCatalogApp } from './components/WarehouseCatalogApp';
import { TeamShareApp } from './components/TeamShareApp';
import { EmployerHubApp } from './components/EmployerHubApp';
import { WeatherApp } from './components/WeatherApp';
import { ClockApp } from './components/ClockApp';
import { CalendarApp } from './components/CalendarApp';
import { ServerMonitorApp } from './components/ServerMonitorApp';
import { ServerControlPanelApp } from './components/ServerControlPanelApp';
import {
  SoftwareUpdateApp,
  ServerUpdateStatusPayload,
  DesktopUpdaterState,
} from './components/SoftwareUpdateApp';
import { DdtDocumentsApp } from './components/DdtDocumentsApp';
import { ClientsSuppliersApp } from './components/ClientsSuppliersApp';
import { PurchaseOrdersApp } from './components/PurchaseOrdersApp';
import { TiMiniPrintApp } from './components/TiMiniPrintApp';
import { PalletTruckScannerApp } from './components/PalletTruckScannerApp';
import { ExcelChecklistMergerApp } from './components/ExcelChecklistMergerApp';
import { TruckLoadPlanner } from './components/TruckLoadPlanner';
import { SignaturesWorkspace } from './components/SignaturesWorkspace';
import { PrintablePackingModal } from './components/PrintablePackingModal';
import {
  KitGeneratorModal,
  CreateKitPayload,
} from './components/KitGeneratorModal';
import { NetworkSyncPwaModal } from './components/NetworkSyncPwaModal';
import { PdfTranslatorModal } from './components/PdfTranslatorModal';
import { DigitalPackingListViewer } from './components/DigitalPackingListViewer';
import { QrLabelsA4Workspace } from './components/QrLabelsA4Workspace';
import { QrTrackingScanView } from './components/QrTrackingScanView';
import { AuthScreen } from './components/AuthScreen';
import {
  MetatronBootSplash,
  MetatronSplashMode,
} from './components/MetatronBootSplash';
import {
  AppTutorialGuide,
  loadTutorialPreferences,
  saveTutorialPreferences,
  TutorialPreferences,
} from './components/AppTutorialGuide';
import { TutorialContextId } from './data/appTutorials';
import {
  collectBoxTreeIds,
  collectPalletBoxIds,
  ResolvedTrackingRecord,
  TrackEntityType,
} from './utils/qrTrackingUtils';
import {
  getPackingListPdfBlobUrl,
  openPdfBlobInNewTab,
} from './utils/pdfGenerator';
import { useRealtimeSync, SYNC_CLIENT_ID } from './hooks/useRealtimeSync';
import { syncAllLoadsToServer } from './utils/cloudSync';
import {
  authFetch,
  clearAuthSession,
  setActiveUserId,
  setAuthToken as setSessionAuthToken,
} from './utils/authSession';

const STORAGE_KEY = 'caricostudio_loads_v5_win11';
const INVENTORY_STORAGE_KEY = 'caricostudio_inventory_v1';
const AUTO_SYNC_STOCK_KEY = 'caricostudio_autosync_stock_v1';
const CRM_STORAGE_KEY = 'caricostudio_crm_v1';
const DDT_STORAGE_KEY = 'caricostudio_ddt_v1';
const PO_STORAGE_KEY = 'caricostudio_purchase_orders_v1';

function createStarterLoadForUser(user: AuthUser): CargoLoad {
  return {
    id: `load-${Date.now()}`,
    code: 'COM-001',
    title: 'Prima Commessa Spedizione',
    client: user.company || 'Cliente Spedizione',
    destination: 'Destinazione Consegna',
    carrier: 'Motrice 12 EPAL',
    departureDate: new Date().toISOString().slice(0, 10),
    vehicleMaxPallets: 12,
    vehicleMaxWeightKg: 4500,
    status: 'in_preparazione',
    pallets: [],
    boxes: [],
    items: [],
    signatures: [],
  };
}

export default function App() {
  useEffect(() => {
    document.documentElement.classList.remove('dark');
  }, []);

  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [isRestoringSession, setIsRestoringSession] = useState<boolean>(
    () => typeof window !== 'undefined' && window.location.protocol !== 'file:'
  );
  const [isUserWorkspaceReady, setIsUserWorkspaceReady] = useState<boolean>(false);
  const [metatronSplash, setMetatronSplash] = useState<{
    mode: MetatronSplashMode;
    userName: string;
  } | null>(null);

  const [activeTutorialContext, setActiveTutorialContext] =
    useState<TutorialContextId>('desktop');
  const [tutorialPrefs, setTutorialPrefs] = useState<TutorialPreferences>({
    disableAll: false,
    dismissedIds: [],
  });
  const [sessionSkippedTutorials, setSessionSkippedTutorials] = useState<
    TutorialContextId[]
  >([]);
  const [isTutorialOpen, setIsTutorialOpen] = useState<boolean>(false);

  const userLoadsStorageKey = authUser ? `${STORAGE_KEY}_${authUser.id}` : '';
  const userInventoryStorageKey = authUser
    ? `${INVENTORY_STORAGE_KEY}_${authUser.id}`
    : '';
  const userAutoSyncKey = authUser ? `${AUTO_SYNC_STOCK_KEY}_${authUser.id}` : '';

  const [photoAppTargetCommessaId, setPhotoAppTargetCommessaId] = useState<string | null>(
    null
  );

  const [loads, setLoads] = useState<CargoLoad[]>(INITIAL_LOADS);
  const [activeLoadId, setActiveLoadId] = useState<string>(INITIAL_LOADS[0].id);

  const [selected3DPalletId, setSelected3DPalletId] = useState<string>('all');
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);
  const [showNewLoadModal, setShowNewLoadModal] = useState<boolean>(false);
  const [showKitModal, setShowKitModal] = useState<boolean>(false);
  const [showPdfTranslator, setShowPdfTranslator] = useState<boolean>(false);
  const [showDigitalViewer, setShowDigitalViewer] = useState<boolean>(false);
  const [showNetworkSyncModal, setShowNetworkSyncModal] = useState<boolean>(false);
  const [scannedTrackParam, setScannedTrackParam] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const sp = new URLSearchParams(window.location.search);
      return sp.get('track') || (window.location.pathname === '/t' ? sp.get('d') : null);
    } catch {
      return null;
    }
  });

  // Stato Magazzino Carico / Scarico Materiale isolato per utente
  const [inventory, setInventory] = useState<WarehouseInventoryState>({
    items: [],
    movements: [],
    categories: undefined,
    hiddenCommessaCodes: [],
  });

  // Stato dedicato per le 3 app aziendali: Clienti & Fornitori, DDT & Bolle, Ordini Fornitori
  const [crmContacts, setCrmContacts] = useState<CrmContact[]>([]);
  const [ddtDocuments, setDdtDocuments] = useState<DdtDocument[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [ddtInitialCommessaId, setDdtInitialCommessaId] = useState<string | null>(null);
  const [ddtInitialClientId, setDdtInitialClientId] = useState<string | null>(null);
  const [poInitialSupplierId, setPoInitialSupplierId] = useState<string | null>(null);

  // Stato Centro Notifiche + Calendari (condivisi & personali)
  const [serverNotifications, setServerNotifications] = useState<
    ServerNotificationRecord[]
  >([]);
  const [localAlarmNotifications, setLocalAlarmNotifications] = useState<
    UnifiedNotification[]
  >([]);
  const [calendarRecords, setCalendarRecords] = useState<CalendarRecord[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEventRecord[]>([]);
  const [calendarSyncVersion, setCalendarSyncVersion] = useState<number>(0);
  const [readDerivedIds, setReadDerivedIds] = useState<string[]>([]);
  const [dismissedDerivedIds, setDismissedDerivedIds] = useState<string[]>([]);
  const [serverUpdateStatus, setServerUpdateStatus] =
    useState<ServerUpdateStatusPayload | null>(null);
  const [desktopUpdaterState, setDesktopUpdaterState] =
    useState<DesktopUpdaterState | null>(null);

  const persistNotifLocalState = useCallback(
    (userId: string, readIds: string[], dismissedIds: string[]) => {
      try {
        localStorage.setItem(
          `caricostudio_notif_state_${userId}`,
          JSON.stringify({
            readIds: readIds.slice(-300),
            dismissedIds: dismissedIds.slice(-300),
          })
        );
      } catch {
        // Ignore storage quota errors
      }
    },
    []
  );

  const loadCalendarAndNotificationsFromServer = useCallback(async () => {
    if (typeof window === 'undefined' || window.location.protocol === 'file:') return;
    try {
      const [notifRes, calsRes, eventsRes] = await Promise.all([
        authFetch('/api/notifications').catch(() => null),
        authFetch('/api/calendars').catch(() => null),
        authFetch('/api/calendar/events').catch(() => null),
      ]);
      if (notifRes && notifRes.ok) {
        const d = await notifRes.json();
        if (Array.isArray(d?.notifications)) {
          setServerNotifications(d.notifications);
        }
      }
      if (calsRes && calsRes.ok) {
        const d = await calsRes.json();
        if (Array.isArray(d?.calendars)) {
          setCalendarRecords(d.calendars);
        }
      }
      if (eventsRes && eventsRes.ok) {
        const d = await eventsRes.json();
        if (Array.isArray(d?.events)) {
          setCalendarEvents(d.events);
        }
      }
    } catch {
      // Ignore offline errors
    }
  }, []);

  const handleAuthenticated = useCallback(
    async (
      user: AuthUser,
      token: string,
      migratedLegacy = false,
      authMode: 'login' | 'register' = 'login',
      options?: { skipSplash?: boolean }
    ) => {
      setSessionAuthToken(token);
      setActiveUserId(user.id);
      setIsUserWorkspaceReady(false);
      if (!options?.skipSplash) {
        setMetatronSplash({ mode: authMode, userName: user.name });
      }
      setAuthToken(token);
      setAuthUser(user);

      // Carica preferenze tutorial dell'utente
      const prefs = loadTutorialPreferences(user.id);
      setTutorialPrefs(prefs);
      setSessionSkippedTutorials([]);
      setActiveTutorialContext('desktop');
      if (!prefs.disableAll && !prefs.dismissedIds.includes('desktop')) {
        setIsTutorialOpen(true);
      } else {
        setIsTutorialOpen(false);
      }

      const loadsKey = `${STORAGE_KEY}_${user.id}`;
      const invKey = `${INVENTORY_STORAGE_KEY}_${user.id}`;
      const syncKey = `${AUTO_SYNC_STOCK_KEY}_${user.id}`;

      try {
        const savedAuto = localStorage.getItem(syncKey);
        setAutoSyncStockWithPacking(savedAuto !== 'false');
      } catch {
        setAutoSyncStockWithPacking(true);
      }

      // Carica i dati isolati dal server (con fallback su cache locale dell'utente)
      let resolvedLoads: CargoLoad[] | null = null;
      let resolvedInv: WarehouseInventoryState | null = null;
      let resolvedCrm: CrmContact[] | null = null;
      let resolvedDdt: DdtDocument[] | null = null;
      let resolvedPo: PurchaseOrder[] | null = null;

      if (typeof window !== 'undefined' && window.location.protocol !== 'file:') {
        try {
          const [loadsRes, invRes, crmRes, ddtRes, poRes] = await Promise.all([
            authFetch('/api/loads').catch(() => null),
            authFetch('/api/inventory').catch(() => null),
            authFetch('/api/crm').catch(() => null),
            authFetch('/api/ddt').catch(() => null),
            authFetch('/api/purchase-orders').catch(() => null),
          ]);
          const loadsJson = loadsRes && loadsRes.ok ? await loadsRes.json() : null;
          const invJson = invRes && invRes.ok ? await invRes.json() : null;
          const crmJson = crmRes && crmRes.ok ? await crmRes.json() : null;
          const ddtJson = ddtRes && ddtRes.ok ? await ddtRes.json() : null;
          const poJson = poRes && poRes.ok ? await poRes.json() : null;
          if (Array.isArray(loadsJson?.loads) && loadsJson.loads.length > 0) {
            resolvedLoads = loadsJson.loads;
          }
          if (
            invJson?.inventory &&
            Array.isArray(invJson.inventory.items) &&
            Array.isArray(invJson.inventory.movements)
          ) {
            resolvedInv = {
              items: invJson.inventory.items,
              movements: invJson.inventory.movements,
              ...(Array.isArray(invJson.inventory.categories)
                ? { categories: invJson.inventory.categories }
                : {}),
              hiddenCommessaCodes: Array.isArray(invJson.inventory.hiddenCommessaCodes)
                ? invJson.inventory.hiddenCommessaCodes
                : [],
            };
          }
          if (Array.isArray(crmJson?.contacts)) resolvedCrm = crmJson.contacts;
          if (Array.isArray(ddtJson?.documents)) resolvedDdt = ddtJson.documents;
          if (Array.isArray(poJson?.orders)) resolvedPo = poJson.orders;
        } catch {
          // fallback locale sotto
        }
      }

      if (!resolvedLoads) {
        try {
          const localUserLoads = localStorage.getItem(loadsKey);
          if (localUserLoads) {
            const parsed = JSON.parse(localUserLoads);
            if (Array.isArray(parsed) && parsed.length > 0) resolvedLoads = parsed;
          }
        } catch {}
      }

      if (!resolvedLoads && migratedLegacy) {
        try {
          const legacyLocal = localStorage.getItem(STORAGE_KEY);
          if (legacyLocal) {
            const parsed = JSON.parse(legacyLocal);
            if (Array.isArray(parsed) && parsed.length > 0) resolvedLoads = parsed;
          }
        } catch {}
      }

      if (!resolvedLoads || resolvedLoads.length === 0) {
        resolvedLoads = [createStarterLoadForUser(user)];
      }

      if (!resolvedInv) {
        try {
          const localUserInv = localStorage.getItem(invKey);
          if (localUserInv) {
            const parsed = JSON.parse(localUserInv);
            if (parsed && Array.isArray(parsed.items) && Array.isArray(parsed.movements)) {
              resolvedInv = {
                items: parsed.items,
                movements: parsed.movements,
                ...(Array.isArray(parsed.categories)
                  ? { categories: parsed.categories }
                  : {}),
                hiddenCommessaCodes: Array.isArray(parsed.hiddenCommessaCodes)
                  ? parsed.hiddenCommessaCodes
                  : [],
              };
            }
          }
        } catch {}
      }

      if (!resolvedInv && migratedLegacy) {
        try {
          const legacyInv = localStorage.getItem(INVENTORY_STORAGE_KEY);
          if (legacyInv) {
            const parsed = JSON.parse(legacyInv);
            if (parsed && Array.isArray(parsed.items) && Array.isArray(parsed.movements)) {
              resolvedInv = {
                items: parsed.items,
                movements: parsed.movements,
                ...(Array.isArray(parsed.categories)
                  ? { categories: parsed.categories }
                  : {}),
                hiddenCommessaCodes: Array.isArray(parsed.hiddenCommessaCodes)
                  ? parsed.hiddenCommessaCodes
                  : [],
              };
            }
          }
        } catch {}
      }

      if (!resolvedInv) {
        resolvedInv = { items: [], movements: [], categories: [], hiddenCommessaCodes: [] };
      }

      // Carica preferenze notifiche locali salvate per l'utente
      try {
        const rawNotifState = localStorage.getItem(`caricostudio_notif_state_${user.id}`);
        if (rawNotifState) {
          const parsed = JSON.parse(rawNotifState);
          setReadDerivedIds(Array.isArray(parsed?.readIds) ? parsed.readIds : []);
          setDismissedDerivedIds(
            Array.isArray(parsed?.dismissedIds) ? parsed.dismissedIds : []
          );
        } else {
          setReadDerivedIds([]);
          setDismissedDerivedIds([]);
        }
      } catch {
        setReadDerivedIds([]);
        setDismissedDerivedIds([]);
      }
      setLocalAlarmNotifications([]);

      if (!resolvedCrm) {
        try {
          const rawCrm = localStorage.getItem(`${CRM_STORAGE_KEY}_${user.id}`);
          const parsed = rawCrm ? JSON.parse(rawCrm) : null;
          resolvedCrm = Array.isArray(parsed) ? parsed : [];
        } catch {
          resolvedCrm = [];
        }
      }
      if (!resolvedDdt) {
        try {
          const rawDdt = localStorage.getItem(`${DDT_STORAGE_KEY}_${user.id}`);
          const parsed = rawDdt ? JSON.parse(rawDdt) : null;
          resolvedDdt = Array.isArray(parsed) ? parsed : [];
        } catch {
          resolvedDdt = [];
        }
      }
      if (!resolvedPo) {
        try {
          const rawPo = localStorage.getItem(`${PO_STORAGE_KEY}_${user.id}`);
          const parsed = rawPo ? JSON.parse(rawPo) : null;
          resolvedPo = Array.isArray(parsed) ? parsed : [];
        } catch {
          resolvedPo = [];
        }
      }

      setLoads(resolvedLoads);
      setActiveLoadId(resolvedLoads[0].id);
      setInventory(resolvedInv);
      setCrmContacts(resolvedCrm);
      setDdtDocuments(resolvedDdt);
      setPurchaseOrders(resolvedPo);
      setIsUserWorkspaceReady(true);

      // Carica notifiche server e calendari in background
      loadCalendarAndNotificationsFromServer();
    },
    [loadCalendarAndNotificationsFromServer]
  );

  // Ripristina automaticamente la sessione dal cookie HttpOnly al ricaricamento della pagina
  useEffect(() => {
    if (typeof window === 'undefined' || window.location.protocol === 'file:') {
      setIsRestoringSession(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch('/api/auth/session', {
          method: 'GET',
          credentials: 'include',
          cache: 'no-store',
          headers: { 'X-Requested-With': 'XMLHttpRequest' },
        });
        if (!resp.ok || cancelled) return;
        const data = await resp.json().catch(() => null);
        if (
          !cancelled &&
          data?.ok &&
          data?.authenticated &&
          data?.user &&
          data?.token
        ) {
          await handleAuthenticated(data.user, data.token, false, 'login', {
            skipSplash: true,
          });
        }
      } catch {
        // Nessuna sessione attiva o server offline
      } finally {
        if (!cancelled) {
          setIsRestoringSession(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [handleAuthenticated]);

  const finalizeLogout = useCallback(() => {
    clearAuthSession();
    setAuthUser(null);
    setAuthToken(null);
    setMetatronSplash(null);
    setIsUserWorkspaceReady(false);
    setLoads(INITIAL_LOADS);
    setActiveLoadId(INITIAL_LOADS[0].id);
    setInventory({ items: [], movements: [], categories: [], hiddenCommessaCodes: [] });
    setServerNotifications([]);
    setLocalAlarmNotifications([]);
    setCalendarRecords([]);
    setCalendarEvents([]);
    setReadDerivedIds([]);
    setDismissedDerivedIds([]);
    setServerUpdateStatus(null);
    setIsTutorialOpen(false);
    setStatusNotice(null);
  }, []);

  // Ascolta eventi dell'auto-updater nativo Electron quando in esecuzione come software desktop
  useEffect(() => {
    const bridge = (
      window as unknown as {
        metatronDesktop?: {
          updater?: {
            getState: () => Promise<DesktopUpdaterState>;
            onStateChange: (cb: (state: DesktopUpdaterState) => void) => () => void;
          };
        };
      }
    ).metatronDesktop;
    if (!bridge?.updater) return;
    let active = true;
    bridge.updater
      .getState()
      .then((st) => {
        if (active && st) setDesktopUpdaterState(st);
      })
      .catch(() => {});
    const unsub = bridge.updater.onStateChange((nextState) => {
      if (active) setDesktopUpdaterState(nextState);
    });
    return () => {
      active = false;
      if (typeof unsub === 'function') unsub();
    };
  }, []);

  // Controllo periodico automatico degli aggiornamenti (avvio + ogni 30 minuti)
  useEffect(() => {
    if (!authUser || !authToken || window.location.protocol === 'file:') return;
    let cancelled = false;
    const runCheck = async (allowRemoteCheck: boolean) => {
      try {
        const statusResp = await authFetch('/api/system/updates/status');
        if (!statusResp.ok || cancelled) return;
        const statusData = await statusResp.json().catch(() => null);
        if (!statusData?.ok || !statusData?.status || cancelled) return;
        setServerUpdateStatus(statusData.status);

        if (
          allowRemoteCheck &&
          statusData.status.config?.autoCheckEnabled &&
          statusData.status.config?.githubRepo
        ) {
          const lastChecked = statusData.status.config.lastCheckedAt
            ? new Date(statusData.status.config.lastCheckedAt).getTime()
            : 0;
          if (Date.now() - lastChecked > 15 * 60 * 1000) {
            const checkResp = await authFetch('/api/system/updates/check', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({}),
            });
            if (checkResp.ok && !cancelled) {
              const checkData = await checkResp.json().catch(() => null);
              if (checkData?.ok && checkData?.status) {
                setServerUpdateStatus(checkData.status);
              }
            }
          }
        }
      } catch {
        // Offline o GitHub non raggiungibile
      }
    };

    const initialTimer = window.setTimeout(() => runCheck(true), 3000);
    const interval = window.setInterval(() => runCheck(true), 30 * 60 * 1000);
    return () => {
      cancelled = true;
      window.clearTimeout(initialTimer);
      window.clearInterval(interval);
    };
  }, [authUser, authToken]);

  const handleLogout = useCallback(() => {
    authFetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    setIsTutorialOpen(false);
    setMetatronSplash({
      mode: 'logout',
      userName: authUser?.name || 'Utente',
    });
  }, [authUser]);

  const handleActiveTutorialContextChange = useCallback(
    (ctx: TutorialContextId) => {
      setActiveTutorialContext(ctx);
      if (!authUser) return;
      if (
        !tutorialPrefs.disableAll &&
        !tutorialPrefs.dismissedIds.includes(ctx) &&
        !sessionSkippedTutorials.includes(ctx)
      ) {
        setIsTutorialOpen(true);
      } else {
        setIsTutorialOpen(false);
      }
    },
    [authUser, tutorialPrefs, sessionSkippedTutorials]
  );

  const handleSkipTutorialSession = useCallback(() => {
    setSessionSkippedTutorials((prev) =>
      prev.includes(activeTutorialContext) ? prev : [...prev, activeTutorialContext]
    );
    setIsTutorialOpen(false);
  }, [activeTutorialContext]);

  const handleDontAskTutorialForApp = useCallback(
    (ctx: TutorialContextId) => {
      if (!authUser) {
        setIsTutorialOpen(false);
        return;
      }
      setTutorialPrefs((prev) => {
        const next: TutorialPreferences = {
          ...prev,
          dismissedIds: prev.dismissedIds.includes(ctx)
            ? prev.dismissedIds
            : [...prev.dismissedIds, ctx],
        };
        saveTutorialPreferences(authUser.id, next);
        return next;
      });
      setIsTutorialOpen(false);
    },
    [authUser]
  );

  const handleDontAskTutorialEver = useCallback(() => {
    if (!authUser) {
      setIsTutorialOpen(false);
      return;
    }
    setTutorialPrefs((prev) => {
      const next: TutorialPreferences = { ...prev, disableAll: true };
      saveTutorialPreferences(authUser.id, next);
      return next;
    });
    setIsTutorialOpen(false);
  }, [authUser]);

  const handleUpdateInventory = useCallback(
    (next: WarehouseInventoryState, notice?: string) => {
      const normalized: WarehouseInventoryState = {
        items: next.items,
        movements: next.movements,
        ...(next.categories !== undefined ? { categories: next.categories } : {}),
        hiddenCommessaCodes: next.hiddenCommessaCodes ?? [],
      };
      setInventory(normalized);
      if (userInventoryStorageKey) {
        try {
          localStorage.setItem(userInventoryStorageKey, JSON.stringify(normalized));
        } catch {
          // Ignore quota errors
        }
      }
      if (
        authToken &&
        typeof window !== 'undefined' &&
        window.location.protocol !== 'file:'
      ) {
        authFetch('/api/inventory', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ inventory: normalized }),
        }).catch(() => {
          // Offline fallback
        });
      }
      if (notice) {
        setStatusNotice(notice);
        setTimeout(() => setStatusNotice(null), 3500);
      }
    },
    [userInventoryStorageKey, authToken]
  );

  const handleUpdateCrmContacts = useCallback(
    (next: CrmContact[]) => {
      setCrmContacts(next);
      if (authUser) {
        try {
          localStorage.setItem(`${CRM_STORAGE_KEY}_${authUser.id}`, JSON.stringify(next));
        } catch {}
      }
      if (authToken && typeof window !== 'undefined' && window.location.protocol !== 'file:') {
        authFetch('/api/crm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contacts: next }),
        }).catch(() => {});
      }
    },
    [authUser, authToken]
  );

  const handleUpdateDdtDocuments = useCallback(
    (next: DdtDocument[]) => {
      setDdtDocuments(next);
      if (authUser) {
        try {
          localStorage.setItem(`${DDT_STORAGE_KEY}_${authUser.id}`, JSON.stringify(next));
        } catch {}
      }
      if (authToken && typeof window !== 'undefined' && window.location.protocol !== 'file:') {
        authFetch('/api/ddt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ documents: next }),
        }).catch(() => {});
      }
    },
    [authUser, authToken]
  );

  const handleUpdatePurchaseOrders = useCallback(
    (next: PurchaseOrder[]) => {
      setPurchaseOrders(next);
      if (authUser) {
        try {
          localStorage.setItem(`${PO_STORAGE_KEY}_${authUser.id}`, JSON.stringify(next));
        } catch {}
      }
      if (authToken && typeof window !== 'undefined' && window.location.protocol !== 'file:') {
        authFetch('/api/purchase-orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orders: next }),
        }).catch(() => {});
      }
    },
    [authUser, authToken]
  );

  // Automazione CaricoStudio <-> Carico/Scarico (spunta = scarico automatico, deselezione = carico rientro)
  const [autoSyncStockWithPacking, setAutoSyncStockWithPacking] = useState<boolean>(true);

  const handleToggleAutoSyncStockWithPacking = useCallback(
    (enabled: boolean) => {
      setAutoSyncStockWithPacking(enabled);
      if (userAutoSyncKey) {
        try {
          localStorage.setItem(userAutoSyncKey, String(enabled));
        } catch {}
      }
      setStatusNotice(
        enabled
          ? 'Automazione attiva: ogni spunta in CaricoStudio scarica automaticamente il magazzino'
          : 'Automazione spunta disattivata (resta attivo lo scarico manuale e su certificazione 101%)'
      );
      setTimeout(() => setStatusNotice(null), 3500);
    },
    [userAutoSyncKey]
  );

  // Automatically open digital packing list or direct PDF if URL contains ?digital_load=
  useEffect(() => {
    if (typeof window === 'undefined' || !authUser) return;
    try {
      const params = new URLSearchParams(window.location.search);
      const digitalLoadCode = params.get('digital_load');
      if (digitalLoadCode) {
        const matched = loads.find(
          (l) => l.code === digitalLoadCode || l.id === digitalLoadCode
        );
        const targetLoad = matched || loads[0];
        if (targetLoad) {
          setActiveLoadId(targetLoad.id);
        }
        setShowDigitalViewer(true);
      }
    } catch {
      // Ignore
    }
  }, [loads, authUser]);

  const [kitDefaultPalletId, setKitDefaultPalletId] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  // New Load Modal Form State
  const [newLoadCode, setNewLoadCode] = useState('');
  const [newLoadTitle, setNewLoadTitle] = useState('');
  const [newLoadClient, setNewLoadClient] = useState('');
  const [newLoadDest, setNewLoadDest] = useState('');
  const [newLoadCarrier, setNewLoadCarrier] = useState('Motrice 12 EPAL');
  const [newLoadMaxPallets, setNewLoadMaxPallets] = useState(12);
  const [newLoadMaxWeight, setNewLoadMaxWeight] = useState(4500);

  const handleRemoteLoadsUpdated = useCallback((remoteLoads: CargoLoad[]) => {
    setLoads(remoteLoads);
  }, []);

  const handleRealtimeServerEvent = useCallback(
    (msg: any) => {
      if (!msg || typeof msg !== 'object') return;
      if (msg.type === 'notification_new' && msg.notification && msg.notification.id) {
        const incoming: ServerNotificationRecord = msg.notification;
        setServerNotifications((prev) =>
          prev.some((n) => n.id === incoming.id) ? prev : [incoming, ...prev]
        );
        setStatusNotice(incoming.title);
        window.setTimeout(() => {
          setStatusNotice((prev) => (prev === incoming.title ? null : prev));
        }, 3800);
      } else if (msg.type === 'calendar_updated') {
        setCalendarSyncVersion((v) => v + 1);
        loadCalendarAndNotificationsFromServer();
      }
    },
    [loadCalendarAndNotificationsFromServer]
  );

  const handleClockTriggerNotification = useCallback((title: string, body: string) => {
    const item: UnifiedNotification = {
      id: `local_alarm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      source: 'local',
      category: 'alarm',
      title,
      body,
      targetApp: 'clock',
      timestamp: new Date().toISOString(),
      read: false,
    };
    setLocalAlarmNotifications((prev) => [item, ...prev].slice(0, 30));
    const msg = `${title} — ${body}`;
    setStatusNotice(msg);
    window.setTimeout(() => {
      setStatusNotice((prev) => (prev === msg ? null : prev));
    }, 4500);
  }, []);

  const unifiedNotifications = useMemo<UnifiedNotification[]>(() => {
    const list: UnifiedNotification[] = [];
    const readSet = new Set(readDerivedIds);
    const dismissedSet = new Set(dismissedDerivedIds);

    // 1. Notifiche dal server (Messaggi/File scambio team + Inviti/Eventi calendari condivisi)
    serverNotifications.forEach((n) => {
      const targetApp: SynologyAppId =
        (n.targetApp as SynologyAppId) ||
        (n.category === 'message' ? 'team_share' : 'calendar');
      list.push({
        id: n.id,
        source: 'server',
        category: n.category,
        title: n.title,
        body: n.body,
        targetApp,
        timestamp: n.createdAt,
        read: n.read,
      });
    });

    // 2. Sveglie & Timer scattati dall'app Orologio
    localAlarmNotifications.forEach((n) => {
      list.push(n);
    });

    // 3. Articoli sotto scorta dal Gestionale Magazzino
    inventory.items.forEach((item) => {
      if (item.quantity <= item.minStock) {
        const id = `derived_low_${item.id}_${item.quantity}_${item.minStock}`;
        if (dismissedSet.has(id)) return;
        list.push({
          id,
          source: 'derived',
          category: 'low_stock',
          title:
            item.quantity <= 0
              ? `Scorta ESAURITA: ${item.name}`
              : `Sotto scorta: ${item.name}`,
          body: `SKU ${item.sku} · Giacenza ${item.quantity} ${item.unit} (min. ${item.minStock})`,
          targetApp: 'warehouse_catalog',
          timestamp: item.updatedAt || new Date().toISOString(),
          read: readSet.has(id),
        });
      }
    });

    // 4. Ultimi carichi e scarichi del gestionale
    inventory.movements.slice(0, 15).forEach((m) => {
      const id = `derived_mov_${m.id}`;
      if (dismissedSet.has(id)) return;
      const isCarico = m.type === 'carico';
      list.push({
        id,
        source: 'derived',
        category: 'stock_movement',
        title: `${isCarico ? 'Carico' : 'Scarico'} ${isCarico ? '+' : '−'}${m.quantity} ${m.unit} · ${m.itemName}`,
        body: `SKU ${m.sku}${m.commessaCode ? ` · Commessa ${m.commessaCode}` : ''}${m.reason ? ` · ${m.reason}` : ''}`,
        targetApp: 'stock_movements',
        timestamp: m.timestamp,
        read: readSet.has(id),
        badgeText: isCarico ? 'CARICO' : 'SCARICO',
      });
    });

    // 5. Appuntamenti, promemoria e appunti del Calendario (Oggi e prossimi 3 giorni)
    const fmtLocalYmd = (offsetDays: number) => {
      const d = new Date();
      d.setDate(d.getDate() + offsetDays);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    const todayYmd = fmtLocalYmd(0);
    const tomorrowYmd = fmtLocalYmd(1);
    const horizonYmd = fmtLocalYmd(3);
    const calMap = new Map(calendarRecords.map((c) => [c.id, c.name]));

    calendarEvents.forEach((ev) => {
      if (ev.date < todayYmd || ev.date > horizonYmd) return;
      const id = `derived_cal_${ev.id}_${ev.date}`;
      if (dismissedSet.has(id)) return;
      const dayLabel =
        ev.date === todayYmd
          ? 'Oggi'
          : ev.date === tomorrowYmd
          ? 'Domani'
          : ev.date.split('-').reverse().join('/');
      const kindLabel =
        ev.kind === 'appunto'
          ? 'Appunto'
          : ev.kind === 'promemoria'
          ? 'Promemoria'
          : ev.kind === 'spedizione'
          ? 'Spedizione'
          : 'Appuntamento';
      const calName = calMap.get(ev.calendarId) || 'Calendario';
      list.push({
        id,
        source: 'derived',
        category: 'calendar',
        title: `${dayLabel}${ev.time ? ` ${ev.time}` : ''} · ${ev.title}`,
        body: `${kindLabel} (${calName})${ev.notes ? ` — ${ev.notes}` : ''}`,
        targetApp: 'calendar',
        timestamp: ev.updatedAt || ev.createdAt || new Date().toISOString(),
        read: readSet.has(id),
      });
    });

    // 6. Notifica Aggiornamento di Sistema disponibile (GitHub Release / Desktop Auto-Updater)
    const desktopHasUpdate =
      desktopUpdaterState &&
      (desktopUpdaterState.status === 'available' ||
        desktopUpdaterState.status === 'downloading' ||
        desktopUpdaterState.status === 'downloaded');
    const serverHasUpdate = Boolean(
      serverUpdateStatus?.updateAvailable &&
        serverUpdateStatus.config.lastKnownLatestVersion
    );
    if (desktopHasUpdate || serverHasUpdate) {
      const latestVer =
        desktopUpdaterState?.availableVersion ||
        serverUpdateStatus?.config.lastKnownLatestVersion ||
        'nuova';
      const updId = `derived_sys_update_${latestVer}`;
      if (!dismissedSet.has(updId)) {
        const isReadyToRestart = desktopUpdaterState?.status === 'downloaded';
        list.push({
          id: updId,
          source: 'derived',
          category: 'system_update',
          title: isReadyToRestart
            ? `Aggiornamento v${latestVer} pronto al riavvio`
            : `Nuovo aggiornamento disponibile: v${latestVer}`,
          body: isReadyToRestart
            ? 'Pacchetto scaricato. Apri Aggiornamenti per riavviare e applicarlo senza perdere i dati.'
            : 'Apri l’app Aggiornamenti per scaricare la nuova versione con backup automatico dei dati.',
          targetApp: 'software_updates',
          timestamp:
            serverUpdateStatus?.config.lastCheckedAt || new Date().toISOString(),
          read: readSet.has(updId),
        });
      }
    }

    return list.sort((a, b) => {
      if (a.read !== b.read) return a.read ? 1 : -1;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });
  }, [
    serverNotifications,
    localAlarmNotifications,
    inventory.items,
    inventory.movements,
    calendarRecords,
    calendarEvents,
    readDerivedIds,
    dismissedDerivedIds,
    serverUpdateStatus,
    desktopUpdaterState,
  ]);

  const handleMarkNotificationRead = useCallback(
    (item: UnifiedNotification) => {
      if (item.source === 'server') {
        setServerNotifications((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, read: true } : n))
        );
        authFetch('/api/notifications/read', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: item.id }),
        }).catch(() => {});
      } else if (item.source === 'local') {
        setLocalAlarmNotifications((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, read: true } : n))
        );
      } else if (authUser) {
        setReadDerivedIds((prev) => {
          if (prev.includes(item.id)) return prev;
          const next = [...prev, item.id];
          persistNotifLocalState(authUser.id, next, dismissedDerivedIds);
          return next;
        });
      }
    },
    [authUser, dismissedDerivedIds, persistNotifLocalState]
  );

  const handleMarkAllNotificationsRead = useCallback(() => {
    setServerNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    authFetch('/api/notifications/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true }),
    }).catch(() => {});
    setLocalAlarmNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    if (authUser) {
      const derivedIds = unifiedNotifications
        .filter((n) => n.source === 'derived')
        .map((n) => n.id);
      setReadDerivedIds((prev) => {
        const next = Array.from(new Set([...prev, ...derivedIds]));
        persistNotifLocalState(authUser.id, next, dismissedDerivedIds);
        return next;
      });
    }
  }, [authUser, dismissedDerivedIds, persistNotifLocalState, unifiedNotifications]);

  const handleDismissNotification = useCallback(
    (item: UnifiedNotification) => {
      if (item.source === 'server') {
        setServerNotifications((prev) => prev.filter((n) => n.id !== item.id));
        authFetch(`/api/notifications/${encodeURIComponent(item.id)}`, {
          method: 'DELETE',
        }).catch(() => {});
      } else if (item.source === 'local') {
        setLocalAlarmNotifications((prev) => prev.filter((n) => n.id !== item.id));
      } else if (authUser) {
        setDismissedDerivedIds((prev) => {
          if (prev.includes(item.id)) return prev;
          const next = [...prev, item.id];
          persistNotifLocalState(authUser.id, readDerivedIds, next);
          return next;
        });
      }
    },
    [authUser, persistNotifLocalState, readDerivedIds]
  );

  const {
    isConnected: isRealtimeConnected,
    activeUsersCount,
    lastSyncTime,
    broadcastLoads,
  } = useRealtimeSync({
    loads,
    onRemoteLoadsUpdated: handleRemoteLoadsUpdated,
    onServerEvent: handleRealtimeServerEvent,
    storageKey: userLoadsStorageKey,
    authToken,
    userId: authUser?.id || null,
  });

  useEffect(() => {
    if (!authUser || !authToken || !isUserWorkspaceReady || !userLoadsStorageKey) {
      return;
    }
    try {
      localStorage.setItem(userLoadsStorageKey, JSON.stringify(loads));
    } catch {
      // Ignore storage quota errors
    }
    const timer = setTimeout(() => {
      syncAllLoadsToServer(loads, SYNC_CLIENT_ID);
    }, 1500);
    return () => clearTimeout(timer);
  }, [loads, authUser, authToken, isUserWorkspaceReady, userLoadsStorageKey]);

  const showToast = (msg: string) => {
    setStatusNotice(msg);
    window.setTimeout(() => {
      setStatusNotice((prev) => (prev === msg ? null : prev));
    }, 3200);
  };

  const activeLoad = useMemo(() => {
    return loads.find((l) => l.id === activeLoadId) || loads[0];
  }, [loads, activeLoadId]);

  const summary = useMemo(() => {
    return calculateLoadSummary(activeLoad);
  }, [activeLoad]);

  const updateActiveLoad = (updater: (load: CargoLoad) => CargoLoad) => {
    setLoads((prev) => {
      const nextLoads = prev.map((l) => (l.id === activeLoad.id ? updater(l) : l));
      broadcastLoads(nextLoads);
      return nextLoads;
    });
  };

  // --- Project / Commessa Handlers ---
  const handleUpdateProjectName = (title: string, code: string) => {
    updateActiveLoad((load) => ({
      ...load,
      title,
      code,
    }));
    showToast(`Commessa rinominata: ${code} — ${title}`);
  };

  const handleDuplicateLoad = () => {
    const clonedLoad: CargoLoad = {
      ...JSON.parse(JSON.stringify(activeLoad)),
      id: `load-${Date.now()}`,
      code: `${activeLoad.code}-COPIA`,
      title: `${activeLoad.title} (Copia)`,
      departureDate: new Date().toISOString().slice(0, 10),
    };
    setLoads((prev) => {
      const nextLoads = [clonedLoad, ...prev];
      broadcastLoads(nextLoads);
      return nextLoads;
    });
    setActiveLoadId(clonedLoad.id);
    showToast(`Commessa duplicata: ${clonedLoad.code}`);
  };

  const handleSaveCommessaToFolder = async () => {
    const saved = await saveCommessaToPCFolder(activeLoad, loads);
    if (saved) {
      showToast(`Commessa "${activeLoad.title}" salvata nella cartella`);
    }
  };

  // --- Checklist Item Handlers (con Auto-Scarico / Auto-Rientro in Carico & Scarico) ---
  const handleToggleItemChecked = (itemId: string) => {
    const targetItem = activeLoad.items.find((it) => it.id === itemId);
    const willBeChecked = targetItem ? !targetItem.checked : false;
    const nowStamp = new Date().toISOString();

    updateActiveLoad((load) => ({
      ...load,
      loadedAt: willBeChecked ? load.loadedAt || nowStamp : load.loadedAt,
      items: load.items.map((item) =>
        item.id === itemId
          ? {
              ...item,
              checked: !item.checked,
              loadedAt: willBeChecked ? item.loadedAt || nowStamp : item.loadedAt,
            }
          : item
      ),
    }));

    if (targetItem && autoSyncStockWithPacking && targetItem.quantity > 0) {
      const nowIso = new Date().toISOString();
      const skuKey = (targetItem.sku || `ART-${targetItem.id.slice(-4)}`)
        .trim()
        .toUpperCase();
      const box = targetItem.boxId
        ? activeLoad.boxes.find((b) => b.id === targetItem.boxId)
        : null;
      const pallet = targetItem.palletId
        ? activeLoad.pallets.find((p) => p.id === targetItem.palletId)
        : null;
      const pkgCode = box?.code || pallet?.code || activeLoad.code;

      const nextItems = [...inventory.items];
      let stockIdx = nextItems.findIndex(
        (s) => s.sku.trim().toUpperCase() === skuKey
      );
      let stockItem: WarehouseStockItem;
      if (stockIdx === -1) {
        stockItem = {
          id: `stk-auto-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          sku: skuKey,
          name: targetItem.name || 'Articolo Commessa',
          category: targetItem.category?.trim() || '',
          unit: 'pz',
          quantity: 0,
          minStock: 2,
          location: 'Magazzino',
          updatedAt: nowIso,
        };
        nextItems.unshift(stockItem);
        stockIdx = 0;
      } else {
        stockItem = nextItems[stockIdx];
      }

      const previousQty = stockItem.quantity;
      const resultingQty = willBeChecked
        ? Math.max(0, Math.round((previousQty - targetItem.quantity) * 100) / 100)
        : Math.round((previousQty + targetItem.quantity) * 100) / 100;

      nextItems[stockIdx] = {
        ...stockItem,
        quantity: resultingQty,
        updatedAt: nowIso,
      };

      const autoMov: StockMovement = {
        id: `mov-auto-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        itemId: stockItem.id,
        sku: stockItem.sku,
        itemName: stockItem.name,
        unit: stockItem.unit,
        type: willBeChecked ? 'scarico' : 'carico',
        quantity: targetItem.quantity,
        previousQty,
        resultingQty,
        reason: willBeChecked
          ? `Scarico automatico imballo (${activeLoad.code})`
          : `Rientro automatico annullo spunta (${activeLoad.code})`,
        commessaCode: activeLoad.code,
        packageCode: pkgCode,
        operatorName: 'Auto CaricoStudio',
        timestamp: nowIso,
      };

      handleUpdateInventory(
        {
          ...inventory,
          items: nextItems,
          movements: [autoMov, ...inventory.movements],
        },
        willBeChecked
          ? `Auto-Scarico magazzino: ${skuKey} (−${targetItem.quantity} pz)`
          : `Auto-Carico rientro: ${skuKey} (+${targetItem.quantity} pz)`
      );
    }
  };

  // --- Certificazione Collo 101% Anti-Contestazione + Scarico Automatico Idempotente ---
  const handleCertifyPackageAndUnload = (
    proof: PackageVerificationProof,
    options: { autoUnloadStock: boolean }
  ) => {
    const nowIso = new Date().toISOString();
    const verifiedItemIds = new Set(proof.items.map((i) => i.itemId));
    const linkedMovementIds: string[] = [...(proof.linkedMovementIds || [])];

    if (options.autoUnloadStock && proof.items.length > 0) {
      const nextItems = [...inventory.items];
      const nextMovements = [...inventory.movements];

      proof.items.forEach((pItem, idx) => {
        const skuKey = pItem.sku.trim().toUpperCase();
        // Verifica se esiste già uno scarico netto attivo per questa commessa + SKU (es. da auto-spunta)
        const existingScaricoIdx = nextMovements.findIndex(
          (m) =>
            m.type === 'scarico' &&
            (m.commessaCode || '').toUpperCase() === activeLoad.code.toUpperCase() &&
            m.sku.trim().toUpperCase() === skuKey &&
            (!m.proofHash || m.packageCode === proof.targetCode)
        );

        if (existingScaricoIdx !== -1) {
          // Collega il movimento già scaricato al certificato 101% senza scaricare due volte!
          const updatedMov: StockMovement = {
            ...nextMovements[existingScaricoIdx],
            packageCode: proof.targetCode,
            sealNumber: proof.sealNumber,
            proofHash: proof.sha256Hash,
            reason: `Scarico certificato 101% (${proof.targetCode})`,
            operatorName: proof.operatorName,
          };
          nextMovements[existingScaricoIdx] = updatedMov;
          if (!linkedMovementIds.includes(updatedMov.id)) {
            linkedMovementIds.push(updatedMov.id);
          }
          return;
        }

        // Altrimenti registra il nuovo scarico certificato 101%
        let stockIdx = nextItems.findIndex(
          (s) => s.sku.trim().toUpperCase() === skuKey
        );
        let stockItem: WarehouseStockItem;
        if (stockIdx === -1) {
          stockItem = {
            id: `stk-cert-${Date.now()}-${idx}`,
            sku: skuKey,
            name: pItem.name,
            category: 'Generale',
            unit: 'pz',
            quantity: 0,
            minStock: 2,
            location: `Commessa ${activeLoad.code}`,
            updatedAt: nowIso,
          };
          nextItems.unshift(stockItem);
          stockIdx = 0;
        } else {
          stockItem = nextItems[stockIdx];
        }

        const previousQty = stockItem.quantity;
        const resultingQty = Math.max(
          0,
          Math.round((previousQty - pItem.countedQty) * 100) / 100
        );
        nextItems[stockIdx] = {
          ...stockItem,
          quantity: resultingQty,
          updatedAt: nowIso,
        };

        const newMovId = `mov-cert-${Date.now()}-${idx}`;
        nextMovements.unshift({
          id: newMovId,
          itemId: stockItem.id,
          sku: stockItem.sku,
          itemName: stockItem.name,
          unit: stockItem.unit,
          type: 'scarico',
          quantity: pItem.countedQty,
          previousQty,
          resultingQty,
          reason: `Scarico certificato 101% (${proof.targetCode})`,
          commessaCode: activeLoad.code,
          packageCode: proof.targetCode,
          sealNumber: proof.sealNumber,
          proofHash: proof.sha256Hash,
          operatorName: proof.operatorName,
          timestamp: nowIso,
        });
        linkedMovementIds.push(newMovId);
      });

      handleUpdateInventory({
        ...inventory,
        items: nextItems,
        movements: nextMovements,
      });
    }

    const finalProof: PackageVerificationProof = {
      ...proof,
      stockUnloaded: options.autoUnloadStock || proof.stockUnloaded,
      linkedMovementIds,
    };

    updateActiveLoad((load) => {
      const prevProofs = load.packingProofs || [];
      const existsIdx = prevProofs.findIndex(
        (p) =>
          p.targetId === finalProof.targetId &&
          p.targetType === finalProof.targetType
      );
      const nextProofs =
        existsIdx >= 0
          ? prevProofs.map((p, i) => (i === existsIdx ? finalProof : p))
          : [...prevProofs, finalProof];

      return {
        ...load,
        loadedAt: load.loadedAt || nowIso,
        packingProofs: nextProofs,
        items: load.items.map((it) =>
          verifiedItemIds.has(it.id)
            ? { ...it, checked: true, loadedAt: it.loadedAt || nowIso }
            : it
        ),
        boxes: load.boxes.map((b) =>
          finalProof.targetType === 'box' && b.id === finalProof.targetId
            ? { ...b, sealed: true, loadedAt: b.loadedAt || nowIso }
            : b
        ),
      };
    });

    showToast(
      `Collo ${finalProof.targetCode} certificato 101% (Sigillo ${finalProof.sealNumber})`
    );
  };

  const handleBatchUnloadCheckedItems = (operatorName: string) => {
    const checkedItems = activeLoad.items.filter((it) => it.checked && it.quantity > 0);
    if (checkedItems.length === 0) {
      showToast('Nessun articolo spuntato in CaricoStudio da scaricare');
      return;
    }

    const nowIso = new Date().toISOString();
    const nextItems = [...inventory.items];
    const nextMovements = [...inventory.movements];
    let unloadedCount = 0;

    checkedItems.forEach((ci, idx) => {
      const skuKey = (ci.sku || `ART-${idx + 1}`).trim().toUpperCase();
      const alreadyUnloaded = nextMovements.some(
        (m) =>
          m.type === 'scarico' &&
          (m.commessaCode || '').toUpperCase() === activeLoad.code.toUpperCase() &&
          m.sku.trim().toUpperCase() === skuKey
      );
      if (alreadyUnloaded) return;

      let stockIdx = nextItems.findIndex(
        (s) => s.sku.trim().toUpperCase() === skuKey
      );
      let stockItem: WarehouseStockItem;
      if (stockIdx === -1) {
        stockItem = {
          id: `stk-batch-${Date.now()}-${idx}`,
          sku: skuKey,
          name: ci.name || 'Articolo Commessa',
          category: ci.category || 'Generale',
          unit: 'pz',
          quantity: 0,
          minStock: 2,
          location: `Commessa ${activeLoad.code}`,
          updatedAt: nowIso,
        };
        nextItems.unshift(stockItem);
        stockIdx = 0;
      } else {
        stockItem = nextItems[stockIdx];
      }

      const previousQty = stockItem.quantity;
      const resultingQty = Math.max(
        0,
        Math.round((previousQty - ci.quantity) * 100) / 100
      );
      nextItems[stockIdx] = {
        ...stockItem,
        quantity: resultingQty,
        updatedAt: nowIso,
      };

      const box = ci.boxId
        ? activeLoad.boxes.find((b) => b.id === ci.boxId)
        : null;

      nextMovements.unshift({
        id: `mov-batch-${Date.now()}-${idx}`,
        itemId: stockItem.id,
        sku: stockItem.sku,
        itemName: stockItem.name,
        unit: stockItem.unit,
        type: 'scarico',
        quantity: ci.quantity,
        previousQty,
        resultingQty,
        reason: `Scarico automatico commessa ${activeLoad.code}`,
        commessaCode: activeLoad.code,
        packageCode: box?.code || activeLoad.code,
        operatorName: operatorName || 'Magazziniere',
        timestamp: nowIso,
      });
      unloadedCount++;
    });

    if (unloadedCount === 0) {
      showToast(`Tutti gli articoli spuntati di ${activeLoad.code} risultano già scaricati`);
      return;
    }

    handleUpdateInventory(
      {
        ...inventory,
        items: nextItems,
        movements: nextMovements,
      },
      `Scaricati automaticamente ${unloadedCount} articoli spuntati per ${activeLoad.code}`
    );
  };

  const handleMarkAllChecked = (checked: boolean) => {
    updateActiveLoad((load) => ({
      ...load,
      items: load.items.map((item) => ({ ...item, checked })),
    }));
  };

  const handleUpdateItemQuantity = (itemId: string, quantity: number) => {
    updateActiveLoad((load) => ({
      ...load,
      items: load.items.map((item) =>
        item.id === itemId ? { ...item, quantity } : item
      ),
    }));
  };

  const handleUpdateItemDetails = (
    itemId: string,
    updates: {
      name?: string;
      sku?: string;
      unitWeightKg?: number;
      fragile?: boolean;
      dimensionsCm?: string;
      photoDataUrl?: string;
    }
  ) => {
    updateActiveLoad((load) => ({
      ...load,
      items: load.items.map((item) =>
        item.id === itemId ? { ...item, ...updates } : item
      ),
    }));
  };

  const handleDuplicateItem = (itemId: string) => {
    updateActiveLoad((load) => {
      const target = load.items.find((i) => i.id === itemId);
      if (!target) return load;
      const copy: ChecklistItem = {
        ...target,
        id: `itm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        sku: `ART-${String(load.items.length + 1).padStart(3, '0')}`,
        name: `${target.name} (Copia)`,
      };
      return {
        ...load,
        items: [...load.items, copy],
      };
    });
    showToast('Articolo duplicato (Copia/Incolla)');
  };

  const handleAssignItemLocation = (
    itemId: string,
    palletId: string | null,
    boxId: string | null
  ) => {
    const nowIso = new Date().toISOString();
    updateActiveLoad((load) => ({
      ...load,
      loadedAt: palletId || boxId ? load.loadedAt || nowIso : load.loadedAt,
      items: load.items.map((item) =>
        item.id === itemId
          ? {
              ...item,
              palletId,
              boxId,
              loadedAt: palletId || boxId ? item.loadedAt || nowIso : item.loadedAt,
            }
          : item
      ),
    }));
  };

  const handleAddItem = (newItemData: Omit<ChecklistItem, 'id'>) => {
    const nowIso = new Date().toISOString();
    const newItem: ChecklistItem = {
      ...newItemData,
      id: `itm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      loadedAt:
        newItemData.loadedAt ||
        (newItemData.checked || newItemData.palletId || newItemData.boxId
          ? nowIso
          : undefined),
    };
    updateActiveLoad((load) => ({
      ...load,
      loadedAt: newItem.loadedAt ? load.loadedAt || nowIso : load.loadedAt,
      items: [...load.items, newItem],
    }));
  };

  const handleQuickAddItemToBox = (
    palletId: string | null,
    boxId: string | null,
    name: string,
    quantity: number,
    unitWeightKg: number,
    dimensionsCm?: string,
    photoDataUrl?: string
  ) => {
    const sku = `ART-${String(activeLoad.items.length + 1).padStart(3, '0')}`;
    handleAddItem({
      sku,
      name,
      category: boxId ? 'In Scatola' : 'Fuori Scatola',
      quantity,
      unitWeightKg,
      dimensionsCm,
      photoDataUrl,
      checked: true,
      fragile: false,
      palletId,
      boxId,
      notes: boxId ? 'Inserito in scatola' : 'Materiale fuori scatola sul bancale',
    });
  };

  const handleBulkAddLines = (linesText: string) => {
    const lines = linesText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length === 0) return;

    updateActiveLoad((load) => {
      const created: ChecklistItem[] = lines.map((line, idx) => {
        const parts = line.split(';').map((p) => p.trim());
        const name = parts[0] || `Articolo ${idx + 1}`;
        const qty = parts[1] ? Math.max(1, parseInt(parts[1], 10) || 1) : 1;
        const weight = parts[2]
          ? Math.max(0.05, parseFloat(parts[2].replace(',', '.')) || 1.0)
          : 1.0;

        return {
          id: `itm-${Date.now()}-${idx}`,
          sku: `ART-${String(load.items.length + idx + 1).padStart(3, '0')}`,
          name,
          category: 'Generale',
          quantity: qty,
          unitWeightKg: weight,
          checked: false,
          fragile: false,
          palletId: null,
          boxId: null,
          notes: '',
        };
      });

      return {
        ...load,
        items: [...load.items, ...created],
      };
    });
  };

  const handleDeleteItem = (itemId: string) => {
    updateActiveLoad((load) => ({
      ...load,
      items: load.items.filter((i) => i.id !== itemId),
    }));
  };

  // --- Scanner Carico Bancale & Camion: carica/somma articolo sul bancale/scatola ---
  const handleScanPackItemToLoad = (payload: {
    loadId: string;
    sku: string;
    name: string;
    category: string;
    quantity: number;
    palletId: string | null;
    boxId: string | null;
    notes?: string;
  }): { itemId: string; merged: boolean } => {
    const nowIso = new Date().toISOString();
    const targetSkuUpper = payload.sku.trim().toUpperCase();
    let resultItemId = `itm-scan-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 6)}`;
    let wasMerged = false;

    setLoads((prevLoads) => {
      const nextLoads = prevLoads.map((ld) => {
        if (ld.id !== payload.loadId) return ld;
        const existingIdx = ld.items.findIndex(
          (it) =>
            it.sku.trim().toUpperCase() === targetSkuUpper &&
            (it.palletId || null) === (payload.palletId || null) &&
            (it.boxId || null) === (payload.boxId || null)
        );

        let nextItems: ChecklistItem[];
        if (existingIdx >= 0) {
          wasMerged = true;
          resultItemId = ld.items[existingIdx].id;
          nextItems = ld.items.map((it, idx) =>
            idx === existingIdx
              ? {
                  ...it,
                  quantity: it.quantity + Math.max(1, payload.quantity),
                  checked: true,
                  loadedAt: nowIso,
                }
              : it
          );
        } else {
          const newItem: ChecklistItem = {
            id: resultItemId,
            sku: payload.sku.trim(),
            name: payload.name.trim() || payload.sku.trim(),
            category: payload.category || 'Generale',
            quantity: Math.max(1, payload.quantity),
            unitWeightKg: 0,
            checked: true,
            fragile: false,
            palletId: payload.palletId,
            boxId: payload.boxId,
            notes: payload.notes || '',
            loadedAt: nowIso,
          };
          nextItems = [newItem, ...ld.items];
        }

        return {
          ...ld,
          loadedAt: ld.loadedAt || nowIso,
          items: nextItems,
        };
      });
      broadcastLoads(nextLoads);
      return nextLoads;
    });

    return { itemId: resultItemId, merged: wasMerged };
  };

  const handleRenameLoadItemBySku = (
    loadId: string,
    sku: string,
    newName: string
  ) => {
    const targetSkuUpper = sku.trim().toUpperCase();
    setLoads((prevLoads) => {
      const nextLoads = prevLoads.map((ld) => {
        if (ld.id !== loadId) return ld;
        return {
          ...ld,
          items: ld.items.map((it) =>
            it.sku.trim().toUpperCase() === targetSkuUpper
              ? { ...it, name: newName }
              : it
          ),
        };
      });
      broadcastLoads(nextLoads);
      return nextLoads;
    });
  };

  // --- Unione Excel Check-List: importa righe unificate nella commessa attiva ---
  const handleImportMergedChecklistItems = (
    rows: Array<{
      sku: string;
      name: string;
      quantity: number;
      unitWeightKg: number;
      category: string;
      notes: string;
    }>,
    options: { replaceExisting: boolean }
  ) => {
    updateActiveLoad((load) => {
      const now = Date.now();
      const created: ChecklistItem[] = rows.map((r, idx) => ({
        id: `itm-xls-${now}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
        sku: r.sku || `CHK-${String(load.items.length + idx + 1).padStart(3, '0')}`,
        name: r.name || 'Articolo',
        category: r.category || 'Generale',
        quantity: Math.max(1, r.quantity || 1),
        unitWeightKg: Math.max(0, r.unitWeightKg || 0),
        checked: false,
        fragile: false,
        palletId: null,
        boxId: null,
        notes: r.notes || '',
      }));

      return {
        ...load,
        items: options.replaceExisting ? created : [...load.items, ...created],
      };
    });
    showToast(`Importati ${rows.length} articoli unificati nella commessa`);
  };

  // --- Box Handlers ---
  const handleAddBox = (data: {
    label: string;
    boxType: BoxType;
    dimensionsCm?: string;
    palletId: string | null;
    parentBoxId?: string | null;
    fragile: boolean;
    stackLevel: 1 | 2 | 3;
  }) => {
    const spec = BOX_SPECS[data.boxType];
    updateActiveLoad((load) => {
      const nextNum = load.boxes.length + 1;
      const parentBox = data.parentBoxId
        ? load.boxes.find((b) => b.id === data.parentBoxId)
        : null;
      const resolvedPalletId =
        parentBox?.palletId || data.palletId || load.pallets[0]?.id || null;

      const nowIso = new Date().toISOString();
      const newBox: CargoBox = {
        id: `box-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        code: `SC-${String(nextNum).padStart(2, '0')}`,
        label: data.label,
        boxType: data.boxType,
        dimensionsCm: data.dimensionsCm?.trim() || spec.dimensionsCm,
        tareKg: spec.tareKg,
        maxWeightKg: spec.defaultMaxKg,
        palletId: resolvedPalletId,
        parentBoxId: data.parentBoxId || null,
        sealed: false,
        fragile: data.fragile,
        stackLevel: data.stackLevel,
        loadedAt: nowIso,
      };
      return {
        ...load,
        loadedAt: load.loadedAt || nowIso,
        boxes: [...load.boxes, newBox],
      };
    });
  };

  const handleUpdateBox = (
    boxId: string,
    updates: {
      label?: string;
      boxType?: BoxType;
      dimensionsCm?: string;
      parentBoxId?: string | null;
      stackLevel?: 1 | 2 | 3;
      fragile?: boolean;
    }
  ) => {
    updateActiveLoad((load) => {
      const parentBox =
        updates.parentBoxId !== undefined && updates.parentBoxId
          ? load.boxes.find((b) => b.id === updates.parentBoxId)
          : null;

      return {
        ...load,
        boxes: load.boxes.map((b) => {
          if (b.id !== boxId) return b;
          const nextType = updates.boxType ?? b.boxType;
          const spec = BOX_SPECS[nextType];
          const nextDim =
            updates.dimensionsCm !== undefined
              ? updates.dimensionsCm
              : updates.boxType && updates.boxType !== 'PERSONALIZZATA'
              ? spec.dimensionsCm
              : b.dimensionsCm;

          return {
            ...b,
            label: updates.label !== undefined ? updates.label : b.label,
            boxType: nextType,
            dimensionsCm: nextDim,
            tareKg: spec.tareKg,
            maxWeightKg: spec.defaultMaxKg,
            parentBoxId:
              updates.parentBoxId !== undefined
                ? updates.parentBoxId
                : b.parentBoxId,
            palletId: parentBox ? parentBox.palletId : b.palletId,
            stackLevel:
              updates.stackLevel !== undefined
                ? updates.stackLevel
                : b.stackLevel,
            fragile:
              updates.fragile !== undefined ? updates.fragile : b.fragile,
          };
        }),
      };
    });
  };

  const handleDuplicateBox = (boxId: string) => {
    updateActiveLoad((load) => {
      const targetBox = load.boxes.find((b) => b.id === boxId);
      if (!targetBox) return load;

      const now = Date.now();
      let nextBoxCounter = load.boxes.length + 1;
      let nextItemCounter = load.items.length + 1;

      const newBoxId = `box-${now}-${Math.random().toString(36).slice(2, 5)}`;
      const clonedBox: CargoBox = {
        ...targetBox,
        id: newBoxId,
        code: `SC-${String(nextBoxCounter++).padStart(2, '0')}`,
        label: `${targetBox.label} (Copia)`,
      };

      const childBoxes = load.boxes.filter((b) => b.parentBoxId === boxId);
      const childIdMap = new Map<string, string>();
      const clonedChildren: CargoBox[] = childBoxes.map((cb, idx) => {
        const newChildId = `box-${now}-sub-${idx}-${Math.random()
          .toString(36)
          .slice(2, 5)}`;
        childIdMap.set(cb.id, newChildId);
        return {
          ...cb,
          id: newChildId,
          code: `SC-${String(nextBoxCounter++).padStart(2, '0')}`,
          label: `${cb.label} (Copia)`,
          parentBoxId: newBoxId,
        };
      });

      const relevantBoxIds = new Set([boxId, ...childBoxes.map((c) => c.id)]);
      const itemsToClone = load.items.filter(
        (i) => i.boxId && relevantBoxIds.has(i.boxId)
      );

      const clonedItems: ChecklistItem[] = itemsToClone.map((item, idx) => ({
        ...item,
        id: `itm-${now}-cp-${idx}-${Math.random().toString(36).slice(2, 5)}`,
        sku: `ART-${String(nextItemCounter++).padStart(3, '0')}`,
        boxId:
          item.boxId === boxId
            ? newBoxId
            : childIdMap.get(item.boxId || '') || newBoxId,
      }));

      return {
        ...load,
        boxes: [...load.boxes, clonedBox, ...clonedChildren],
        items: [...load.items, ...clonedItems],
      };
    });
    showToast('Scatola e contenuto duplicati con successo');
  };

  const handleDeleteBox = (boxId: string) => {
    updateActiveLoad((load) => ({
      ...load,
      boxes: load.boxes
        .filter((b) => b.id !== boxId)
        .map((b) =>
          b.parentBoxId === boxId ? { ...b, parentBoxId: null } : b
        ),
      items: load.items.map((item) =>
        item.boxId === boxId ? { ...item, boxId: null } : item
      ),
    }));
  };

  const handleMoveBoxToPallet = (
    boxId: string,
    palletId: string | null,
    parentBoxId?: string | null
  ) => {
    updateActiveLoad((load) => ({
      ...load,
      boxes: load.boxes.map((b) => {
        if (b.id === boxId) {
          return {
            ...b,
            palletId,
            parentBoxId:
              parentBoxId !== undefined ? parentBoxId : b.parentBoxId,
          };
        }
        if (b.parentBoxId === boxId) {
          return { ...b, palletId };
        }
        return b;
      }),
      items: load.items.map((item) =>
        item.boxId === boxId ? { ...item, palletId } : item
      ),
    }));
  };

  const handleToggleBoxSealed = (boxId: string) => {
    const nowIso = new Date().toISOString();
    updateActiveLoad((load) => {
      const targetBox = load.boxes.find((b) => b.id === boxId);
      const nextSealed = targetBox ? !targetBox.sealed : true;
      return {
        ...load,
        loadedAt: nextSealed ? load.loadedAt || nowIso : load.loadedAt,
        boxes: load.boxes.map((b) =>
          b.id === boxId
            ? {
                ...b,
                sealed: nextSealed,
                loadedAt: nextSealed ? b.loadedAt || nowIso : b.loadedAt,
              }
            : b
        ),
        items: nextSealed
          ? load.items.map((i) =>
              i.boxId === boxId
                ? { ...i, checked: true, loadedAt: i.loadedAt || nowIso }
                : i
            )
          : load.items,
      };
    });
  };

  // --- Kit Generator Handler ---
  const handleCreateKit = (payload: CreateKitPayload) => {
    updateActiveLoad((load) => {
      const now = Date.now();
      let nextBoxCounter = load.boxes.length + 1;
      let nextItemCounter = load.items.length + 1;

      if (payload.mode === 'new_boxes') {
        const spec = BOX_SPECS[payload.boxType];
        const parentBox = payload.parentBoxId
          ? load.boxes.find((b) => b.id === payload.parentBoxId)
          : null;
        const resolvedPalletId =
          parentBox?.palletId ||
          payload.targetPalletId ||
          load.pallets[0]?.id ||
          null;

        const createdBoxes: CargoBox[] = [];
        const createdItems: ChecklistItem[] = [];

        for (let bIdx = 0; bIdx < payload.boxCount; bIdx++) {
          const newBoxId = `box-${now}-kit-${bIdx}-${Math.random()
            .toString(36)
            .slice(2, 5)}`;
          const boxCode = `SC-${String(nextBoxCounter++).padStart(2, '0')}`;

          createdBoxes.push({
            id: newBoxId,
            code: boxCode,
            label: `${payload.kitName} #${bIdx + 1}`,
            boxType: payload.boxType,
            dimensionsCm: payload.customDimensionsCm || spec.dimensionsCm,
            tareKg: spec.tareKg,
            maxWeightKg: spec.defaultMaxKg,
            palletId: resolvedPalletId,
            parentBoxId: payload.parentBoxId || null,
            sealed: false,
            fragile: payload.items.some((i) => i.fragile),
            stackLevel: 1,
            kitName: payload.kitName,
          });

          payload.items.forEach((kitItem, iIdx) => {
            createdItems.push({
              id: `itm-${now}-kit-${bIdx}-${iIdx}-${Math.random()
                .toString(36)
                .slice(2, 5)}`,
              sku: `${kitItem.skuPrefix}-${String(nextItemCounter++).padStart(
                3,
                '0'
              )}`,
              name: kitItem.name,
              category: 'Kit',
              quantity: kitItem.quantityPerBox,
              unitWeightKg: kitItem.unitWeightKg,
              checked: true,
              fragile: kitItem.fragile,
              palletId: resolvedPalletId,
              boxId: newBoxId,
              notes: `Kit: ${payload.kitName}`,
              photoDataUrl: kitItem.photoDataUrl,
              kitName: payload.kitName,
            });
          });
        }

        return {
          ...load,
          boxes: [...load.boxes, ...createdBoxes],
          items: [...load.items, ...createdItems],
        };
      } else {
        const createdItems: ChecklistItem[] = [];
        payload.targetBoxIds.forEach((targetBoxId, bIdx) => {
          const targetBox = load.boxes.find((b) => b.id === targetBoxId);
          if (!targetBox) return;

          payload.items.forEach((kitItem, iIdx) => {
            createdItems.push({
              id: `itm-${now}-kitex-${bIdx}-${iIdx}-${Math.random()
                .toString(36)
                .slice(2, 5)}`,
              sku: `${kitItem.skuPrefix}-${String(nextItemCounter++).padStart(
                3,
                '0'
              )}`,
              name: kitItem.name,
              category: 'Kit',
              quantity: kitItem.quantityPerBox,
              unitWeightKg: kitItem.unitWeightKg,
              checked: true,
              fragile: kitItem.fragile,
              palletId: targetBox.palletId,
              boxId: targetBox.id,
              notes: `Kit: ${payload.kitName}`,
              photoDataUrl: kitItem.photoDataUrl,
              kitName: payload.kitName,
            });
          });
        });

        return {
          ...load,
          items: [...load.items, ...createdItems],
        };
      }
    });
    showToast(`Kit "${payload.kitName}" generato con successo`);
  };

  // --- Pallet Handlers ---
  const handleAddPallet = (data: {
    label: string;
    palletType: PalletType;
    dimensionsCm?: string;
    heightCm?: number;
    tareKg?: number;
    notes?: string;
    customWeightKg?: number | null;
  }) => {
    const spec = PALLET_SPECS[data.palletType];
    updateActiveLoad((load) => {
      const nextNum = load.pallets.length + 1;
      const nowIso = new Date().toISOString();
      const newPallet: CargoPallet = {
        id: `pal-${Date.now()}`,
        code: `BANC-${String(nextNum).padStart(2, '0')}`,
        label: data.label,
        palletType: data.palletType,
        dimensionsCm: data.dimensionsCm || spec.dimensionsCm,
        heightCm: data.heightCm !== undefined ? data.heightCm : 160,
        tareKg: data.tareKg !== undefined ? data.tareKg : spec.tareKg,
        maxWeightKg: spec.defaultMaxKg,
        wrapped: false,
        truckSlot: nextNum <= load.vehicleMaxPallets ? nextNum : null,
        notes: data.notes || '',
        customWeightKg: data.customWeightKg ?? null,
        loadedAt: nowIso,
      };
      return {
        ...load,
        loadedAt: load.loadedAt || nowIso,
        pallets: [...load.pallets, newPallet],
      };
    });
  };

  const handleUpdatePallet = (
    palletId: string,
    updates: Partial<CargoPallet>
  ) => {
    updateActiveLoad((load) => ({
      ...load,
      pallets: load.pallets.map((p) => {
        if (p.id !== palletId) return p;
        const nextType = updates.palletType ?? p.palletType;
        const spec = PALLET_SPECS[nextType];
        return {
          ...p,
          ...updates,
          dimensionsCm:
            updates.dimensionsCm ??
            (updates.palletType ? spec.dimensionsCm : p.dimensionsCm),
          tareKg:
            updates.tareKg !== undefined
              ? updates.tareKg
              : updates.palletType
              ? spec.tareKg
              : p.tareKg,
          maxWeightKg: spec.defaultMaxKg,
        };
      }),
    }));
  };

  const handleDuplicatePallet = (palletId: string) => {
    updateActiveLoad((load) => {
      const targetPallet = load.pallets.find((p) => p.id === palletId);
      if (!targetPallet) return load;

      const now = Date.now();
      const nextPalletNum = load.pallets.length + 1;
      let nextBoxCounter = load.boxes.length + 1;
      let nextItemCounter = load.items.length + 1;

      const newPalletId = `pal-${now}-${Math.random().toString(36).slice(2, 5)}`;
      const clonedPallet: CargoPallet = {
        ...targetPallet,
        id: newPalletId,
        code: `BANC-${String(nextPalletNum).padStart(2, '0')}`,
        label: `${targetPallet.label} (Copia)`,
        truckSlot:
          nextPalletNum <= load.vehicleMaxPallets ? nextPalletNum : null,
      };

      const palletBoxes = load.boxes.filter((b) => b.palletId === palletId);
      const boxIdMap = new Map<string, string>();
      palletBoxes.forEach((b, idx) => {
        boxIdMap.set(
          b.id,
          `box-${now}-palcp-${idx}-${Math.random().toString(36).slice(2, 5)}`
        );
      });

      const clonedBoxes: CargoBox[] = palletBoxes.map((b) => ({
        ...b,
        id: boxIdMap.get(b.id)!,
        code: `SC-${String(nextBoxCounter++).padStart(2, '0')}`,
        palletId: newPalletId,
        parentBoxId: b.parentBoxId
          ? boxIdMap.get(b.parentBoxId) || null
          : null,
      }));

      const palletItems = load.items.filter(
        (i) =>
          i.palletId === palletId || (i.boxId && boxIdMap.has(i.boxId))
      );

      const clonedItems: ChecklistItem[] = palletItems.map((item, idx) => ({
        ...item,
        id: `itm-${now}-palcp-${idx}-${Math.random().toString(36).slice(2, 5)}`,
        sku: `ART-${String(nextItemCounter++).padStart(3, '0')}`,
        palletId: newPalletId,
        boxId: item.boxId ? boxIdMap.get(item.boxId) || null : null,
      }));

      return {
        ...load,
        pallets: [...load.pallets, clonedPallet],
        boxes: [...load.boxes, ...clonedBoxes],
        items: [...load.items, ...clonedItems],
      };
    });
    showToast('Intero Bancale (con scatole e oggetti) duplicato');
  };

  const handleDeletePallet = (palletId: string) => {
    updateActiveLoad((load) => ({
      ...load,
      pallets: load.pallets.filter((p) => p.id !== palletId),
      boxes: load.boxes.map((b) =>
        b.palletId === palletId ? { ...b, palletId: null } : b
      ),
      items: load.items.map((i) =>
        i.palletId === palletId ? { ...i, palletId: null, boxId: null } : i
      ),
    }));
  };

  const handleTogglePalletWrapped = (palletId: string) => {
    const nowIso = new Date().toISOString();
    updateActiveLoad((load) => {
      const targetPallet = load.pallets.find((p) => p.id === palletId);
      const nextWrapped = targetPallet ? !targetPallet.wrapped : true;
      const boxIdsOnPallet = new Set(
        load.boxes.filter((b) => b.palletId === palletId).map((b) => b.id)
      );
      return {
        ...load,
        loadedAt: nextWrapped ? load.loadedAt || nowIso : load.loadedAt,
        pallets: load.pallets.map((p) =>
          p.id === palletId
            ? {
                ...p,
                wrapped: nextWrapped,
                loadedAt: nextWrapped ? p.loadedAt || nowIso : p.loadedAt,
              }
            : p
        ),
        boxes: nextWrapped
          ? load.boxes.map((b) =>
              b.palletId === palletId ? { ...b, loadedAt: b.loadedAt || nowIso } : b
            )
          : load.boxes,
        items: nextWrapped
          ? load.items.map((i) =>
              i.palletId === palletId || (i.boxId && boxIdsOnPallet.has(i.boxId))
                ? { ...i, loadedAt: i.loadedAt || nowIso }
                : i
            )
          : load.items,
      };
    });
  };

  const handleAssignPalletSlot = (
    palletId: string,
    slotNumber: number | null
  ) => {
    updateActiveLoad((load) => ({
      ...load,
      pallets: load.pallets.map((p) => {
        if (p.id === palletId) {
          return { ...p, truckSlot: slotNumber };
        }
        if (slotNumber !== null && p.truckSlot === slotNumber) {
          return { ...p, truckSlot: null };
        }
        return p;
      }),
    }));
  };

  const handleUpdateVehicleSpecs = (specs: {
    client?: string;
    destination?: string;
    carrier: string;
    vehicleMaxWeightKg: number;
    vehicleMaxPallets: number;
    departureDate: string;
  }) => {
    updateActiveLoad((load) => ({
      ...load,
      ...specs,
    }));
  };

  // --- Finishing / Verniciatura / RAL / Zincatura Cartelli Handlers ---
  const handleAddFinishingTag = (
    data: Omit<FinishingCartello, 'id' | 'createdAt'>
  ): FinishingCartello => {
    const newTag: FinishingCartello = {
      ...data,
      id: `fin-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: new Date().toISOString(),
    };
    updateActiveLoad((load) => ({
      ...load,
      finishingTags: [newTag, ...(load.finishingTags || [])],
    }));
    showToast(`Cartello aggiunto: ${newTag.commessaCode} — ${newTag.treatmentText}`);
    return newTag;
  };

  const handleUpdateFinishingTag = (
    tagId: string,
    updates: Partial<FinishingCartello>
  ) => {
    updateActiveLoad((load) => ({
      ...load,
      finishingTags: (load.finishingTags || []).map((t) =>
        t.id === tagId ? { ...t, ...updates } : t
      ),
    }));
  };

  const handleDeleteFinishingTag = (tagId: string) => {
    updateActiveLoad((load) => ({
      ...load,
      finishingTags: (load.finishingTags || []).filter((t) => t.id !== tagId),
    }));
    showToast('Cartello lavorazione rimosso');
  };

  const handleDuplicateFinishingTag = (tagId: string) => {
    updateActiveLoad((load) => {
      const existing = (load.finishingTags || []).find((t) => t.id === tagId);
      if (!existing) return load;
      const cloned: FinishingCartello = {
        ...existing,
        id: `fin-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        createdAt: new Date().toISOString(),
      };
      return {
        ...load,
        finishingTags: [cloned, ...(load.finishingTags || [])],
      };
    });
    showToast('Cartello lavorazione duplicato');
  };

  // --- Auto-Distribute Unassigned Checklist Items into Boxes & Pallets ---
  const handleAutoDistributeItems = () => {
    updateActiveLoad((load) => {
      const currentPallets = [...load.pallets];
      const currentBoxes = [...load.boxes];

      if (currentPallets.length === 0) {
        const spec = PALLET_SPECS.EPAL_80x120;
        currentPallets.push({
          id: `pal-${Date.now()}`,
          code: 'BANC-01',
          label: 'Bancale Principale',
          palletType: 'EPAL_80x120',
          dimensionsCm: spec.dimensionsCm,
          heightCm: 140,
          tareKg: spec.tareKg,
          maxWeightKg: spec.defaultMaxKg,
          wrapped: false,
          truckSlot: 1,
          notes: '',
        });
      }

      if (currentBoxes.length === 0) {
        const spec = BOX_SPECS.M_60x40x40;
        currentBoxes.push({
          id: `box-${Date.now()}`,
          code: 'SC-01',
          label: 'Scatola 01',
          boxType: 'M_60x40x40',
          dimensionsCm: spec.dimensionsCm,
          tareKg: spec.tareKg,
          maxWeightKg: spec.defaultMaxKg,
          palletId: currentPallets[0].id,
          parentBoxId: null,
          sealed: false,
          fragile: false,
          stackLevel: 1,
        });
      }

      let boxIndex = 0;
      const updatedItems = load.items.map((item) => {
        if (item.palletId || item.boxId) return item;
        const targetBox = currentBoxes[boxIndex % currentBoxes.length];
        boxIndex += 1;
        return {
          ...item,
          boxId: targetBox.id,
          palletId: targetBox.palletId || currentPallets[0].id,
        };
      });

      return {
        ...load,
        pallets: currentPallets,
        boxes: currentBoxes,
        items: updatedItems,
      };
    });
  };

  const handleClearCurrentLoad = () => {
    updateActiveLoad((load) => ({
      ...load,
      pallets: [],
      boxes: [],
      items: [],
      signatures: [],
    }));
  };

  const handleSaveSignature = (newSig: ElectronicSignature) => {
    updateActiveLoad((load) => {
      const existing = load.signatures || [];
      const filtered = existing.filter((s) => s.role !== newSig.role);
      return {
        ...load,
        signatures: [...filtered, newSig],
      };
    });
  };

  const handleDeleteSignature = (
    role: 'operatore' | 'responsabile' | 'autista'
  ) => {
    updateActiveLoad((load) => ({
      ...load,
      signatures: (load.signatures || []).filter((s) => s.role !== role),
    }));
  };

  const handleSaveHandoverProof = (handover: ShipmentHandoverProof) => {
    const shippedIso = handover.handoverAt || new Date().toISOString();
    updateActiveLoad((load) => ({
      ...load,
      handoverProof: handover,
      shippedAt: shippedIso,
      pallets: load.pallets.map((p) => ({ ...p, shippedAt: p.shippedAt || shippedIso })),
      boxes: load.boxes.map((b) => ({ ...b, shippedAt: b.shippedAt || shippedIso })),
      items: load.items.map((it) => ({ ...it, shippedAt: it.shippedAt || shippedIso })),
    }));
    showToast(
      `Verbale ritiro corriere (${handover.carrierName}) certificato 101% — Data scarico registrata`
    );
  };

  // --- Timbro Data/Ora Carico (Preparazione) o Scarico (Spedizione) per QR / Barcode ---
  const handleStampEntityDate = (
    commessaCode: string,
    entityType: 'load' | TrackEntityType,
    entityId: string,
    field: 'loadedAt' | 'shippedAt',
    timestampIso: string | undefined
  ) => {
    const targetCodeUpper = (commessaCode || '').trim().toUpperCase();
    setLoads((prev) => {
      const nextLoads = prev.map((load) => {
        if ((load.code || '').trim().toUpperCase() !== targetCodeUpper) {
          return load;
        }
        if (entityType === 'load') {
          return {
            ...load,
            [field]: timestampIso,
            pallets: load.pallets.map((p) => ({ ...p, [field]: timestampIso })),
            boxes: load.boxes.map((b) => ({ ...b, [field]: timestampIso })),
            items: load.items.map((it) => ({ ...it, [field]: timestampIso })),
          };
        }
        if (entityType === 'pallet') {
          const boxIdsOnPallet = collectPalletBoxIds(load.boxes, entityId);
          return {
            ...load,
            pallets: load.pallets.map((p) =>
              p.id === entityId ? { ...p, [field]: timestampIso } : p
            ),
            boxes: load.boxes.map((b) =>
              boxIdsOnPallet.has(b.id) ? { ...b, [field]: timestampIso } : b
            ),
            items: load.items.map((it) =>
              it.palletId === entityId || (it.boxId && boxIdsOnPallet.has(it.boxId))
                ? { ...it, [field]: timestampIso }
                : it
            ),
          };
        }
        if (entityType === 'box') {
          const boxTreeIds = collectBoxTreeIds(load.boxes, entityId);
          return {
            ...load,
            boxes: load.boxes.map((b) =>
              boxTreeIds.has(b.id) ? { ...b, [field]: timestampIso } : b
            ),
            items: load.items.map((it) =>
              it.boxId && boxTreeIds.has(it.boxId)
                ? { ...it, [field]: timestampIso }
                : it
            ),
          };
        }
        return {
          ...load,
          items: load.items.map((it) =>
            it.id === entityId ? { ...it, [field]: timestampIso } : it
          ),
        };
      });
      broadcastLoads(nextLoads);
      return nextLoads;
    });
    if (timestampIso) {
      showToast(
        field === 'loadedAt'
          ? 'Data e ora CARICO (preparazione) aggiornata'
          : 'Data e ora SCARICO (spedizione) aggiornata'
      );
    }
  };

  // --- Scarico Barcode Completo (Bancale / Scatola / Oggetto) con Data, Ora e Magazzino ---
  const handleDispatchTrackingRecord = (
    record: ResolvedTrackingRecord,
    options?: { syncWarehouse?: boolean; undo?: boolean }
  ): {
    timestampIso?: string;
    itemsCount: number;
    piecesCount: number;
    warehouseMatchedCount: number;
  } => {
    const isUndo = Boolean(options?.undo);
    const syncWarehouse = options?.syncWarehouse !== false;
    const nowIso = isUndo ? undefined : new Date().toISOString();

    handleStampEntityDate(
      record.commessaCode,
      record.type,
      record.entityId,
      'shippedAt',
      nowIso
    );

    const targetLoad = loads.find(
      (l) =>
        (l.code || '').trim().toUpperCase() ===
        (record.commessaCode || '').trim().toUpperCase()
    );

    const affectedItems: Array<{
      itemId: string;
      sku: string;
      name: string;
      quantity: number;
      boxCode?: string;
    }> = [];

    if (record.detailedItems && record.detailedItems.length > 0) {
      record.detailedItems.forEach((d) => {
        affectedItems.push({
          itemId: d.itemId,
          sku: d.sku,
          name: d.name,
          quantity: d.quantity,
          boxCode: d.boxCode || undefined,
        });
      });
    } else if (record.type === 'item' && targetLoad) {
      const it = targetLoad.items.find((x) => x.id === record.entityId);
      if (it) {
        affectedItems.push({
          itemId: it.id,
          sku: it.sku,
          name: it.name,
          quantity: it.quantity,
          boxCode: record.boxCode || undefined,
        });
      }
    }

    const totalPieces = affectedItems.reduce(
      (acc, it) => acc + Math.max(0, Number(it.quantity) || 0),
      0
    );

    let warehouseMatchedCount = 0;

    if (!isUndo && syncWarehouse && nowIso && affectedItems.length > 0) {
      const nextItems = inventory.items.map((item) => ({ ...item }));
      const newMovements: StockMovement[] = [];
      const entityLabel =
        record.type === 'pallet'
          ? 'Bancale'
          : record.type === 'box'
          ? 'Scatola'
          : 'Oggetto';

      affectedItems.forEach((entry, idx) => {
        const skuUpper = (entry.sku || '').trim().toUpperCase();
        const invIdx = nextItems.findIndex(
          (inv) =>
            inv.sku.trim().toUpperCase() === skuUpper ||
            (inv.barcode && inv.barcode.trim().toUpperCase() === skuUpper)
        );
        const qtyToDeduct = Math.max(1, Number(entry.quantity) || 1);
        if (invIdx >= 0) {
          warehouseMatchedCount += 1;
          const prevQty = Number(nextItems[invIdx].quantity) || 0;
          const resultingQty = Math.max(
            0,
            Math.round((prevQty - qtyToDeduct) * 100) / 100
          );
          nextItems[invIdx] = {
            ...nextItems[invIdx],
            quantity: resultingQty,
            usageCount: (nextItems[invIdx].usageCount || 0) + 1,
            updatedAt: nowIso,
          };
          newMovements.push({
            id: `mov-out-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
            itemId: nextItems[invIdx].id,
            sku: nextItems[invIdx].sku,
            itemName: nextItems[invIdx].name,
            unit: nextItems[invIdx].unit || 'pz',
            type: 'scarico',
            quantity: qtyToDeduct,
            previousQty: prevQty,
            resultingQty,
            reason: `Scarico barcode ${entityLabel} ${record.code}${
              entry.boxCode ? ` · ${entry.boxCode}` : ''
            }`,
            commessaCode: record.commessaCode,
            operatorName: authUser?.name || 'Operatore',
            timestamp: nowIso,
          });
        } else {
          newMovements.push({
            id: `mov-out-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
            itemId: entry.itemId,
            sku: entry.sku || record.code,
            itemName: entry.name,
            unit: 'pz',
            type: 'scarico',
            quantity: qtyToDeduct,
            previousQty: qtyToDeduct,
            resultingQty: 0,
            reason: `Uscita barcode ${entityLabel} ${record.code}${
              entry.boxCode ? ` · ${entry.boxCode}` : ''
            }`,
            commessaCode: record.commessaCode,
            operatorName: authUser?.name || 'Operatore',
            timestamp: nowIso,
          });
        }
      });

      handleUpdateInventory({
        ...inventory,
        items: nextItems,
        movements: [...newMovements, ...inventory.movements],
      });
    }

    if (isUndo) {
      showToast(`Annullata uscita di ${record.code} (${record.name})`);
    } else {
      const entityLabel =
        record.type === 'pallet'
          ? 'Bancale'
          : record.type === 'box'
          ? 'Scatola'
          : 'Oggetto';
      showToast(
        `${entityLabel} ${record.code} scaricato in uscita (${affectedItems.length} righe · ${totalPieces} pz)`
      );
    }

    return {
      timestampIso: nowIso,
      itemsCount: affectedItems.length,
      piecesCount: totalPieces,
      warehouseMatchedCount,
    };
  };

  // --- Create New Load (Commessa) ---
  const handleCreateNewLoad = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLoadTitle.trim()) return;

    const code =
      newLoadCode.trim().toUpperCase() ||
      `COM-${String(loads.length + 1).padStart(3, '0')}`;

    const newLoad: CargoLoad = {
      id: `load-${Date.now()}`,
      code,
      title: newLoadTitle.trim(),
      client: newLoadClient.trim() || 'Cliente Spedizione',
      destination: newLoadDest.trim() || 'Destinazione',
      carrier: newLoadCarrier.trim() || 'Motrice 12 EPAL',
      departureDate: new Date().toISOString().slice(0, 10),
      vehicleMaxPallets: newLoadMaxPallets,
      vehicleMaxWeightKg: newLoadMaxWeight,
      status: 'in_preparazione',
      pallets: [],
      boxes: [],
      items: [],
      signatures: [],
    };

    setLoads((prev) => {
      const nextLoads = [newLoad, ...prev];
      broadcastLoads(nextLoads);
      return nextLoads;
    });
    setActiveLoadId(newLoad.id);
    setNewLoadCode('');
    setNewLoadTitle('');
    setNewLoadClient('');
    setNewLoadDest('');
    setShowNewLoadModal(false);
    showToast(`Nuova commessa creata: ${newLoad.code} — ${newLoad.title}`);
  };

  const handleImportJSONBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (parsed && parsed.commessa && parsed.commessa.id) {
          const importedLoad: CargoLoad = parsed.commessa;
          setLoads((prev) => {
            const exists = prev.some((l) => l.id === importedLoad.id);
            const nextLoads = exists
              ? prev.map((l) => (l.id === importedLoad.id ? importedLoad : l))
              : [importedLoad, ...prev];
            broadcastLoads(nextLoads);
            return nextLoads;
          });
          setActiveLoadId(importedLoad.id);
          showToast(`Commessa caricata: ${importedLoad.title}`);
        } else if (Array.isArray(parsed) && parsed.length > 0) {
          setLoads(parsed);
          broadcastLoads(parsed);
          setActiveLoadId(parsed[0].id);
          showToast('Archivio commesse caricato con successo');
        } else if (parsed && parsed.id && Array.isArray(parsed.pallets)) {
          setLoads((prev) => {
            const nextLoads = [parsed, ...prev];
            broadcastLoads(nextLoads);
            return nextLoads;
          });
          setActiveLoadId(parsed.id);
          showToast(`Commessa caricata: ${parsed.title}`);
        }
      } catch {
        // Ignore invalid JSON
      }
    };
    reader.readAsText(file);
  };

  const handleForceReload = async () => {
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          await reg.unregister();
        }
      }
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        for (const name of cacheNames) {
          await caches.delete(name);
        }
      }
    } catch {
      // Ignore
    }
    window.location.reload();
  };

  const renderSynologyAppContent = (
    appId: SynologyAppId,
    openApp: (targetAppId: SynologyAppId) => void
  ) => {
    switch (appId) {
      case 'checklist':
        return (
          <ChecklistWorkspace
            load={activeLoad}
            summary={summary}
            onAddItem={handleAddItem}
            onDuplicateItem={handleDuplicateItem}
            onBulkAddLines={handleBulkAddLines}
            onToggleItemChecked={handleToggleItemChecked}
            onUpdateItemQuantity={handleUpdateItemQuantity}
            onUpdateItemDetails={handleUpdateItemDetails}
            onAssignItemLocation={handleAssignItemLocation}
            onDeleteItem={handleDeleteItem}
            onMarkAllChecked={handleMarkAllChecked}
            onAutoDistributeItems={handleAutoDistributeItems}
            onOpenKitModal={() => {
              setKitDefaultPalletId(activeLoad.pallets[0]?.id || null);
              setShowKitModal(true);
            }}
          />
        );
      case 'tree':
        return (
          <HierarchicalLoadTree
            load={activeLoad}
            summary={summary}
            onAddPallet={handleAddPallet}
            onUpdatePallet={handleUpdatePallet}
            onDuplicatePallet={handleDuplicatePallet}
            onDeletePallet={handleDeletePallet}
            onTogglePalletWrapped={handleTogglePalletWrapped}
            onAddBox={handleAddBox}
            onUpdateBox={handleUpdateBox}
            onDuplicateBox={handleDuplicateBox}
            onDeleteBox={handleDeleteBox}
            onMoveBoxToPallet={handleMoveBoxToPallet}
            onToggleBoxSealed={handleToggleBoxSealed}
            onToggleItemChecked={handleToggleItemChecked}
            onUpdateItemDetails={handleUpdateItemDetails}
            onDuplicateItem={handleDuplicateItem}
            onAssignItemLocation={handleAssignItemLocation}
            onQuickAddItemToBox={handleQuickAddItemToBox}
            onAutoDistributeItems={handleAutoDistributeItems}
            onOpen3DViewForPallet={(palletId) => {
              setSelected3DPalletId(palletId);
              openApp('view3d');
            }}
            onOpenKitModal={(defaultPalletId) => {
              setKitDefaultPalletId(
                defaultPalletId || activeLoad.pallets[0]?.id || null
              );
              setShowKitModal(true);
            }}
          />
        );
      case 'stock_movements':
        return (
          <StockMovementsWorkspace
            inventory={inventory}
            loads={loads}
            activeLoad={activeLoad}
            summary={summary}
            autoSyncStockWithPacking={autoSyncStockWithPacking}
            onToggleAutoSyncStockWithPacking={handleToggleAutoSyncStockWithPacking}
            onUpdateInventory={handleUpdateInventory}
            onCertifyPackageAndUnload={handleCertifyPackageAndUnload}
            onBatchUnloadCheckedItems={handleBatchUnloadCheckedItems}
            onSaveHandoverProof={handleSaveHandoverProof}
            onOpenCommessaPhotos={(commessaId) => {
              setPhotoAppTargetCommessaId(commessaId);
              openApp('commessa_photos');
            }}
          />
        );
      case 'commessa_photos':
        return (
          <CommessaPhotosApp
            loads={loads}
            activeLoad={activeLoad}
            initialCommessaId={photoAppTargetCommessaId}
            onSelectLoad={setActiveLoadId}
            onOpenNewLoadModal={() => setShowNewLoadModal(true)}
            onDeleteProofPhoto={(targetLoadId, rawPhotoId) => {
              setLoads((prev) => {
                const nextLoads = prev.map((ld) => {
                  if (ld.id !== targetLoadId) return ld;
                  return {
                    ...ld,
                    packingProofs: (ld.packingProofs || []).map((pr) => ({
                      ...pr,
                      photos: (pr.photos || []).filter((ph) => ph.id !== rawPhotoId),
                    })),
                    handoverProof: ld.handoverProof
                      ? {
                          ...ld.handoverProof,
                          photos: (ld.handoverProof.photos || []).filter(
                            (ph) => ph.id !== rawPhotoId
                          ),
                        }
                      : undefined,
                  };
                });
                broadcastLoads(nextLoads);
                return nextLoads;
              });
              showToast('Immagine rimossa dalla commessa');
            }}
          />
        );
      case 'file_manager':
        return <FileManagerApp loads={loads} />;
      case 'warehouse_catalog':
        return authUser ? (
          <WarehouseCatalogApp
            inventory={inventory}
            loads={loads}
            activeLoad={activeLoad}
            currentUser={authUser}
            onUpdateInventory={handleUpdateInventory}
            onDispatchTrackingRecord={handleDispatchTrackingRecord}
          />
        ) : null;
      case 'team_share':
        return authUser ? (
          <TeamShareApp
            currentUser={authUser}
            activeCommessaCode={activeLoad?.code}
            onOpenApp={(targetId) => openApp(targetId)}
          />
        ) : null;
      case 'employer_hub':
        return authUser && authUser.role === 'employer' ? (
          <EmployerHubApp
            currentUser={authUser}
            onOpenTeamShare={() => openApp('team_share')}
          />
        ) : null;
      case 'weather':
        return authUser ? <WeatherApp currentUser={authUser} /> : null;
      case 'clock':
        return authUser ? (
          <ClockApp
            currentUser={authUser}
            onTriggerNotification={handleClockTriggerNotification}
          />
        ) : null;
      case 'calendar':
        return authUser ? (
          <CalendarApp
            currentUser={authUser}
            loads={loads}
            syncVersion={calendarSyncVersion}
            onDataChanged={(cals, evs) => {
              setCalendarRecords(cals);
              setCalendarEvents(evs);
            }}
          />
        ) : null;
      case 'server_monitor':
        return authUser ? (
          <ServerMonitorApp
            currentUser={authUser}
            onOpenControlPanel={() => openApp('server_control')}
          />
        ) : null;
      case 'server_control':
        return authUser ? <ServerControlPanelApp currentUser={authUser} /> : null;
      case 'software_updates':
        return authUser ? (
          <SoftwareUpdateApp
            currentUser={authUser}
            updateStatus={serverUpdateStatus}
            desktopUpdaterState={desktopUpdaterState}
            onUpdateStatusChange={setServerUpdateStatus}
            onForceReloadWeb={handleForceReload}
          />
        ) : null;
      case 'ddt_documents':
        return authUser ? (
          <DdtDocumentsApp
            documents={ddtDocuments}
            loads={loads}
            activeLoad={activeLoad}
            contacts={crmContacts}
            currentUser={authUser}
            initialCommessaId={ddtInitialCommessaId}
            initialClientId={ddtInitialClientId}
            onClearInitialIntent={() => {
              setDdtInitialCommessaId(null);
              setDdtInitialClientId(null);
            }}
            onUpdateDocuments={handleUpdateDdtDocuments}
            onOpenCommessa={(loadId) => {
              setActiveLoadId(loadId);
              openApp('commesse');
            }}
          />
        ) : null;
      case 'crm_directory':
        return authUser ? (
          <ClientsSuppliersApp
            contacts={crmContacts}
            loads={loads}
            inventory={inventory}
            ddtDocuments={ddtDocuments}
            purchaseOrders={purchaseOrders}
            onUpdateContacts={handleUpdateCrmContacts}
            onCreateLoadForClient={(contact) => {
              setNewLoadClient(contact.companyName);
              setNewLoadDest(
                contact.shippingAddress ||
                  [contact.billingAddress, contact.city].filter(Boolean).join(', ')
              );
              if (contact.defaultCarrier) {
                setNewLoadCarrier(contact.defaultCarrier);
              }
              setShowNewLoadModal(true);
            }}
            onCreateDdtForClient={(contactId) => {
              setDdtInitialClientId(contactId);
              openApp('ddt_documents');
            }}
            onCreatePoForSupplier={(contactId) => {
              setPoInitialSupplierId(contactId);
              openApp('purchase_orders');
            }}
            onOpenCommessa={(loadId) => {
              setActiveLoadId(loadId);
              openApp('commesse');
            }}
          />
        ) : null;
      case 'purchase_orders':
        return authUser ? (
          <PurchaseOrdersApp
            orders={purchaseOrders}
            inventory={inventory}
            contacts={crmContacts}
            currentUser={authUser}
            initialSupplierId={poInitialSupplierId}
            onClearInitialIntent={() => setPoInitialSupplierId(null)}
            onUpdateOrders={handleUpdatePurchaseOrders}
            onUpdateInventory={handleUpdateInventory}
          />
        ) : null;
      case 'timini_print':
        return authUser ? (
          <TiMiniPrintApp
            currentUser={authUser}
            inventory={inventory}
            loads={loads}
            activeLoad={activeLoad}
          />
        ) : null;
      case 'pallet_truck_scanner':
        return authUser ? (
          <PalletTruckScannerApp
            loads={loads}
            activeLoad={activeLoad}
            inventory={inventory}
            currentUser={authUser}
            onSelectLoad={setActiveLoadId}
            onUpdateInventory={handleUpdateInventory}
            onAddPallet={handleAddPallet}
            onAddBox={handleAddBox}
            onAssignPalletSlot={handleAssignPalletSlot}
            onTogglePalletWrapped={handleTogglePalletWrapped}
            onScanPackItemToLoad={handleScanPackItemToLoad}
            onRenameLoadItemBySku={handleRenameLoadItemBySku}
            onDispatchTrackingRecord={handleDispatchTrackingRecord}
          />
        ) : null;
      case 'excel_checklist_merger':
        return (
          <ExcelChecklistMergerApp
            activeLoad={activeLoad}
            onImportItemsToLoad={handleImportMergedChecklistItems}
          />
        );
      case 'pallet_weights':
        return (
          <PalletWeightsWorkspace
            load={activeLoad}
            summary={summary}
            onUpdatePallet={handleUpdatePallet}
            onAddPallet={handleAddPallet}
            onDeletePallet={handleDeletePallet}
          />
        );
      case 'painting_tags':
        return (
          <PaintingTagsWorkspace
            load={activeLoad}
            summary={summary}
            onAddFinishingTag={handleAddFinishingTag}
            onUpdateFinishingTag={handleUpdateFinishingTag}
            onDeleteFinishingTag={handleDeleteFinishingTag}
            onDuplicateFinishingTag={handleDuplicateFinishingTag}
          />
        );
      case 'view3d':
        return (
          <Pallet3DVisualizer
            key={selected3DPalletId}
            load={activeLoad}
            summary={summary}
            initialPalletId={selected3DPalletId}
          />
        );
      case 'truck':
        return (
          <TruckLoadPlanner
            load={activeLoad}
            summary={summary}
            onAssignPalletSlot={handleAssignPalletSlot}
            onTogglePalletWrapped={handleTogglePalletWrapped}
            onUpdateVehicleSpecs={handleUpdateVehicleSpecs}
          />
        );
      case 'signatures':
        return (
          <SignaturesWorkspace
            load={activeLoad}
            summary={summary}
            onSaveSignature={handleSaveSignature}
            onDeleteSignature={handleDeleteSignature}
            onOpenPrintModal={() => setShowPrintModal(true)}
          />
        );
      case 'qr_labels':
        return (
          <QrLabelsA4Workspace
            load={activeLoad}
            allLoads={loads}
            movements={inventory.movements}
            operatorName={authUser?.name}
            onStampEntityDate={handleStampEntityDate}
            onDispatchTrackingRecord={handleDispatchTrackingRecord}
          />
        );
      default:
        return null;
    }
  };

  if (scannedTrackParam) {
    return (
      <QrTrackingScanView
        encodedTrackParam={scannedTrackParam}
        localLoads={authUser ? loads : undefined}
        localMovements={authUser ? inventory.movements : undefined}
        onStampLocal={
          authUser
            ? (commessaCode, entityType, entityId, field, ts) =>
                handleStampEntityDate(commessaCode, entityType, entityId, field, ts)
            : undefined
        }
        onClose={() => {
          setScannedTrackParam(null);
          if (typeof window !== 'undefined' && window.history.replaceState) {
            const url = new URL(window.location.href);
            url.searchParams.delete('track');
            url.searchParams.delete('d');
            window.history.replaceState({}, '', url.toString());
          }
        }}
      />
    );
  }

  if (isRestoringSession && (!authUser || !authToken)) {
    return (
      <div className="min-h-screen w-full bg-[#090b16] flex flex-col items-center justify-center gap-3 text-white">
        <div className="w-9 h-9 rounded-full border-2 border-indigo-400/30 border-t-indigo-400 animate-spin" />
        <p className="text-xs font-medium tracking-wide text-white/65">
          Ripristino sessione METATRON...
        </p>
      </div>
    );
  }

  if (!authUser || !authToken) {
    return <AuthScreen onAuthenticated={handleAuthenticated} />;
  }

  return (
    <div className="h-screen w-screen overflow-hidden">
      <SynologyDesktopOS
        currentUser={authUser}
        loads={loads}
        activeLoad={activeLoad}
        summary={summary}
        statusNotice={statusNotice}
        isRealtimeConnected={isRealtimeConnected}
        activeUsersCount={activeUsersCount}
        selected3DPalletId={selected3DPalletId}
        onLogout={handleLogout}
        onActiveTutorialContextChange={handleActiveTutorialContextChange}
        onOpenTutorial={() => setIsTutorialOpen(true)}
        onSelectLoad={setActiveLoadId}
        onOpenNewLoadModal={() => setShowNewLoadModal(true)}
        onDuplicateLoad={handleDuplicateLoad}
        onUpdateProjectName={handleUpdateProjectName}
        onClearCurrentLoad={handleClearCurrentLoad}
        onOpenPrintModal={() => setShowPrintModal(true)}
        onOpenPdfDirect={() => {
          const url = getPackingListPdfBlobUrl(activeLoad);
          openPdfBlobInNewTab(url);
        }}
        onSaveToFolder={handleSaveCommessaToFolder}
        onImportJSON={handleImportJSONBackup}
        onExportCSV={() => exportLoadToCSV(activeLoad)}
        onOpenNetworkSyncModal={() => setShowNetworkSyncModal(true)}
        onOpenPdfTranslator={() => setShowPdfTranslator(true)}
        onOpenKitModal={(defaultPalletId) => {
          setKitDefaultPalletId(
            defaultPalletId || activeLoad.pallets[0]?.id || null
          );
          setShowKitModal(true);
        }}
        onForceReload={handleForceReload}
        notifications={unifiedNotifications}
        onMarkNotificationRead={handleMarkNotificationRead}
        onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
        onDismissNotification={handleDismissNotification}
        renderAppContent={renderSynologyAppContent}
      />

      {/* SCHERMATA DI BENVENUTO / SALUTO METATRON */}
      {metatronSplash && (
        <MetatronBootSplash
          key={`${metatronSplash.mode}-${metatronSplash.userName}`}
          mode={metatronSplash.mode}
          userName={metatronSplash.userName}
          onComplete={() => {
            if (metatronSplash.mode === 'logout') {
              finalizeLogout();
            } else {
              setMetatronSplash(null);
            }
          }}
        />
      )}

      {/* GUIDA / TUTORIAL INTERATTIVO SALTATE O NON CHIEDERE PIU PER OGNI APP */}
      <AppTutorialGuide
        contextId={activeTutorialContext}
        isOpen={isTutorialOpen && !metatronSplash}
        onSkipSession={handleSkipTutorialSession}
        onDontAskAgainForApp={handleDontAskTutorialForApp}
        onDontAskAgainEver={handleDontAskTutorialEver}
      />

      {/* MODALE NUOVO PROGETTO / NUOVA COMMESSA */}
      {showNewLoadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h2 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
                Crea Nuovo Progetto / Nuova Commessa di Spedizione
              </h2>
              <button
                type="button"
                onClick={() => setShowNewLoadModal(false)}
                className="text-xs font-semibold text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                Chiudi
              </button>
            </div>

            <form
              onSubmit={handleCreateNewLoad}
              className="space-y-3.5 text-xs"
            >
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Codice Commessa
                  </label>
                  <input
                    type="text"
                    placeholder={`COM-${String(loads.length + 1).padStart(
                      3,
                      '0'
                    )}`}
                    value={newLoadCode}
                    onChange={(e) => setNewLoadCode(e.target.value)}
                    className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">
                    Nome Progetto / Commessa Spedizione *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="es. Commessa Impianto Automazione Linea 4"
                    value={newLoadTitle}
                    onChange={(e) => setNewLoadTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              {crmContacts.some((c) => c.kind === 'cliente' || c.kind === 'entrambi') && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Compila rapido da Rubrica Clienti
                  </label>
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      const c = crmContacts.find((x) => x.id === e.target.value);
                      if (!c) return;
                      setNewLoadClient(c.companyName);
                      const dest =
                        c.shippingAddress ||
                        [c.billingAddress, c.city].filter(Boolean).join(', ');
                      if (dest) setNewLoadDest(dest);
                      if (c.defaultCarrier) setNewLoadCarrier(c.defaultCarrier);
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600"
                  >
                    <option value="">Seleziona un cliente dalla rubrica...</option>
                    {crmContacts
                      .filter((c) => c.kind === 'cliente' || c.kind === 'entrambi')
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.companyName} {c.city ? `(${c.city})` : ''}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Cliente / Destinatario
                  </label>
                  <input
                    type="text"
                    placeholder="Ragione Sociale"
                    value={newLoadClient}
                    onChange={(e) => setNewLoadClient(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Destinazione di Scarico
                  </label>
                  <input
                    type="text"
                    placeholder="Città / Stabilimento"
                    value={newLoadDest}
                    onChange={(e) => setNewLoadDest(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Vettore / Mezzo
                  </label>
                  <input
                    type="text"
                    value={newLoadCarrier}
                    onChange={(e) => setNewLoadCarrier(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Posti Bancale Max
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={34}
                    value={newLoadMaxPallets}
                    onChange={(e) =>
                      setNewLoadMaxPallets(Number(e.target.value))
                    }
                    className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Portata Max (kg)
                  </label>
                  <input
                    type="number"
                    min={100}
                    step={100}
                    value={newLoadMaxWeight}
                    onChange={(e) =>
                      setNewLoadMaxWeight(Number(e.target.value))
                    }
                    className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowNewLoadModal(false)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-900 font-semibold cursor-pointer"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  Crea Commessa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODALE GENERATORE KIT RIPETITIVO */}
      {showKitModal && (
        <KitGeneratorModal
          load={activeLoad}
          defaultPalletId={kitDefaultPalletId}
          onCreateKit={handleCreateKit}
          onClose={() => setShowKitModal(false)}
        />
      )}

      {/* MODALE STAMPA SELETTIVA, SCHEMA ALBERO & FIRME */}
      {showPrintModal && (
        <PrintablePackingModal
          load={activeLoad}
          summary={summary}
          movements={inventory.movements}
          onSaveSignature={handleSaveSignature}
          onDeleteSignature={handleDeleteSignature}
          onClose={() => setShowPrintModal(false)}
          onOpenPdfTranslator={() => setShowPdfTranslator(true)}
        />
      )}

      {/* MODALE TRASFORMA IN APP CHROME & SINCRONIZZAZIONE RETE LOCALE */}
      {showNetworkSyncModal && (
        <NetworkSyncPwaModal
          onClose={() => setShowNetworkSyncModal(false)}
          onSaveCurrentCommessa={handleSaveCommessaToFolder}
          connectedDevicesCount={activeUsersCount}
          isRealtimeConnected={isRealtimeConnected}
          lastSyncTime={lastSyncTime}
          onForceReload={handleForceReload}
        />
      )}

      {/* MODALE TRADUTTORE PDF & DOCUMENTI LOGISTICI */}
      {showPdfTranslator && (
        <PdfTranslatorModal onClose={() => setShowPdfTranslator(false)} />
      )}



      {/* VISUALIZZATORE INTERATTIVO DISTINTA DIGITALE CLIENTE / SMARTPHONE */}
      {showDigitalViewer && (
        <DigitalPackingListViewer
          load={activeLoad}
          onClose={() => {
            setShowDigitalViewer(false);
            // Clean url search params without reloading
            if (typeof window !== 'undefined' && window.history.replaceState) {
              const url = new URL(window.location.href);
              url.searchParams.delete('digital_load');
              url.searchParams.delete('view');
              window.history.replaceState({}, '', url.toString());
            }
          }}
          onSaveDeliverySignature={(sig) => {
            handleSaveSignature(sig);
            showToast('Firma per avvenuta ricezione salvata con successo!');
          }}
        />
      )}
    </div>
  );
}
