import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { Check, ChevronDown, type LucideIcon } from 'lucide-react';

type Option = { value: string; label: string };

export function CatalogueFilter({ label, icon: Icon, value, options, onChange }: {
  label: string; icon: LucideIcon; value: string; options: Option[]; onChange: (value: string) => void;
}) {
  const id = useId();
  const [menu, setMenu] = useState<{ above: boolean; maxHeight: number } | null>(null);
  const open = menu !== null;
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const selected = Math.max(0, options.findIndex(option => option.value === value));
  const focusOption = (index: number) => list.current?.querySelectorAll<HTMLElement>('[role="option"]')[index]?.focus();

  useEffect(() => {
    if (!open) return;
    focusOption(selected);
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setMenu(null);
    };
    const closeOnResize = () => setMenu(null);
    document.addEventListener('pointerdown', closeOutside);
    window.addEventListener('resize', closeOnResize);
    return () => { document.removeEventListener('pointerdown', closeOutside); window.removeEventListener('resize', closeOnResize); };
  }, [open, selected]);

  const openMenu = () => {
    const bounds = root.current?.getBoundingClientRect();
    if (!bounds) return;
    const below = window.innerHeight - bounds.bottom - 86;
    const above = bounds.top - 12;
    const flip = below < 220 && above > below;
    setMenu({ above: flip, maxHeight: Math.max(100, Math.min(272, flip ? above : below)) });
  };
  const close = () => { setMenu(null); trigger.current?.focus(); };
  const navigate = (event: KeyboardEvent, index: number) => {
    const last = options.length - 1;
    const position = { ArrowDown: Math.min(last, index + 1), ArrowUp: Math.max(0, index - 1), Home: 0, End: last }[event.key];
    if (position !== undefined) { event.preventDefault(); focusOption(position); }
    else if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); }
    else if (event.key.length === 1 && /[a-z0-9]/i.test(event.key) && !event.metaKey && !event.ctrlKey && !event.altKey) {
      const next = Array.from({ length: options.length }, (_, offset) => (index + 1 + offset) % options.length)
        .find(option => options[option].label.toLowerCase().startsWith(event.key.toLowerCase()));
      if (next !== undefined) { event.preventDefault(); focusOption(next); }
    }
  };

  return <div ref={root} className="relative grid min-w-0 gap-1.5" onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) setMenu(null);
  }}>
    <span id={`${id}-label`} className="text-xs font-semibold text-gray-400">{label}</span>
    <button type="button" ref={trigger} className="catalogue-filter-trigger" aria-labelledby={`${id}-label ${id}-value`} aria-haspopup="listbox"
      aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => { if (open) setMenu(null); else openMenu(); }}
      onKeyDown={event => { if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); openMenu(); } }}>
      <Icon size={16} aria-hidden="true" /><span id={`${id}-value`} className="min-w-0 line-clamp-2 break-words leading-tight">{options[selected]?.label}</span><ChevronDown size={15} aria-hidden="true" className={open ? 'rotate-180' : ''} />
    </button>
    {menu && <div id={id} ref={list} role="listbox" aria-labelledby={`${id}-label`} className="catalogue-filter-menu" data-side={menu.above ? 'top' : 'bottom'} style={{ maxHeight: menu.maxHeight }}>
      {options.map((option, index) => <button type="button" key={option.value} role="option" aria-selected={value === option.value}
        tabIndex={-1} onKeyDown={event => navigate(event, index)} onClick={() => { close(); onChange(option.value); }}
        className="catalogue-filter-option">
        <span className="min-w-0 break-words">{option.label}</span>{value === option.value && <Check size={15} aria-hidden="true" />}
      </button>)}
    </div>}
  </div>;
}
