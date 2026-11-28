import { useEffect, useState } from 'react';
import type { Firestore } from 'firebase/firestore';
import { subscribeFollowNotices, type FollowNotice } from '../services/follows';

type Inbox = { userId: string; notices: FollowNotice[]; seenAt: number; error: boolean };

export function useFollowInbox(db: Firestore | null, appId: string, userId: string | null, open: boolean) {
  const [inbox, setInbox] = useState<Inbox | null>(null);
  const key = `anilog_follow_notices_seen_${appId}_${userId}`;

  useEffect(() => {
    if (!db || !userId) return;
    let seenAt = 0;
    try { seenAt = Number(localStorage.getItem(key)) || 0; } catch { /* The inbox works without storage. */ }
    setInbox({ userId, notices: [], seenAt, error: false });
    return subscribeFollowNotices(db, appId, userId, notices => {
      setInbox(current => current?.userId === userId ? { ...current, notices, error: false } : current);
    }, () => {
      setInbox(current => current?.userId === userId ? { ...current, notices: [], error: true } : current);
    });
  }, [db, appId, userId, key]);

  const current = userId && inbox?.userId === userId ? inbox : null;
  const latest = current?.notices.find(notice => notice.direction === 'incoming' && notice.timestamp)?.timestamp;
  const latestAt = latest ? latest.seconds * 1000 + (latest.nanoseconds || 0) / 1e6 : 0;
  const unread = latestAt > (current?.seenAt ?? 0);
  useEffect(() => {
    if (!open || !unread) return;
    setInbox(current => current?.userId === userId ? { ...current, seenAt: latestAt } : current);
    try { localStorage.setItem(key, String(latestAt)); } catch { /* Keep the read marker in memory. */ }
  }, [open, unread, userId, key, latestAt]);

  return { notices: current?.notices ?? [], unread: unread && !open, error: current?.error ?? false };
}
