// Small shared UI pieces: icons, status lamps/tags, due chips, priority gauge, sheets.
import { html, useEffect, useRef, useState } from './vendor/preact-htm.js';
import { STATES, dueInfo, priorityOf, displayName, toLocalDate, fmtDay } from './model.js';

const PATHS = {
  check: 'M5 12.5l4.2 4.2L19 7',
  plus: 'M12 5v14M5 12h14',
  back: 'M15 5l-7 7 7 7',
  close: 'M6 6l12 12M18 6L6 18',
  camera: 'M4 8h3l2-2.5h6L17 8h3v11H4zM12 17a4 4 0 100-8 4 4 0 000 8z',
  link: 'M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  trash: 'M5 7h14M10 11v6M14 11v6M7 7l1 13h8l1-13M9 7V4h6v3',
  board: 'M4 5h16v14H4zM4 10h16M9 10v9',
  list: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01',
  inbox: 'M4 13l2.5-8h11L20 13v6H4zM4 13h5l1 2h4l1-2h5',
  plan: 'M4 6h7M8 12h9M13 18h7M4 4v16',
  form: 'M6 3h9l4 4v14H6zM14 3v5h5M9 12h7M9 16h7',
  gear: 'M12 15.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1',
  user: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0',
  users: 'M9 11a4 4 0 100-8 4 4 0 000 8zM2 21a7 7 0 0114 0M16 3.5a4 4 0 010 7.5M18 14.5a6 6 0 014 6.5',
  clock: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3 2',
  alert: 'M12 3l10 18H2zM12 10v5M12 18h.01',
  copy: 'M8 8h12v12H8zM16 8V4H4v12h4',
  logout: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10',
  chevron: 'M9 6l6 6-6 6',
  up: 'M6 15l6-6 6 6',
  down: 'M6 9l6 6 6-6',
  refresh: 'M20 11a8 8 0 10-2.3 5.7M20 4v7h-7',
  send: 'M4 12l16-8-6 16-2.5-6.5z',
  image: 'M4 5h16v14H4zM4 16l5-5 4 4 2-2 5 5M15.5 9.5h.01',
  chat: 'M4 5h16v11h-9l-5 4v-4H4zM8 9.5h8M8 12.5h5',
  clip: 'M9 3.5h6v3H9zM7.5 5H5v16h14V5h-2.5M8.5 13.5l2.5 2.5 4.5-5',
  lock: 'M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 017 0v3',
};

export function Icon({ name, size = 20, label }) {
  return html`<svg class="icon" width=${size} height=${size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden=${label ? undefined : 'true'}
    role=${label ? 'img' : undefined} aria-label=${label}><path d=${PATHS[name]} /></svg>`;
}

/** Andon lamp: idle (white), run (blue), wait (amber), stop (red), ok (green). */
export function Lamp({ state, late, size }) {
  const lamp = late ? 'stop' : STATES[state].lamp;
  return html`<span class=${`lamp lamp--${lamp}${size ? ` lamp--${size}` : ''}`} aria-hidden="true"></span>`;
}

/** Status shown as a hang tag (eyelet + label) like the inspection tags on the shop floor. */
export function StateTag({ state, late, compact }) {
  const s = STATES[state];
  const lamp = late && state !== 'submitted' && state !== 'approved' ? 'stop' : s.lamp;
  const text = late && state !== 'submitted' && state !== 'approved' ? 'เลยกำหนด' : (compact ? s.short : s.label);
  return html`<span class=${`tag tag--${lamp}`}><i class="tag-eye"></i>${text}</span>`;
}

export function DueChip({ due, now, done }) {
  if (done) {
    const d = toLocalDate(due);
    return html`<span class="due due--done">${d ? `กำหนด ${fmtDay(d)}` : 'ไม่กำหนดส่ง'}</span>`;
  }
  const d = dueInfo(due, now);
  return html`<span class=${`due due--${d.tone}`}>${d.text}</span>`;
}

/** In lists only the two levels that change what you do get a mark. */
export function PrioChip({ value }) {
  if (value === 4) return html`<span class="pchip pchip--p4">ด่วนมาก</span>`;
  if (value === 3) return html`<span class="pchip pchip--p3">สูง</span>`;
  return null;
}

/** Priority written out (work-order header). */
export function PrioLabel({ value }) {
  if (value === 4 || value === 3) return html`<${PrioChip} value=${value} />`;
  return html`<span class="pill">ความสำคัญ${value === 1 ? 'ต่ำ' : 'ปกติ'}</span>`;
}

