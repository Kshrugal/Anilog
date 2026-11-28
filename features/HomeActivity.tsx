import React, { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { doc, onSnapshot, type Firestore } from 'firebase/firestore';
import { followedIds, subscribeCommunityActivity } from '../services/community-activity';
import { CommunityAvatar, useCommunityPortraits } from './CommunityIdentity';

const activityFilters = [
  { id: 'all', label: 'All' },
  { id: 'mine', label: 'Mine' },
  { id: 'following', label: 'Following' },
] as const;
const previewCount = 4;
const activityDate = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });

export function HomeActivity({ db, appId, userId, accentText, onOpen }: {
  db: Firestore;
  appId: string;
  userId: string;
  accentText: string;
  onOpen: () => void;
}) {
  const [items, setItems] = useState<any[]>([]);
  const [status, setStatus] = useState('loading');
  const [filter, setFilter] = useState<(typeof activityFilters)[number]['id']>('all');

  useEffect(() => {
    let stopActivity: (() => void) | undefined;
    let authorKey = '';
    const subscribe = (authors: string[]) => {
      const key = JSON.stringify(authors);
      if (authorKey === key) return;
      authorKey = key;
      stopActivity?.();
      setItems([]);
      setStatus('loading');
      stopActivity = subscribeCommunityActivity(db, appId, userId, authors, previewCount, entries => {
        setItems(entries);
        setStatus('ready');
      }, () => setStatus('error'));
    };
    if (filter === 'mine') {
      subscribe([userId]);
      return () => stopActivity?.();
    }
    if (filter === 'all') subscribe([userId]);
    const stopProfile = onSnapshot(doc(db, `artifacts/${appId}/public/data/users/${userId}`), snapshot => {
      const profile = snapshot.data();
      const following = followedIds(profile?.followingIds || profile?.friends || []).filter(id => id !== userId);
      subscribe((filter === 'all' ? [userId, ...following] : following).sort());
    }, () => setStatus('error'));
    return () => { stopProfile(); stopActivity?.(); };
  }, [db, appId, userId, filter]);

  const portraits = useCommunityPortraits(db, appId, items.map(item => item.userId));
  return <section aria-labelledby="home-activity-heading" className="min-w-0 rounded-3xl border border-white/10 bg-white/[0.035] px-5 py-4">
    <div className="flex items-center justify-between gap-3">
      <h3 id="home-activity-heading" className="text-sm font-bold text-white">Recent activity</h3>
      <button type="button" onClick={onOpen} className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold transition-colors hover:bg-white/10 hover:text-white ${accentText}`}>
        View activity <ArrowRight size={14} aria-hidden="true" />
      </button>
    </div>
    <div role="group" aria-label="Filter activity" className="mb-1 mt-2 flex flex-wrap gap-1.5">
      {activityFilters.map(option => <button key={option.id} type="button" aria-pressed={filter === option.id}
        className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${filter === option.id ? 'border-white bg-white text-black' : 'border-white/10 bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white'}`}
        onClick={() => {
          if (filter === option.id) return;
          setItems([]);
          setStatus('loading');
          setFilter(option.id);
        }}>{option.label}</button>)}
    </div>
    {items.length ? <ul className="mt-1 divide-y divide-white/10 [--avatar-size:30px]">
      {items.map(item => <li key={item.id} className="flex min-w-0 items-center gap-3 py-2">
        <CommunityAvatar name={item.username} portrait={portraits[item.userId]} />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 break-words text-xs text-gray-300">
            <span className="font-semibold text-white">{item.username || 'Anilog member'}</span>{' '}
            {item.context}{' '}<span className={accentText}>{item.animeTitle}</span>
          </p>
          {(item.type === 'text_post' || item.type === 'micro_review') && item.noteContent && (
            <p className="mt-0.5 truncate text-xs text-gray-400">{item.spoiler ? 'Contains spoilers' : item.noteContent}</p>
          )}
        </div>
        {typeof item.timestamp?.seconds === 'number' && (
          <time dateTime={new Date(item.timestamp.seconds * 1000).toISOString()} className="shrink-0 text-[11px] text-gray-400">
            {activityDate.format(item.timestamp.seconds * 1000)}
          </time>
        )}
      </li>)}
    </ul> : <p role="status" className="py-4 text-xs text-gray-400">
      {status === 'loading' ? 'Loading activity…' : status === 'error' ? 'Activity could not be loaded.' : filter === 'following' ? 'No recent posts from mutual follows.' : 'No recent activity.'}
    </p>}
  </section>;
}
