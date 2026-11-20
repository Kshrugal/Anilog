import { useEffect, useState } from 'react';
import type { Firestore } from 'firebase/firestore';
import { MessageSquare, Star, Users } from 'lucide-react';
import { loadMediaFollowing, type FollowingRow } from '../services/media-following';

export function MediaFollowing({ db, appId, userId, mediaId }: { db: Firestore; appId: string; userId: string; mediaId: string }) {
  const [rows, setRows] = useState<FollowingRow[]>([]);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    // Let the dialog paint; quick open-and-close interactions need no social reads.
    const timer = window.setTimeout(() => {
      loadMediaFollowing(db, appId, userId, mediaId, controller.signal)
        .then(result => { if (!controller.signal.aborted) setRows(result); })
        .catch(() => {});
    }, 180);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [db, appId, userId, mediaId]);

  if (rows.length === 0) return null;
  return <section aria-label="Following activity" className="border-y border-white/10 py-3">
    <div className="flex min-h-8 flex-wrap items-center justify-between gap-x-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-white"><Users size={16} className="text-cyan-200/80" />Following</h3>
      {rows.length > 3 && <button type="button" aria-expanded={showAll} onClick={() => setShowAll(!showAll)} className="rounded-md px-2 py-1.5 text-xs font-semibold text-cyan-200/80 transition-colors hover:bg-white/5 hover:text-white">{showAll ? 'Show less' : `View all (${rows.length})`}</button>}
    </div>
    <ul className="divide-y divide-white/5">
      {rows.slice(0, showAll ? undefined : 3).map(row => <li key={row.uid} className="py-2.5">
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/[0.06] text-xs font-semibold text-gray-300">{Array.from(row.username.trim())[0]?.toUpperCase() || '?'}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white" title={row.username}>{row.username}</p>
            <p className="break-words text-xs text-gray-400">{[row.status, row.progress].filter(Boolean).join(' · ')}</p>
          </div>
          {row.score !== null && <span className="flex shrink-0 items-center gap-1.5 text-xs font-semibold tabular-nums text-amber-200"><Star size={13} />{row.score}/10</span>}
        </div>
        {row.review && <details className="ms-11 mt-1">
          <summary className="w-fit cursor-pointer rounded text-xs text-cyan-200/80 hover:text-white"><MessageSquare size={12} className="me-1.5 inline-block" />{row.review.spoiler ? 'Reveal review (spoilers)' : 'Read review'}</summary>
          <p className="mt-2 whitespace-pre-wrap break-words border-l border-white/15 pl-3 text-sm leading-relaxed text-gray-300">{row.review.text}</p>
        </details>}
      </li>)}
    </ul>
  </section>;
}
