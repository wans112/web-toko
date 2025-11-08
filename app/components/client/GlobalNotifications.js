'use client';

import React, { useEffect, useRef, useState } from 'react';
import { notification } from 'antd';

// Polls globally for new orders (admins) and new chat messages (all users)
export default function GlobalNotifications() {
  const [api, contextHolder] = notification.useNotification();
  const userRef = useRef(null); // { id, role }
  const lastOrderIdRef = useRef(null);
  const lastPendingRef = useRef(null);
  const lastChatIdRef = useRef(null);
  const [ready, setReady] = useState(false);

  // Load current user once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const meRes = await fetch('/api/auth/me');
        if (!meRes.ok) return;
        const me = await meRes.json();
        const user = me?.user;
        if (!cancelled && user) {
          userRef.current = { id: user.id, role: user.role };
          setReady(true);
        }
      } catch (_) {}
    })();
    return () => { cancelled = true; };
  }, []);

  // Helper: role check
  const isAdmin = () => {
    const r = (userRef.current?.role || '').toLowerCase();
    return r === 'admin' || r === 'superadmin';
  };

  // Orders poll (admins only)
  useEffect(() => {
    if (!ready || !isAdmin()) return;
    let timer;
    const pollOrders = async () => {
      try {
        const resp = await fetch('/api/order?status=menunggu');
        if (!resp.ok) return;
        const data = await resp.json();
        const pendingCount = data?.stats?.pending ?? (Array.isArray(data?.orders) ? data.orders.length : 0);
        const latestOrder = Array.isArray(data?.orders) && data.orders.length > 0 ? data.orders[0] : null;

        if (lastPendingRef.current == null) {
          lastPendingRef.current = pendingCount;
          if (latestOrder?.id) lastOrderIdRef.current = latestOrder.id;
          return;
        }

        const hasNew = pendingCount > (lastPendingRef.current || 0) || (latestOrder?.id && latestOrder.id !== lastOrderIdRef.current);
        if (hasNew && latestOrder) {
          lastPendingRef.current = pendingCount;
          lastOrderIdRef.current = latestOrder.id;
          api.info({
            key: `order-${latestOrder.id}`,
            message: 'Order baru masuk',
            description: `Pesanan ${latestOrder.order_number || latestOrder.id} menunggu diproses`,
            placement: 'topRight',
            duration: 0,
          });
        }
      } catch (_) {}
    };
    // Start polling
    timer = setInterval(pollOrders, 10000);
    // Prime once
    pollOrders();
    return () => clearInterval(timer);
  }, [ready]);

  // Chat poll (all users)
  useEffect(() => {
    if (!ready || !userRef.current?.id) return;
    let timer;
    const pollChat = async () => {
      try {
        const resp = await fetch('/api/chat?limit=1');
        const data = await resp.json();
        if (!data?.success || !Array.isArray(data.data) || data.data.length === 0) return;
        const latest = data.data[0]; // includes c.* and other_user_*
        if (!latest?.id) return;

        // Consider it incoming if the latest message is addressed to me
        if (latest.to_user_id !== userRef.current.id) {
          // not for me -> ignore
          return;
        }

        if (lastChatIdRef.current == null) {
          lastChatIdRef.current = latest.id;
          return;
        }

        if (latest.id !== lastChatIdRef.current) {
          lastChatIdRef.current = latest.id;
          api.open({
            key: `chat-${latest.id}`,
            message: 'Pesan baru',
            description: `${latest.other_user_name || 'Pengguna'}: ${latest.message}`,
            placement: 'topRight',
            duration: 0,
          });
        }
      } catch (_) {}
    };
    timer = setInterval(pollChat, 8000);
    pollChat();
    return () => clearInterval(timer);
  }, [ready]);

  return <>{contextHolder}</>;
}
