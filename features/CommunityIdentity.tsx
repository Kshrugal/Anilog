import React, { useEffect, useState } from 'react';
import { collection, documentId, getDocs, query, where } from 'firebase/firestore';
import { ACCENTS, normalizeIdentity, type ProfileIdentity } from '../services/profile-identity';
import { IdentityImage } from './ProfileIdentityVisual';

type Portrait = Pick<ProfileIdentity, 'avatar' | 'accent'>;
const cache = new WeakMap<object, Map<string, { value: Portrait | null; expires: number }>>();

export function useCommunityPortraits(db: object | null, appId: string, ids: unknown[]) {
  const key = JSON.stringify([...new Set(ids.filter((id): id is string => typeof id === 'string' && !!id && !id.includes('/')))].sort());
  const [state, setState] = useState<{ db: object; appId: string; values: Record<string, Portrait> } | null>(null);
  useEffect(() => {
    if (!db) return;
    const ids: string[] = JSON.parse(key);
    if (!ids.length) return;
    const records = cache.get(db) || new Map();
    cache.set(db, records);
    let active = true;
    const cacheKey = (id: string) => JSON.stringify([appId, id]);
    const publish = () => {
      if (!active) return;
      setState({ db, appId, values: Object.fromEntries(ids.flatMap(id => {
        const value = records.get(cacheKey(id))?.value;
        return value ? [[id, value]] : [];
      })) });
    };
    publish();
    const missing = ids.filter(id => (records.get(cacheKey(id))?.expires || 0) <= Date.now());
    for (let offset = 0; offset < missing.length; offset += 30) {
      const batch = missing.slice(offset, offset + 30);
      getDocs(query(collection(db as any, `artifacts/${appId}/public/data/profileIdentity`), where(documentId(), 'in', batch))).then(snapshot => {
        const found = new Map(snapshot.docs.map(entry => {
          const { avatar, accent } = normalizeIdentity(entry.data());
          return [entry.id, { avatar, accent }] as const;
        }));
        for (const id of batch) records.set(cacheKey(id), { value: found.get(id) || null, expires: Date.now() + 60_000 });
        if (records.size > 500) for (const [id] of records) { if (records.size <= 500) break; records.delete(id); }
        publish();
      }).catch(() => { /* Initials remain available when artwork cannot be fetched. */ });
    }
    return () => { active = false; };
  }, [db, appId, key]);
  return state?.db === db && state.appId === appId ? state.values : {};
}

export function CommunityAvatar({ name, portrait }: { name?: string; portrait?: Portrait }) {
  return <span className="community-avatar" aria-hidden="true" style={{ color: ACCENTS[portrait?.accent || 'cyan'] }}>
    {portrait?.avatar.url ? <IdentityImage image={portrait.avatar} className="w-full h-full" /> : name?.trim().slice(0, 1).toUpperCase() || '?'}
  </span>;
}
