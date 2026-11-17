import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Upload, Monitor, Smartphone, ArrowUp, ArrowDown, RotateCcw, Eye, Pencil } from 'lucide-react';
import { ACCENTS, MODULES, emptyImage, type ProfileIdentity } from '../services/profile-identity';
import { prepareProfileImage, saveProfileIdentity } from '../services/profile-storage';
import { ProfileIdentityVisual } from './ProfileIdentityVisual';
import { ProfileBio } from './ProfileBio';
import { ProfileArtworkPicker } from './ProfileArtworkPicker';
import { IdentityShowcase, ShowcaseEditor, SHOWCASE_LABELS } from './ProfileShowcases';

export function ProfileIdentityEditor({ db, appId, uid, name, initial, revision, entries, onClose, onSaved }: { db: any; appId: string; uid: string; name: string; initial: ProfileIdentity; revision: number; entries: any[]; onClose: () => void; onSaved: (value: any) => void }) {
  const [draft, setDraft] = useState<ProfileIdentity>(initial);
  const [files, setFiles] = useState<Partial<Record<'avatar' | 'banner', Blob>>>({});
  const [kind, setKind] = useState<'avatar' | 'banner'>('banner');
  const [mobile, setMobile] = useState(false);
  const [previewOnly, setPreviewOnly] = useState(false);
  const [saving, setSaving] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [section, setSection] = useState<'identity' | 'showcases' | 'layout'>('identity');
  const [showcaseKind, setShowcaseKind] = useState<'anime' | 'vn' | 'characters'>('anime');
  const urls = useRef<string[]>([]);
  const dialog = useRef<HTMLDivElement>(null);
  const busy = useRef(false);
  const dirty = useRef(false);
  const generation = useRef(0);
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; }, [onClose]);
  function requestClose() { if (!busy.current && (!dirty.current || window.confirm('Discard unsaved profile changes?'))) close.current(); }
  useEffect(() => {
    const objectUrls = urls.current;
    const invalidateUploads = () => { generation.current++; };
    const previous = document.activeElement as HTMLElement;
    const overflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; dialog.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); requestClose(); }
      if (e.key === 'Tab') {
        const controls = [...(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),[tabindex="0"]') || [])].filter(e => e.getClientRects().length);
        if (!controls.length) { e.preventDefault(); return; }
        if (e.shiftKey && (document.activeElement === controls[0] || document.activeElement === dialog.current)) { e.preventDefault(); controls.at(-1)?.focus(); }
        else if (!e.shiftKey && document.activeElement === controls.at(-1)) { e.preventDefault(); controls[0].focus(); }
      }
    };
    document.addEventListener('keydown', key, true);
    return () => { invalidateUploads(); objectUrls.forEach(URL.revokeObjectURL); document.body.style.overflow = overflow; document.removeEventListener('keydown', key, true); previous?.focus(); };
  }, []);
  function change(patch: Partial<ProfileIdentity>) { dirty.current = true; setDraft(d => ({ ...d, ...patch })); }
  async function upload(file?: File) {
    if (!file) return;
    const current = ++generation.current, selectedKind = kind;
    setError(''); setProcessing(true); busy.current = true;
    try {
      const blob = await prepareProfileImage(file);
      if (current !== generation.current) return;
      const url = URL.createObjectURL(blob); urls.current.push(url);
      setFiles(f => ({ ...f, [selectedKind]: blob }));
      change({ [selectedKind]: { ...emptyImage(), url }, ...(selectedKind === 'banner' ? { bannerMode: 'image' } : {}) });
    } catch (e) { if (current === generation.current) setError(e instanceof Error ? e.message : 'Image could not be opened.'); }
    finally { if (current === generation.current) { setProcessing(false); busy.current = false; } }
  }
  async function save() {
    if (busy.current) return; busy.current = true; setSaving(true); setError('');
    try { const result = await saveProfileIdentity(db, appId, uid, draft, files, revision); dirty.current = false; onSaved(result); }
    catch (e) { setError(e instanceof Error ? e.message : 'Profile could not be saved.'); }
    finally { busy.current = false; setSaving(false); }
  }
  const covers = [...draft.showcases.anime, ...draft.showcases.vn, ...entries].map(e => e.imageUrl || e.image).filter((url, i, all) => url && all.indexOf(url) === i);
  return createPortal(<div className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-md p-3 sm:p-6 flex items-center justify-center" onClick={requestClose}>
    <div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="identity-editor-title" onClick={e => e.stopPropagation()} className="w-full max-w-6xl max-h-[94dvh] flex flex-col overflow-hidden rounded-lg border border-white/20 bg-[#08090f] text-white shadow-2xl">
      <header className="flex justify-between items-center gap-3 p-5 border-b border-white/10"><h2 id="identity-editor-title" className="text-lg font-semibold min-w-0">Customize profile</h2><div className="flex shrink-0"><button title={previewOnly ? 'Edit profile' : 'Preview profile'} aria-label={previewOnly ? 'Edit profile' : 'Preview profile'} onClick={() => { setPreviewOnly(value => !value); setMobile(true); }} className="p-2 lg:hidden">{previewOnly ? <Pencil size={20} /> : <Eye size={20} />}</button><button aria-label="Close profile editor" disabled={saving || processing} onClick={requestClose} className="p-2"><X size={20} /></button></div></header>
      <nav aria-label="Profile editor sections" className="flex gap-2 px-5 py-3 border-b border-white/10">{(['identity', 'showcases', 'layout'] as const).map(tab => <button key={tab} type="button" aria-pressed={section === tab} onClick={() => { setSection(tab); setPreviewOnly(false); }} className={`px-3 py-2 rounded text-sm capitalize ${section === tab ? 'bg-white text-black' : 'text-gray-400'}`}>{tab}</button>)}</nav>
      <div className="overflow-y-auto min-h-0 grid lg:grid-cols-[22rem_minmax(0,1fr)]">
        <fieldset disabled={saving || processing} className={`min-w-0 p-5 space-y-6 border-b lg:border-r border-white/10 ${previewOnly ? 'hidden lg:block' : ''}`}>
          {section === 'identity' && <>
          <div className="flex gap-2">{(['avatar', 'banner'] as const).map(value => <button key={value} aria-pressed={kind === value} onClick={() => setKind(value)} className={`px-4 py-2 rounded capitalize ${kind === value ? 'bg-white text-black' : 'bg-white/5'}`}>{value}</button>)}</div>
          {kind === 'banner' && <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={draft.bannerMode === 'collage'} onChange={e => change({ bannerMode: e.target.checked ? 'collage' : 'image' })} />Cover collage</label>}
          <label className="block text-sm">Upload {kind}<span className="flex items-center gap-2 mt-2"><Upload size={16} /><input aria-label={`Upload ${kind}`} type="file" accept="image/jpeg,image/png,image/webp" onChange={e => { upload(e.target.files?.[0]); e.target.value = ''; }} className="w-full min-w-0 text-xs" /></span><span className="block text-xs text-gray-500 mt-2">JPEG, PNG, WebP · up to 8 MB</span></label>
          <div className="space-y-3">{[['x', 'Horizontal focus', 0, 100, 1], ['y', 'Vertical focus', 0, 100, 1], ['zoom', 'Zoom', 1, 3, 0.05]].map(([key, label, min, max, step]) => <label key={key} className="block text-xs text-gray-300">{label}<input aria-label={String(label)} type="range" min={min} max={max} step={step} value={draft[kind][key]} onChange={e => change({ [kind]: { ...draft[kind], [key]: Number(e.target.value) } })} className="block w-full mt-2" /></label>)}<button onClick={() => { change({ [kind]: emptyImage(), ...(kind === 'banner' ? { bannerMode: 'collage' } : {}) }); setFiles(f => ({ ...f, [kind]: undefined })); }} className="text-xs flex gap-2 items-center"><RotateCcw size={14} />Reset {kind}</button></div>
          <details><summary className="cursor-pointer text-sm mb-3">Choose character or media artwork</summary><ProfileArtworkPicker entries={entries} onSelect={item => { const url = kind === 'banner' && item.banner ? item.banner : item.imageUrl; change({ [kind]: { ...emptyImage(), url }, ...(kind === 'banner' ? { bannerMode: 'image' } : {}) }); setFiles(f => ({ ...f, [kind]: undefined })); }} /></details>
          <div><label htmlFor="profile-bio" className="block text-sm mb-2">Bio</label><textarea id="profile-bio" maxLength={2000} value={draft.bio} onChange={e => change({ bio: e.target.value })} className="w-full h-32 rounded border border-white/15 bg-black/20 p-3 text-sm" /><p className="text-xs text-gray-500">{draft.bio.length}/2000 · **bold**, *italic*, ||spoiler||</p></div>
          <div><p className="text-sm mb-3">Public profile accent</p><div className="flex gap-3">{Object.entries(ACCENTS).map(([name, color]) => <button key={name} title={name} aria-label={`${name} accent`} aria-pressed={draft.accent === name} onClick={() => change({ accent: name as any })} className={`w-8 h-8 rounded-full border-2 ${draft.accent === name ? 'border-white ring-2 ring-white/30' : 'border-transparent'}`} style={{ background: color }} />)}</div></div>
          </>}
          {section === 'showcases' && <><div className="space-y-2"><p className="text-xs font-medium text-gray-400">Media showcase</p><div role="group" aria-label="Media showcase layout" className="flex border-b border-white/10">{(['combined', 'separate'] as const).map(mode => <button key={mode} type="button" aria-pressed={(draft.mediaLayout || 'separate') === mode} onClick={() => change({ mediaLayout: mode })} className={`flex-1 py-2.5 text-xs border-b-2 transition-colors ${(draft.mediaLayout || 'separate') === mode ? 'border-cyan-200 text-white' : 'border-transparent text-gray-500 hover:text-white'}`}>{mode === 'combined' ? 'Favorite media' : 'Anime + visual novels'}</button>)}</div></div><select aria-label="Showcase category" value={showcaseKind} onChange={e => setShowcaseKind(e.target.value as any)} className="w-full bg-[#161b25] border border-white/15 rounded p-2 text-sm">{Object.entries(SHOWCASE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><ShowcaseEditor key={showcaseKind} kind={showcaseKind} entries={entries} items={draft.showcases[showcaseKind]} onChange={items => change({ showcases: { ...draft.showcases, [showcaseKind]: items } })} /></>}
          {section === 'layout' && <div><p className="text-sm mb-3">Overview sections</p>{[...draft.modules, ...MODULES.filter(m => !draft.modules.includes(m))].map((module, i) => <div key={module} className="flex items-center gap-3 py-2 border-b border-white/5"><label className="flex-1 capitalize text-sm"><input type="checkbox" checked={draft.modules.includes(module)} onChange={e => change({ modules: e.target.checked ? [...draft.modules, module] : draft.modules.filter(m => m !== module) })} className="mr-3" />{SHOWCASE_LABELS[module] || module}</label>{[-1, 1].map(delta => <button key={delta} aria-label={`Move ${module} ${delta < 0 ? 'up' : 'down'}`} disabled={!draft.modules.includes(module) || i + delta < 0 || i + delta >= draft.modules.length} onClick={() => { const next = [...draft.modules]; [next[i], next[i + delta]] = [next[i + delta], next[i]]; change({ modules: next }); }} className="p-2 disabled:opacity-20">{delta < 0 ? <ArrowUp size={14} /> : <ArrowDown size={14} />}</button>)}</div>)}</div>}
        </fieldset>
        <section className={`min-w-0 p-5 bg-black/15 lg:sticky lg:top-0 self-start ${previewOnly ? '' : 'hidden lg:block'}`}><div className="flex justify-between items-center mb-4"><h3 className="text-sm text-gray-400">Preview</h3><div className="flex gap-2"><button title="Desktop preview" aria-label="Desktop preview" aria-pressed={!mobile} onClick={() => setMobile(false)} className={`p-2 rounded ${!mobile ? 'bg-white/10' : ''}`}><Monitor size={18} /></button><button title="Mobile preview" aria-label="Mobile preview" aria-pressed={mobile} onClick={() => setMobile(true)} className={`p-2 rounded ${mobile ? 'bg-white/10' : ''}`}><Smartphone size={18} /></button></div></div>
          <div className={`mx-auto border border-white/10 ${mobile ? 'max-w-[360px]' : 'w-full'}`} style={{ '--profile-accent': ACCENTS[draft.accent] } as React.CSSProperties}>
            <ProfileIdentityVisual identity={draft} name={name} covers={covers} mobile={mobile} />
            <div className="p-5 space-y-6">{draft.modules.map(module => module in SHOWCASE_LABELS ? <IdentityShowcase key={module} kind={module as keyof typeof SHOWCASE_LABELS} identity={draft} /> : <section key={module}><h3 className="capitalize text-sm font-semibold mb-3" style={{ color: ACCENTS[draft.accent] }}>{module === 'bio' ? 'About' : module}</h3>{module === 'bio' ? <ProfileBio text={draft.bio} /> : module === 'progress' ? <div className="flex gap-2 overflow-hidden">{entries.filter(e => e.status === 'watching').slice(0, 4).map((e, i) => <img key={i} src={e.imageUrl} alt={e.title} className="w-16 h-24 object-cover rounded" />)}</div> : <p className="text-xs text-gray-500">Public activity</p>}</section>)}</div>
          </div>
        </section>
      </div>
      <footer className="p-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-3"><p role="alert" className="text-sm text-rose-300 flex-1 min-w-0">{error || (processing ? 'Preparing image…' : '')}</p><button onClick={requestClose} disabled={saving || processing} className="px-4 py-2 text-sm">Cancel</button><button onClick={save} disabled={saving || processing || (draft.bannerMode === 'image' && !draft.banner.url)} style={{ backgroundColor: ACCENTS[draft.accent] }} className="px-5 py-2 rounded text-black text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-40">{saving ? 'Saving…' : 'Save profile'}</button></footer>
    </div>
  </div>, document.body);
}
