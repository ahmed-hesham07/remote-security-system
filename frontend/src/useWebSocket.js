import { useEffect, useRef, useState } from 'react';

/**
 * Connects to the backend WebSocket as a dashboard client.
 * Auto-reconnects with capped exponential backoff.
 *
 * @param {(msg: object) => void} onMessage
 * @returns {{ connected: boolean }}
 */
export function useWebSocket(onMessage) {
  const [connected, setConnected] = useState(false);
  const handlerRef = useRef(onMessage);
  handlerRef.current = onMessage;

  useEffect(() => {
    let ws;
    let cancelled = false;
    let attempt = 0;
    let retryTimer;

    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${proto}//${location.host}/ws?role=dashboard`;

    const connect = () => {
      if (cancelled) return;
      ws = new WebSocket(url);

      ws.onopen = () => {
        attempt = 0;
        setConnected(true);
      };
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          handlerRef.current?.(msg);
        } catch (err) {
          console.warn('WS bad json', err);
        }
      };
      ws.onclose = () => {
        setConnected(false);
        if (cancelled) return;
        const delay = Math.min(15000, 500 * 2 ** attempt++);
        retryTimer = setTimeout(connect, delay);
      };
      ws.onerror = () => ws.close();
    };

    connect();
    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
      try { ws && ws.close(); } catch (_) {}
    };
  }, []);

  return { connected };
}
