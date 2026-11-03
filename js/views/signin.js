// Sign-in and "waiting for approval" screens (real Firebase mode only).
import { html, useState } from '../vendor/preact-htm.js';
import { Icon } from '../ui.js';

const inLineApp = () => /\bLine\//i.test(navigator.userAgent || '');

export function SignIn({ store }) {
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true); setErr('');
    try { await store.signIn(); } catch (ex) { setErr(ex.message || 'ล็อกอินไม่สำเร็จ ลองใหม่อีกครั้ง'); }
    setBusy(false);
  };
  const external = `${location.origin}${location.pathname}?openExternalBrowser=1`;
  return html`<main class="gate">
    <div class="gate-card">
      <span class="brand-mark brand-mark--lg" aria-hidden="true"></span>
      <h1>ใบสั่งงานฝึกงาน</h1>
      <p>สั่งงาน รับทราบ ส่งงาน และตรวจงาน สำหรับนักศึกษาฝึกงานและพี่ผู้ดูแล</p>
      ${inLineApp() ? html`<p class="callout callout--wait">เปิดจากในแอป LINE จะล็อกอิน Google ไม่ได้
        <a href=${external}>แตะที่นี่เพื่อเปิดใน Chrome หรือ Safari</a></p>` : ''}
      <button type="button" class="btn btn--primary btn--block" disabled=${busy} onClick=${go}><${Icon} name="user" size=${18} />${busy ? 'กำลังเปิดหน้าล็อกอิน…' : 'ล็อกอินด้วย Google'}</button>
      ${err ? html`<p class="form-error" role="alert">${err}</p>` : ''}
      <p class="quiet">ล็อกอินครั้งแรก แอดมินต้องกดอนุมัติก่อนถึงจะเห็นงาน</p>
    </div>
  </main>`;
}

export function Waiting({ store, me }) {
  const [msg, setMsg] = useState('');
  const claim = async () => {
    try { await store.claimAdmin(); } catch (ex) { setMsg(ex.message); }
  };
  return html`<main class="gate">
    <div class="gate-card">
      <span class="brand-mark brand-mark--lg" aria-hidden="true"></span>
      <h1>${me.role === 'blocked' ? 'บัญชีนี้ยังไม่ได้รับอนุญาต' : 'รอแอดมินอนุมัติ'}</h1>
      <p>ล็อกอินเป็น <b>${me.email || me.name}</b> แล้ว ${me.role === 'blocked' ? 'ถ้าคิดว่าผิด ให้ติดต่อแอดมิน' : 'แจ้งแอดมินให้กดอนุมัติในเมนู “จัดการระบบ” พออนุมัติแล้วหน้านี้จะเปิดเอง'}</p>
      ${store.adminOpen ? html`<div class="callout callout--wait"><p>ระบบยังไม่มีแอดมิน คนแรกที่กดปุ่มนี้จะเป็นแอดมิน</p>
        <button type="button" class="btn btn--primary btn--block" onClick=${claim}>ตั้งฉันเป็นแอดมิน</button></div>` : ''}
      ${msg ? html`<p class="form-error" role="alert">${msg}</p>` : ''}
      <button type="button" class="btn btn--ghost btn--block" onClick=${() => store.signOut()}><${Icon} name="logout" size=${18} />ออกจากระบบ</button>
    </div>
  </main>`;
}
