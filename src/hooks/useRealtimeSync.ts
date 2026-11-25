import { useEffect, useRef, useState, useCallback } from 'react';
import { CargoLoad } from '../types/warehouse';

export const SYNC_CLIENT_ID = 'client_' + Math.random().toString(36).substring(2, 9);

function areLoadsIdentical(
  a: CargoLoad[] | null | undefined,
  b: CargoLoad[] | null | undefined
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

interface UseRealtimeSyncProps {
  loads: CargoLoad[];
  onRemoteLoadsUpdated: (newLoads: CargoLoad[]) => void;
  onServerEvent?: (event: any) => void;
  storageKey: string;
  authToken: string | null;
  userId: string | null;
}

export function useRealtimeSync({
  loads,
  onRemoteLoadsUpdated,
  onServerEvent,
  storageKey,
  authToken,
  userId,
}: UseRealtimeSyncProps) {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [activeUsersCount, setActiveUsersCount] = useState<number>(1);
  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date());
  const socketRef = useRef<WebSocket | null>(null);
  const isRemoteUpdateRef = useRef<boolean>(false);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const isAuthenticatedWsRef = useRef<boolean>(false);

  const loadsRef = useRef(loads);
  loadsRef.current = loads;
  const onRemoteLoadsUpdatedRef = useRef(onRemoteLoadsUpdated);
  onRemoteLoadsUpdatedRef.current = onRemoteLoadsUpdated;
  const onServerEventRef = useRef(onServerEvent);
  onServerEventRef.current = onServerEvent;
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 1. Cross-tab real-time sync scoped STRICTLY by userId
  useEffect(() => {
    if (!userId) return;
    try {
      const channel = new BroadcastChannel(`caricostudio_rt_${userId}`);
      broadcastChannelRef.current = channel;

      channel.onmessage = (event) => {
        if (event.data?.type === 'LOADS_SYNC' && Array.isArray(event.data.loads)) {
          if (event.data.senderId !== SYNC_CLIENT_ID) {
            if (areLoadsIdentical(event.data.loads, loadsRef.current)) {
              return;
            }
            isRemoteUpdateRef.current = true;
            onRemoteLoadsUpdatedRef.current(event.data.loads);
            setLastSyncTime(new Date());
            setTimeout(() => {
              isRemoteUpdateRef.current = false;
            }, 100);
          }
        }
      };
    } catch {
      // BroadcastChannel not available
    }

    return () => {
      broadcastChannelRef.current?.close();
      broadcastChannelRef.current = null;
    };
  }, [userId]);

  // 2. Authenticated WebSocket connection scoped to the current user
  const connectWebSocket = useCallback(() => {
    if (!authToken || !userId) {
      setIsConnected(false);
      setActiveUsersCount(1);
      return;
    }

    if (typeof window === 'undefined' || window.location.protocol === 'file:') {
      setIsConnected(true);
      return;
    }

    if (
      socketRef.current &&
      (socketRef.current.readyState === WebSocket.OPEN ||
        socketRef.current.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;
      isAuthenticatedWsRef.current = false;

      ws.onopen = () => {
        // Authenticate the socket before any sync message
        ws.send(JSON.stringify({ type: 'auth', token: authToken }));

        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            try {
              ws.send(JSON.stringify({ type: 'ping' }));
            } catch {}
          }
        }, 20000);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'init') {
            isAuthenticatedWsRef.current = true;
            setIsConnected(true);
            if (typeof msg.count === 'number') setActiveUsersCount(msg.count);
            if (Array.isArray(msg.loads) && msg.loads.length > 0) {
              if (!areLoadsIdentical(msg.loads, loadsRef.current)) {
                isRemoteUpdateRef.current = true;
                onRemoteLoadsUpdatedRef.current(msg.loads);
                setLastSyncTime(new Date());
                setTimeout(() => {
                  isRemoteUpdateRef.current = false;
                }, 100);
              }
            } else {
              // Server empty for this user: push local user cache if present
              try {
                const stored = localStorage.getItem(storageKey);
                const currentData = stored ? JSON.parse(stored) : loadsRef.current;
                if (Array.isArray(currentData) && currentData.length > 0) {
                  ws.send(
                    JSON.stringify({
                      type: 'sync_loads',
                      loads: currentData,
                      senderId: SYNC_CLIENT_ID,
                    })
                  );
                }
              } catch {
                // ignore
              }
            }
          } else if (msg.type === 'auth_error') {
            isAuthenticatedWsRef.current = false;
            setIsConnected(false);
          } else if (msg.type === 'presence') {
            if (typeof msg.count === 'number') {
              setActiveUsersCount(msg.count);
            }
          } else if (msg.type === 'loads_updated') {
            if (msg.senderId !== SYNC_CLIENT_ID && Array.isArray(msg.loads)) {
              if (areLoadsIdentical(msg.loads, loadsRef.current)) {
                return;
              }
              isRemoteUpdateRef.current = true;
              onRemoteLoadsUpdatedRef.current(msg.loads);
              setLastSyncTime(new Date());
              setTimeout(() => {
                isRemoteUpdateRef.current = false;
              }, 100);
            }
          } else if (
            msg.type === 'notification_new' ||
            msg.type === 'share_received' ||
            msg.type === 'calendar_updated'
          ) {
            onServerEventRef.current?.(msg);
          }
        } catch (err) {
          console.warn('Failed to parse WebSocket message:', err);
        }
      };

      ws.onclose = () => {
        isAuthenticatedWsRef.current = false;
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
        setIsConnected(false);
        if (authToken && userId) {
          if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = setTimeout(connectWebSocket, 3000);
        }
      };

      ws.onerror = () => {
        try {
          ws.close();
        } catch {}
      };
    } catch (err) {
      console.warn('WebSocket connection error:', err);
      setIsConnected(false);
    }
  }, [storageKey, authToken, userId]);

  useEffect(() => {
    connectWebSocket();
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      if (socketRef.current) {
        socketRef.current.onclose = null;
        socketRef.current.close();
        socketRef.current = null;
      }
      isAuthenticatedWsRef.current = false;
    };
  }, [connectWebSocket]);

  // 3. Broadcast local state mutations strictly within current user session
  const broadcastLoads = useCallback((newLoads: CargoLoad[]) => {
    if (isRemoteUpdateRef.current) {
      return;
    }

    try {
      broadcastChannelRef.current?.postMessage({
        type: 'LOADS_SYNC',
        loads: newLoads,
        senderId: SYNC_CLIENT_ID,
      });
    } catch {
      // ignore
    }

    if (
      isAuthenticatedWsRef.current &&
      socketRef.current?.readyState === WebSocket.OPEN
    ) {
      socketRef.current.send(
        JSON.stringify({
          type: 'sync_loads',
          loads: newLoads,
          senderId: SYNC_CLIENT_ID,
        })
      );
    }
    setLastSyncTime(new Date());
  }, []);

  return {
    isConnected,
    activeUsersCount,
    lastSyncTime,
    broadcastLoads,
  };
}
