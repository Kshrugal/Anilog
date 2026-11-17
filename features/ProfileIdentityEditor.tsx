import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Monitor, Smartphone, ArrowUp, ArrowDown, Eye, Image as ImageIcon, UserRound, AlignLeft, Heart, PanelsTopLeft, Check, Loader2, Camera, Tv, BookOpen, Users } from 'lucide-react';
import { ThemeContext } from '../App';
import { ACCENTS, emptyImage, type ProfileIdentity } from '../services/profile-identity';
import { profileLayoutRows, toggleProfileModule, moveProfileModule } from '../services/profile-layout';
import { prepareProfileImage, saveProfileIdentity } from '../services/profile-storage';
import { ProfileIdentityVisual } from './ProfileIdentityVisual';
import { ProfileBio } from './ProfileBio';
import { PublicProfileHeader } from './PublicProfile';
import { scoreSummary } from '../services/tracking';
import { ProfileImageEditor } from './ProfileImageEditor';
import { IdentityShowcase, ShowcaseEditor } from './ProfileShowcases';
import './profile-editor.css';

const moduleNames = { bio: 'About', progress: 'In progress', anime: 'Anime favorites', vn: 'Visual novel favorites', characters: 'Character favorites', activity: 'Activity' };
const tabs = [['appearance', 'Appearance', ImageIcon], ['about', 'About', AlignLeft], ['favorites', 'Favorites', Heart], ['layout', 'Layout', PanelsTopLeft]] as const;

