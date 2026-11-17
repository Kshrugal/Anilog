import React from 'react';
import { ArrowUp, ArrowDown, X } from 'lucide-react';
import { showcaseUrl, profileShowcase, type ProfileIdentity, type ShowcaseItem } from '../services/profile-identity';
import { MemoProfileArtworkPicker as ProfileArtworkPicker } from './ProfileArtworkPicker';

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
  return <div className="pie-favorites-workspace">
    <section className="pie-favorites-list"><div className="pie-section-heading"><h3>Selected</h3><span className="pie-muted">{items.length}/8</span></div>
      {!items.length && <div className="pie-empty">No favorites selected.</div>}
      {items.map((item, index) => <div key={item.id} className="pie-favorite-row"><img src={item.imageUrl} alt="" /><p>{item.title}</p><div className="pie-favorite-actions">{[-1, 1].map(delta => <button key={delta} type="button" className="pie-icon" title={delta < 0 ? 'Move earlier' : 'Move later'} aria-label={`Move ${item.title} ${delta < 0 ? 'earlier' : 'later'}`} disabled={index + delta < 0 || index + delta >= items.length} onClick={() => { const next = [...items]; [next[index], next[index + delta]] = [next[index + delta], next[index]]; onChange(next); }}>{delta < 0 ? <ArrowUp size={13} /> : <ArrowDown size={13} />}</button>)}<button type="button" className="pie-icon" title="Remove favorite" aria-label={`Remove ${item.title}`} onClick={() => onChange(items.filter((_, i) => i !== index))}><X size={13} /></button></div></div>)}
    </section>
    <section className="min-w-0">{items.length < 8 ? <ProfileArtworkPicker key={kind} entries={entries} kind={kind} selected={items.map(item => item.id)} onSelect={item => { if (!items.some(value => value.id === item.id)) { const { id, title, imageUrl, source } = item; onChange([...items, { id, title, imageUrl, source, kind }].slice(0, 8)); } }} /> : <div className="pie-empty">All eight slots are filled.</div>}</section>
  </div>;
}
