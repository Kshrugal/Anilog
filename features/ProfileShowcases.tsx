import React from 'react';
import { ArrowUp, ArrowDown, X } from 'lucide-react';
import { showcaseUrl, profileShowcase, type ProfileIdentity, type ShowcaseItem } from '../services/profile-identity';
import { ProfileArtworkPicker } from './ProfileArtworkPicker';

export const SHOWCASE_LABELS = { anime: 'Favorite anime', vn: 'Favorite visual novels', characters: 'Favorite characters' };
export function IdentityShowcase({ identity, kind }: { identity: ProfileIdentity; kind: keyof typeof SHOWCASE_LABELS }) {
  const result = profileShowcase(identity, kind);
  return result.hidden ? null : <ProfileShowcase kind={kind} items={result.items} title={result.title} />;
}
export function ProfileShowcase({ kind, items, title }: { kind: keyof typeof SHOWCASE_LABELS; items: ShowcaseItem[]; title?: string }) {
  if (!items.length) return null;
  return <section className="border-t border-white/10 pt-6"><h2 className="text-lg font-semibold mb-5" style={{ color: 'var(--profile-accent)' }}>{title || SHOWCASE_LABELS[kind]}</h2><div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 7rem), 1fr))' }}>{items.map(item => <a key={item.id} href={showcaseUrl(item)} target="_blank" rel="noreferrer" className="min-w-0 group" title={`Open ${item.title} on ${item.source}`}><div className="aspect-[2/3] overflow-hidden rounded-lg border border-white/10"><img src={item.imageUrl} alt="" referrerPolicy="no-referrer" loading="lazy" className="w-full h-full object-cover motion-safe:transition-transform motion-safe:group-hover:scale-105" /></div><p className="mt-2 text-xs font-medium line-clamp-2 group-hover:text-white text-gray-300">{item.title}</p></a>)}</div></section>;
}
export function ShowcaseEditor({ kind, items, entries, onChange }: { kind: keyof typeof SHOWCASE_LABELS; items: ShowcaseItem[]; entries: any[]; onChange: (items: ShowcaseItem[]) => void }) {
  return <div className="space-y-4"><div className="flex items-center justify-between"><h3 className="text-sm font-semibold">{SHOWCASE_LABELS[kind]}</h3><span className="text-xs text-gray-400">{items.length}/8</span></div><div className="space-y-2">{items.map((item, i) => <div key={item.id} className="flex gap-2 items-center border-b border-white/10 pb-2"><img src={item.imageUrl} alt="" className="w-8 h-12 object-cover rounded" /><span className="min-w-0 flex-1 text-xs line-clamp-2">{item.title}</span>{[-1, 1].map(delta => <button key={delta} type="button" title={delta < 0 ? 'Move earlier' : 'Move later'} aria-label={`Move ${item.title} ${delta < 0 ? 'earlier' : 'later'}`} disabled={i + delta < 0 || i + delta >= items.length} className="p-1.5 disabled:opacity-20" onClick={() => { const next = [...items]; [next[i], next[i + delta]] = [next[i + delta], next[i]]; onChange(next); }}>{delta < 0 ? <ArrowUp size={14} /> : <ArrowDown size={14} />}</button>)}<button type="button" title="Remove favorite" aria-label={`Remove ${item.title}`} onClick={() => onChange(items.filter((_, index) => index !== i))} className="p-1.5 text-rose-300"><X size={14} /></button></div>)}</div>{items.length < 8 && <ProfileArtworkPicker key={kind} entries={entries} kind={kind} selected={items.map(i => i.id)} onSelect={item => { if (!items.some(i => i.id === item.id)) { const { id, title, imageUrl, source } = item; onChange([...items, { id, title, imageUrl, source, kind }].slice(0, 8)); } }} />}</div>;
}