export function ProfileIdentityEditor({ db, appId, uid, name, initial, revision, entries, libraryPublic = false, onClose, onSaved }: { db: any; appId: string; uid: string; name: string; initial: ProfileIdentity; revision: number; entries: any[]; libraryPublic?: boolean; onClose: () => void; onSaved: (value: any) => void }) {
  const { theme } = useContext(ThemeContext);
  const uploadsEnabled = (import.meta.env.DEV && import.meta.env.VITE_LOCAL_FIREBASE === 'true') || import.meta.env.VITE_PROFILE_UPLOADS_ENABLED === 'true';
  const [draft, setDraft] = useState<ProfileIdentity>(initial);
  const [files, setFiles] = useState<Partial<Record<'avatar' | 'banner', Blob>>>({});
  const [kind, setKind] = useState<'avatar' | 'banner'>('avatar');
  const [section, setSection] = useState<typeof tabs[number][0]>('appearance');
  const [showcaseKind, setShowcaseKind] = useState<'anime' | 'vn' | 'characters'>('anime');
  const [mobile, setMobile] = useState(false);
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [error, setError] = useState('');
  const [changed, setChanged] = useState(false);
  const urls = useRef<string[]>([]);
  const dialog = useRef<HTMLDivElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  useEffect(() => { scroll.current?.scrollTo({ top: 0 }); }, [section, preview]);
  const busy = useRef(false);
  const dirty = useRef(false);
  const generation = useRef(0);
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; }, [onClose]);
  function requestClose() { if (!busy.current) { if (dirty.current) setDiscard(true); else close.current(); } }
  useEffect(() => {
    const objectUrls = urls.current;
    const invalidateUploads = () => { generation.current++; };
    const previous = document.activeElement as HTMLElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; dialog.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); requestClose(); }
      if (e.key === 'Tab') {
        const controls = [...(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),summary,[tabindex="0"]') || [])].filter(element => element.getClientRects().length);
        if (!controls.length) { e.preventDefault(); return; }
        if (!dialog.current?.contains(document.activeElement) || (e.shiftKey && (document.activeElement === controls[0] || document.activeElement === dialog.current))) { e.preventDefault(); (e.shiftKey ? controls.at(-1) : controls[0])?.focus(); }
        else if (!e.shiftKey && document.activeElement === controls.at(-1)) { e.preventDefault(); controls[0].focus(); }
      }
    };
    document.addEventListener('keydown', key, true);
    return () => { invalidateUploads(); objectUrls.forEach(URL.revokeObjectURL); document.body.style.overflow = overflow; document.removeEventListener('keydown', key, true); previous?.focus(); };
  }, []);
  const change = useCallback((patch: Partial<ProfileIdentity>) => { dirty.current = true; setChanged(true); setDiscard(false); setDraft(value => ({ ...value, ...patch })); }, []);
  function editImage(target: 'avatar' | 'banner') { setSection('appearance'); setPreview(false); setKind(target); }
  async function upload(file?: File) {
    if (!file || !uploadsEnabled || busy.current) return;
    const current = ++generation.current, selectedKind = kind;
    setError(''); setProcessing(true); busy.current = true;
    try {
      const blob = await prepareProfileImage(file);
      if (current !== generation.current) return;
      const url = URL.createObjectURL(blob); urls.current.push(url);
      setFiles(value => ({ ...value, [selectedKind]: blob }));
      change({ [selectedKind]: { ...emptyImage(), url }, ...(selectedKind === 'banner' ? { bannerMode: 'image' } : {}) });
    } catch (e) { if (current === generation.current) setError(e instanceof Error ? e.message : 'Image could not be opened.'); }
    finally { if (current === generation.current) { setProcessing(false); busy.current = false; } }
  }
  async function save() {
    if (busy.current) return;
    busy.current = true; setSaving(true); setError(''); setDiscard(false);
    try { const result = await saveProfileIdentity(db, appId, uid, draft, files, revision); dirty.current = false; onSaved(result); }
    catch (e) { setError(e instanceof Error ? e.message : 'Profile could not be saved.'); }
    finally { busy.current = false; setSaving(false); }
  }
  const covers = [...draft.showcases.anime, ...draft.showcases.vn, ...(preview && !libraryPublic ? [] : entries)].map(entry => entry.imageUrl || entry.image).filter((url, index, all) => url && all.indexOf(url) === index);
  const hasImage = !!draft[kind].url && (kind === 'avatar' || draft.bannerMode === 'image');
  const progress = entries.filter(entry => ['watching', 'reading'].includes(entry.status));
  const orderedModules = profileLayoutRows(draft);
  const previewStats = useMemo(() => ({ completed: entries.filter(entry => entry.status === 'completed').length, meanScore: scoreSummary(entries).meanScore }), [entries]);
  const enabledRows = orderedModules.filter(module => draft.modules.includes(module));
  return createPortal(<div className="pie-overlay" onClick={requestClose}>
    <div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="identity-editor-title" className="pie-dialog" onClick={e => e.stopPropagation()} style={{ '--editor-accent': theme.scrollbarThumb, '--editor-button-text': theme.id === 'monochrome' ? '#09090b' : '#fff' } as React.CSSProperties}>
      <header className="pie-header"><div><p className="pie-kicker">{name} <span>/</span> Profile</p><h2 id="identity-editor-title">Customize profile</h2></div><div className="pie-header-actions"><button type="button" className="pie-icon" title={preview ? 'Return to editing' : 'Preview profile'} aria-label={preview ? 'Return to editing' : 'Preview profile'} aria-pressed={preview} onClick={() => setPreview(value => !value)}><Eye size={18} /></button><button type="button" className="pie-icon" title="Close profile editor" aria-label="Close profile editor" disabled={saving || processing} onClick={requestClose}><X size={20} /></button></div></header>
      <nav className="pie-nav" aria-label="Profile editor sections">{tabs.map(([id, label, Icon]) => <button type="button" key={id} disabled={saving || processing} aria-pressed={!preview && section === id} onClick={() => { setSection(id); setPreview(false); }}><Icon size={16} /><span>{label}</span></button>)}</nav>
      <div className="pie-scroll" ref={scroll}>
        <div className={`pie-profile-preview ${preview ? 'is-preview' : ''} ${preview && mobile ? 'is-mobile' : ''}`} style={{ '--profile-accent': ACCENTS[draft.accent] } as React.CSSProperties}>
          {preview ? <PublicProfileHeader identity={draft} name={name} entries={libraryPublic ? entries : []} favorites={[]} stats={previewStats} privateLibrary={!libraryPublic} loading={false} showTabs={false} tab="overview" onTab={undefined} onBack={undefined} onRefresh={undefined} canFollow={false} following={false} followBusy={false} onFollow={undefined} canCompare={false} /> : <div className="pie-hero"><ProfileIdentityVisual identity={draft} name={name} covers={covers} mobile={preview && mobile} compact={!preview} />{!preview && <div className="pie-hero-actions"><button type="button" disabled={saving || processing} aria-pressed={section === 'appearance' && kind === 'avatar'} onClick={() => editImage('avatar')}><UserRound size={14} />Profile picture</button><button type="button" disabled={saving || processing} aria-pressed={section === 'appearance' && kind === 'banner'} onClick={() => editImage('banner')}><Camera size={14} />Banner</button></div>}</div>}
          {preview ? <div className="pie-full-preview"><div className="pie-preview-toolbar"><span className="pie-kicker">{libraryPublic ? 'Visitor appearance' : 'Visitor appearance / Private library'}</span><div className="pie-segments"><button type="button" title="Desktop preview" aria-label="Desktop preview" aria-pressed={!mobile} onClick={() => setMobile(false)}><Monitor size={16} /></button><button type="button" title="Mobile preview" aria-label="Mobile preview" aria-pressed={mobile} onClick={() => setMobile(true)}><Smartphone size={16} /></button></div></div>{draft.modules.map(module => module === 'bio' ? draft.modules[0] !== 'bio' && draft.bio && <section className="pie-preview-section" key={module}><h3>About</h3><ProfileBio text={draft.bio} /></section> : module === 'progress' ? libraryPublic && <section className="pie-preview-section" key={module}><h3>In progress</h3><div className="pie-progress">{progress.slice(0, 6).map(entry => <div key={entry.kitsuId || entry.id}><img src={entry.imageUrl} alt="" /><p>{entry.title}</p></div>)}</div>{!progress.length && <p className="pie-muted">No titles in progress.</p>}</section> : module === 'activity' ? null : <IdentityShowcase key={module} identity={draft} kind={module as 'anime' | 'vn' | 'characters'} />)}</div> : null}
        </div>
        {!preview && <fieldset disabled={saving || processing} className="pie-fields">
          {section === 'appearance' && <section className="pie-appearance-section">
            <div className="pie-section-heading"><div><p className="pie-kicker">Identity</p><h3>{kind === 'avatar' ? 'Profile picture' : 'Banner'}</h3></div></div>
            <ProfileImageEditor key={kind} kind={kind} image={draft[kind]} hasImage={hasImage} enabled={uploadsEnabled} disabled={saving || processing} onUpload={upload} onChange={image => change({ [kind]: image })} onRemove={() => { change({ [kind]: emptyImage(), ...(kind === 'banner' ? { bannerMode: 'collage' } : {}) }); setFiles(value => ({ ...value, [kind]: undefined })); }} />
            <div className="pie-accent-section"><div className="pie-section-heading"><h3>Profile accent</h3></div><div className="pie-swatches">{Object.entries(ACCENTS).map(([id, color]) => <button type="button" key={id} title={id} aria-label={`${id} accent`} aria-pressed={draft.accent === id} onClick={() => change({ accent: id as any })} style={{ background: color }}>{draft.accent === id && <Check size={15} />}</button>)}</div></div>
          </section>}
          {section === 'about' && <div className="pie-edit-grid"><section className="pie-main-section"><div className="pie-section-heading"><div><p className="pie-kicker">Identity</p><h3>About you</h3></div><span className="pie-muted">{draft.bio.length}/2000</span></div><label className="pie-sr-only" htmlFor="profile-bio">Bio</label><textarea id="profile-bio" maxLength={2000} value={draft.bio} onChange={e => change({ bio: e.target.value })} placeholder="A little about you..." /><div className="pie-format-toolbar">{[['Bold', '**', 'Text'], ['Italic', '*', 'Text'], ['Spoiler', '||', 'Spoiler']].map(([label, marker, placeholder]) => <button type="button" key={label} onClick={() => { const input = document.getElementById('profile-bio') as HTMLTextAreaElement; const start = input.selectionStart, end = input.selectionEnd; const selected = draft.bio.slice(start, end) || placeholder; const next = draft.bio.slice(0, start) + marker + selected + marker + draft.bio.slice(end); if (next.length <= 2000) { change({ bio: next }); requestAnimationFrame(() => { input.focus(); input.setSelectionRange(start + marker.length, start + marker.length + selected.length); }); } }}><span className={label === 'Bold' ? 'font-bold' : label === 'Italic' ? 'italic' : ''}>{label}</span></button>)}</div></section><aside className="pie-side-section"><div className="pie-section-heading"><h3>About</h3><Eye size={15} /></div>{draft.bio ? <ProfileBio text={draft.bio} /> : <p className="pie-muted">No bio yet.</p>}</aside></div>}
          {section === 'favorites' && <div className="pie-favorites-section"><div className="pie-section-heading"><div><p className="pie-kicker">Showcase</p><h3>Favorites</h3></div><div className="pie-segments" role="group" aria-label="Media showcase layout">{(['combined', 'separate'] as const).map(mode => <button type="button" key={mode} aria-pressed={(draft.mediaLayout || 'separate') === mode} onClick={() => change({ mediaLayout: mode })}>{mode === 'combined' ? 'Favorite media' : 'Separate lists'}</button>)}</div></div><div className="pie-category-tabs" role="group" aria-label="Showcase category">{([['anime', 'Anime', Tv], ['vn', 'Visual novels', BookOpen], ['characters', 'Characters', Users]] as const).map(([id, label, Icon]) => <button type="button" key={id} aria-pressed={showcaseKind === id} onClick={() => setShowcaseKind(id)}><Icon size={15} />{label}<span>{draft.showcases[id].length}/8</span></button>)}</div><ShowcaseEditor key={showcaseKind} kind={showcaseKind} entries={entries} items={draft.showcases[showcaseKind]} onChange={items => change({ showcases: { ...draft.showcases, [showcaseKind]: items } })} /><div className="pie-shelf-preview" style={{ '--profile-accent': ACCENTS[draft.accent] } as React.CSSProperties}><IdentityShowcase identity={draft} kind={draft.mediaLayout === 'combined' ? (draft.modules.find(module => module === 'anime' || module === 'vn') || 'anime') as 'anime' | 'vn' : showcaseKind} />{draft.mediaLayout === 'combined' && showcaseKind === 'characters' && <IdentityShowcase identity={draft} kind="characters" />}</div></div>}
          {section === 'layout' && <section className="pie-layout-section"><div className="pie-section-heading"><div><p className="pie-kicker">Overview</p><h3>Profile sections</h3></div><button type="button" className="pie-text-action" onClick={() => { setPreview(true); }}>Preview<Eye size={14} /></button></div>{orderedModules.map((module, index) => <div className="pie-module-row" key={module}><span className="pie-module-number">{draft.modules.includes(module) ? String(index + 1).padStart(2, '0') : '--'}</span><label className="pie-module-label"><input type="checkbox" checked={draft.modules.includes(module)} onChange={e => change({ modules: toggleProfileModule(draft, module, e.target.checked) })} /><span>{draft.mediaLayout === 'combined' && ['anime', 'vn'].includes(module) ? 'Favorite media' : moduleNames[module]}</span></label><div className="pie-order-buttons">{[-1, 1].map(delta => <button type="button" className="pie-icon" key={delta} title={`Move ${moduleNames[module]} ${delta < 0 ? 'up' : 'down'}`} aria-label={`Move ${module} ${delta < 0 ? 'up' : 'down'}`} disabled={!draft.modules.includes(module) || index + delta < 0 || index + delta >= enabledRows.length} onClick={() => { change({ modules: moveProfileModule(draft, module, delta) }); }}>{delta < 0 ? <ArrowUp size={15} /> : <ArrowDown size={15} />}</button>)}</div></div>)}</section>}
        </fieldset>}
      </div>
      <footer className="pie-footer">{discard ? <><p role="alert">Discard unsaved changes?</p><button type="button" className="pie-secondary" autoFocus onClick={() => setDiscard(false)}>Keep editing</button><button type="button" className="pie-danger" onClick={() => close.current()}>Discard</button></> : <><p className={error ? 'pie-error' : 'pie-muted'} role={error ? 'alert' : 'status'}>{error || (processing ? 'Preparing image...' : changed ? 'Unsaved changes' : '')}</p><button type="button" className="pie-secondary" disabled={saving || processing} onClick={requestClose}>Cancel</button><button type="button" className="pie-primary" disabled={!changed || saving || processing || (draft.bannerMode === 'image' && !draft.banner.url)} onClick={save}>{saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}{saving ? 'Saving...' : 'Save profile'}</button></>}</footer>
    </div>
  </div>, document.body);
}