/** Priority as a 3-bar gauge with its label; "ด่วนมาก" is a filled red block. */
export function Prio({ value, withLabel }) {
  const p = priorityOf(value);
  if (value === 4) {
    return html`<span class="prio prio--p4" title=${p.label}><b>!</b>${withLabel ? html`<span>${p.label}</span>` : ''}</span>`;
  }
  return html`<span class=${`prio prio--${p.key}`} title=${p.label}>
    <i></i><i></i><i></i>${withLabel ? html`<span>${p.label}</span>` : ''}</span>`;
}

export function Avatar({ user, state, late, size = 'md' }) {
  const name = displayName(user);
  const bare = name.replace(/^พี่/, '').trim();
  const ch = bare.slice(0, /^[เแโใไ]/.test(bare) ? 2 : 1); // keep a leading vowel with its consonant: เอ, แก, โอ
  const lamp = state ? (late ? 'stop' : STATES[state].lamp) : 'none';
  return html`<span class=${`avatar avatar--${size} avatar--${lamp}`} title=${name}>${ch}</span>`;
}

export function Seg({ value, options, onChange, label }) {
  return html`<div class="seg" role="tablist" aria-label=${label}>
    ${options.map((o) => html`<button type="button" role="tab" aria-selected=${value === o.value}
      class=${`seg-btn${value === o.value ? ' is-on' : ''}`} onClick=${() => onChange(o.value)}>
      ${o.label}${o.count !== undefined ? html`<span class="seg-count">${o.count}</span>` : ''}</button>`)}
  </div>`;
}

export function Field({ label, hint, error, children, id }) {
  return html`<div class=${`field${error ? ' has-error' : ''}`}>
    ${label ? html`<label class="field-label" for=${id}>${label}</label>` : ''}
    ${children}
    ${error ? html`<p class="field-error">${error}</p>` : hint ? html`<p class="field-hint">${hint}</p>` : ''}
  </div>`;
}

export function Sheet({ title, onClose, children, footer, wide, headActions }) {
  const ref = useRef();
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.classList.add('has-sheet');
    const first = ref.current && ref.current.querySelector('input, textarea, select, button.btn');
    if (first && window.matchMedia('(min-width: 720px)').matches) first.focus();
    return () => { document.removeEventListener('keydown', onKey); document.body.classList.remove('has-sheet'); };
  }, []);
  return html`<div class="sheet-wrap" onClick=${(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <section class=${`sheet${wide ? ' sheet--wide' : ''}`} role="dialog" aria-modal="true" aria-label=${title} ref=${ref}>
      <header class="sheet-head">
        <h2>${title}</h2>
        <span class="sheet-head-actions">${headActions || ''}<button type="button" class="icon-btn" onClick=${onClose} aria-label="ปิด"><${Icon} name="close" /></button></span>
      </header>
      <div class="sheet-body">${children}</div>
      ${footer ? html`<footer class="sheet-foot">${footer}</footer>` : ''}
    </section>
  </div>`;
}

export function Empty({ title, text, children }) {
  return html`<div class="empty"><p class="empty-title">${title}</p>${text ? html`<p class="empty-text">${text}</p>` : ''}${children}</div>`;
}

/** A small text action that asks for a second tap (taking back a message, a comment). */
export function TwoTap({ label, confirmLabel, onConfirm, cls = 'link-btn link-btn--inline' }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return undefined;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);
  return html`<button type="button" class=${`${cls}${armed ? ' is-armed' : ''}`}
    onClick=${(e) => { e.stopPropagation(); if (armed) { setArmed(false); onConfirm(); } else setArmed(true); }}>${armed ? confirmLabel : label}</button>`;
}

/** Two-step confirm built into the page (the preview frame blocks confirm()). */
export function ConfirmButton({ label, confirmLabel, onConfirm, tone = 'danger', icon }) {
  const ref = useRef({ armed: false });
  const btn = useRef();
  const click = () => {
    if (!ref.current.armed) {
      ref.current.armed = true;
      btn.current.classList.add('is-armed');
      btn.current.querySelector('.cb-text').textContent = confirmLabel;
      setTimeout(() => {
        if (!btn.current) return;
        ref.current.armed = false;
        btn.current.classList.remove('is-armed');
        btn.current.querySelector('.cb-text').textContent = label;
      }, 4000);
      return;
    }
    onConfirm();
  };
  return html`<button type="button" ref=${btn} class=${`btn btn--${tone}-ghost`} onClick=${click}>
    ${icon ? html`<${Icon} name=${icon} size=${18} />` : ''}<span class="cb-text">${label}</span></button>`;
}
