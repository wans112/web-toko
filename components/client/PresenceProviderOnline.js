'use client';
import { useEffect, useRef } from 'react';

// Sends heartbeat every N ms while tab visible, sets offline on unload
export default function PresenceProvider({ intervalMs = 30000 }) {
  const startedRef = useRef(false);

  useEffect(() => {
    let timer;

    const setOnline = async () => {
      try {
        await fetch('/api/users', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_online: true })
        });
      } catch {}
    };

    const setOffline = async () => {
      try {
        await fetch('/api/users', {
          method: 'PATCH',
          keepalive: true,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_online: false })
        });
      } catch {}
    };

    const tick = async () => {
      await setOnline();
      timer = window.setTimeout(tick, intervalMs);
    };

    const stop = () => {
      window.clearTimeout(timer);
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        stop();
        tick();
      } else {
        stop();
        // don't flip offline just for background tab; server will expire after 5m if needed
      }
    };

    const startIfAuthed = async () => {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include' });
        if (res.ok) {
          startedRef.current = true;
          tick();
          document.addEventListener('visibilitychange', handleVisibility);
          window.addEventListener('beforeunload', setOffline);
          window.addEventListener('pagehide', setOffline);
        }
      } catch {}
    };

    startIfAuthed();

    return () => {
      stop();
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('beforeunload', setOffline);
      window.removeEventListener('pagehide', setOffline);
      if (startedRef.current) setOffline();
    };
  }, [intervalMs]);

  return null;
}
