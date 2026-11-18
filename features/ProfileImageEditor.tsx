import React, { useEffect, useRef, useState } from 'react';
import { ImagePlus, RotateCcw, Trash2, Upload, UserRound } from 'lucide-react';
import { IdentityImage } from './ProfileIdentityVisual';
import { type ProfileIdentity } from '../services/profile-identity';

type Props = {
  kind: 'avatar' | 'banner';
  image: ProfileIdentity['avatar'];
  hasImage: boolean;
  enabled: boolean;
  disabled?: boolean;
  onUpload: (file?: File) => void;
  onChange: (image: ProfileIdentity['avatar']) => void;
  onRemove: () => void;
};

export function ProfileImageEditor({ kind, image, hasImage, enabled, disabled = false, onUpload, onChange, onRemove }: Props) {
  const [draggingFile, setDraggingFile] = useState(false);
  const pointer = useRef<{ clientX: number; clientY: number; x: number; y: number; width: number; height: number } | null>(null);
  const frame = useRef<number | null>(null);
  const pending = useRef<ProfileIdentity['avatar'] | null>(null);
  const change = useRef(onChange);
  useEffect(() => { change.current = onChange; }, [onChange]);
  const flush = () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    if (pending.current) { change.current(pending.current); pending.current = null; }
  };
  useEffect(() => () => { if (frame.current !== null) cancelAnimationFrame(frame.current); }, []);
  useEffect(() => { pointer.current = null; pending.current = null; if (frame.current !== null) cancelAnimationFrame(frame.current); frame.current = null; }, [kind]);
  const name = kind === 'avatar' ? 'profile picture' : 'banner';
  return <div className="pie-image-workspace">
    <section className="pie-image-stage" onDragOver={event => { if (enabled && !disabled) { event.preventDefault(); setDraggingFile(true); } }} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDraggingFile(false); }} onDrop={event => { event.preventDefault(); setDraggingFile(false); if (enabled && !disabled) onUpload(event.dataTransfer.files[0]); }} data-dragging={draggingFile}>
      <div className="pie-image-actions"><label className={`pie-upload ${!enabled ? 'is-disabled' : ''}`}><Upload size={15} />{hasImage ? 'Replace image' : 'Upload image'}<input disabled={!enabled} aria-label={`Upload ${kind}`} type="file" accept="image/jpeg,image/png,image/webp" onChange={event => { onUpload(event.target.files?.[0]); event.target.value = ''; }} /></label>{hasImage && <button type="button" className="pie-icon" title={`Remove ${name}`} aria-label={`Remove ${name}`} onClick={onRemove}><Trash2 size={16} /></button>}</div>
      <p className="pie-muted pie-image-hint">{enabled ? 'JPEG, PNG or WebP · Up to 8 MB' : 'Image uploads are not available yet.'}</p>
      <div className={`pie-image-canvas ${kind === 'avatar' ? 'is-avatar' : ''}`}>
        <div className={`pie-crop-preview ${kind === 'avatar' ? 'is-avatar' : ''} ${hasImage ? 'is-draggable' : ''}`} title={hasImage ? 'Drag to reposition' : undefined}
          onPointerDown={event => { if (!hasImage || disabled) return; const bounds = event.currentTarget.getBoundingClientRect(); pointer.current = { clientX: event.clientX, clientY: event.clientY, x: image.x, y: image.y, width: bounds.width, height: bounds.height }; event.currentTarget.setPointerCapture(event.pointerId); event.preventDefault(); }}
          onPointerMove={event => { const start = pointer.current; if (!start || disabled) return; const clamp = (value: number) => Math.round(Math.max(0, Math.min(100, value))); pending.current = { ...image, x: clamp(start.x - (event.clientX - start.clientX) / start.width * 100), y: clamp(start.y - (event.clientY - start.clientY) / start.height * 100) }; if (frame.current === null) frame.current = requestAnimationFrame(flush); }}
          onPointerUp={() => { flush(); pointer.current = null; }} onPointerCancel={() => { flush(); pointer.current = null; }} onLostPointerCapture={() => { flush(); pointer.current = null; }}>
          {hasImage ? <IdentityImage image={image} className="w-full h-full" /> : <div className="pie-image-empty">{kind === 'avatar' ? <UserRound size={36} /> : <ImagePlus size={36} />}<span>No {name}</span></div>}
        </div>
      </div>
    </section>
    <aside className="pie-image-settings"><div className="pie-section-heading"><h3>Framing</h3><button type="button" className="pie-icon" title="Reset framing" aria-label="Reset framing" disabled={!hasImage} onClick={() => onChange({ ...image, x: 50, y: 50, zoom: 1 })}><RotateCcw size={15} /></button></div>
      <div className="pie-crop-controls">{([['x', 'Horizontal focus', 0, 100, 1], ['y', 'Vertical focus', 0, 100, 1], ['zoom', 'Zoom', 1, 3, 0.05]] as const).map(([key, label, min, max, step]) => <label key={key}><span>{label}<output>{key === 'zoom' ? `${image[key].toFixed(2)}x` : `${image[key]}%`}</output></span><input aria-label={label} type="range" disabled={!hasImage} min={min} max={max} step={step} value={image[key]} onChange={event => onChange({ ...image, [key]: Number(event.target.value) })} /></label>)}</div>
    </aside>
  </div>;
}
