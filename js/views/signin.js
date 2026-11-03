// Sign-in and first-time registration screens (real Firebase mode only).
// A new person opens the invite link from the admin (?join=CODE&as=staff|student), signs in with Google,
// fills a short form (staff: position, interns: student ID) and gets in right away, no approval needed.
import { html, useState } from '../vendor/preact-htm.js';
import { Icon, Field } from '../ui.js';

const inLineApp = () => /\bLine\//i.test(navigator.userAgent || '');
const JOIN_KEY = 'coop-join';

/** Keep the invite from the link, so it survives the Google sign-in and the jump out of LINE. */
export function rememberJoin() {
  try {
    const q = new URLSearchParams(location.search);
    const code = q.get('join');
    if (!code) return;
    const as = q.get('as');
    localStorage.setItem(JOIN_KEY, JSON.stringify({ code, role: as === 'staff' ? 'supervisor' : as === 'student' ? 'student' : '' }));
  } catch { /* storage blocked: the code can still be typed in */ }
}
const readJoin = () => { try { return JSON.parse(localStorage.getItem(JOIN_KEY) || 'null') || {}; } catch { return {}; } };
const forgetJoin = () => {
  try { localStorage.removeItem(JOIN_KEY); } catch { /* ignore */ }
  if (/[?&]join=/.test(location.search)) history.replaceState(null, '', `${location.pathname}${location.hash}`);
};

export function SignIn({ store }) {
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const invited = !!readJoin().code;
  const go = async () => {
    setBusy(true); setErr('');
    try { await store.signIn(); } catch (ex) { setErr(ex.message || 'ล็อกอินไม่สำเร็จ ลองใหม่อีกครั้ง'); }
    setBusy(false);
  };
  const q = new URLSearchParams(location.search);
  q.set('openExternalBrowser', '1');
  const external = `${location.origin}${location.pathname}?${q.toString()}`;
  return html`<main class="gate">
    <div class="gate-card">
      <span class="brand-mark brand-mark--lg" aria-hidden="true"></span>
      <h1>ใบสั่งงานฝึกงาน</h1>
      <p>สั่งงาน รับทราบ ส่งงาน และตรวจงาน สำหรับนักศึกษาฝึกงานและพี่ผู้ดูแล</p>
      ${inLineApp() ? html`<p class="callout callout--wait">เปิดจากในแอป LINE จะล็อกอิน Google ไม่ได้
        <a href=${external}>แตะที่นี่เพื่อเปิดใน Chrome หรือ Safari</a></p>` : ''}
      <button type="button" class="btn btn--primary btn--block" disabled=${busy} onClick=${go}><${Icon} name="user" size=${18} />${busy ? 'กำลังเปิดหน้าล็อกอิน…' : 'ล็อกอินด้วย Google'}</button>
      ${err ? html`<p class="form-error" role="alert">${err}</p>` : ''}
      <p class="quiet">${invited ? 'ได้ลิงก์ชวนเข้าทีมแล้ว ล็อกอินแล้วกรอกข้อมูลสั้นๆ ก็ใช้ได้ทันที' : 'ล็อกอินครั้งแรกจะให้กรอกข้อมูลสั้นๆ แล้วใช้ได้ทันที ถ้ามีลิงก์ชวนจากแอดมิน ให้เปิดจากลิงก์นั้น'}</p>
    </div>
  </main>`;
}

function Register({ store, me }) {
  const join = readJoin();
  const [role, setRole] = useState(join.role || '');
  const [f, setF] = useState({ name: me.name || '', nickname: '', position: '', studentId: '', major: '', faculty: '', code: join.code || '' });
  const [typeCode, setTypeCode] = useState(!join.code);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try { await store.register({ role, ...f }); forgetJoin(); } catch (ex) { setErr(ex.message); setBusy(false); }
  };
  return html`<form class="form register" onSubmit=${submit}>
    <${Field} label="คุณคือ">
      <div class="choice">
        <button type="button" class=${`choice-btn${role === 'supervisor' ? ' is-on' : ''}`} aria-pressed=${role === 'supervisor'} onClick=${() => setRole('supervisor')}>
          <b>พี่ผู้ดูแล</b><span>พนักงานที่สั่งและตรวจงาน</span></button>
        <button type="button" class=${`choice-btn${role === 'student' ? ' is-on' : ''}`} aria-pressed=${role === 'student'} onClick=${() => setRole('student')}>
          <b>นักศึกษาฝึกงาน</b><span>รับงานและส่งงาน</span></button>
      </div>
    <//>
    ${role ? html`
      <${Field} id="rg-name" label="ชื่อ–นามสกุล" hint=${role === 'student' ? 'ใส่คำนำหน้าด้วย เช่น นายสมชาย ใจดี ชื่อนี้ลงในฟอร์มส่งมหาลัย' : 'ชื่อนี้ลงช่องพนักงานที่ปรึกษาในฟอร์มส่งมหาลัย'}>
        <input id="rg-name" type="text" required value=${f.name} onInput=${set('name')} autocomplete="name" /><//>
      <${Field} id="rg-nick" label="ชื่อเล่น (ไม่บังคับ)" hint="ใช้แสดงในรายการงาน"><input id="rg-nick" type="text" value=${f.nickname} onInput=${set('nickname')} /><//>
      ${role === 'supervisor' ? html`<${Field} id="rg-pos" label="ตำแหน่ง"><input id="rg-pos" type="text" required value=${f.position} onInput=${set('position')} placeholder="เช่น วิศวกรฝ่ายผลิต" /><//>`
      : html`<${Field} id="rg-sid" label="เลขประจำตัวนิสิต"><input id="rg-sid" type="text" inputmode="numeric" required value=${f.studentId} onInput=${set('studentId')} /><//>
        <div class="form-pair">
          <${Field} id="rg-major" label="สาขาวิชา"><input id="rg-major" type="text" required value=${f.major} onInput=${set('major')} /><//>
          <${Field} id="rg-fac" label="คณะ"><input id="rg-fac" type="text" required value=${f.faculty} onInput=${set('faculty')} /><//>
        </div>`}
      ${typeCode ? html`<${Field} id="rg-code" label="รหัสเข้าทีม" hint="ขอลิงก์หรือรหัสจากแอดมิน">
          <input id="rg-code" type="text" required autocomplete="off" autocapitalize="characters" spellcheck="false" value=${f.code} onInput=${set('code')} /><//>`
        : html`<p class="hint-line">✓ ได้รหัสเข้าทีมจากลิงก์แล้ว <button type="button" class="link-btn link-btn--inline" onClick=${() => setTypeCode(true)}>ใส่รหัสเอง</button></p>`}
      ${err ? html`<p class="form-error" role="alert">${err}</p>` : ''}
      <button type="submit" class="btn btn--primary btn--block" disabled=${busy}>${busy ? 'กำลังบันทึก…' : 'เข้าใช้งาน'}</button>` : ''}
  </form>`;
}

export function Waiting({ store, me }) {
  const [msg, setMsg] = useState('');
  const claim = async () => {
    try { await store.claimAdmin(); } catch (ex) { setMsg(ex.message); }
  };
  if (me.role === 'blocked') {
    return html`<main class="gate"><div class="gate-card">
      <span class="brand-mark brand-mark--lg" aria-hidden="true"></span>
      <h1>บัญชีนี้ยังไม่ได้รับอนุญาต</h1>
      <p>ล็อกอินเป็น <b>${me.email || me.name}</b> แล้ว ถ้าคิดว่าผิด ให้ติดต่อแอดมิน</p>
      <button type="button" class="btn btn--ghost btn--block" onClick=${() => store.signOut()}><${Icon} name="logout" size=${18} />ออกจากระบบ</button>
    </div></main>`;
  }
  return html`<main class="gate">
    <div class="gate-card">
      <span class="brand-mark brand-mark--lg" aria-hidden="true"></span>
      <h1>ลงทะเบียนเข้าทีม</h1>
      <p>ล็อกอินเป็น <b>${me.email || me.name}</b> แล้ว กรอกข้อมูลสั้นๆ ด้านล่างก็ใช้ได้ทันที</p>
      ${store.adminOpen ? html`<div class="callout callout--wait"><p>ระบบยังไม่มีแอดมิน คนแรกที่กดปุ่มนี้จะเป็นแอดมิน</p>
        <button type="button" class="btn btn--primary btn--block" onClick=${claim}>ตั้งฉันเป็นแอดมิน</button></div>` : html`<${Register} store=${store} me=${me} />`}
      ${msg ? html`<p class="form-error" role="alert">${msg}</p>` : ''}
      <p class="quiet">ไม่มีลิงก์หรือรหัส? แจ้งแอดมิน แอดมินกดอนุมัติให้ในหน้าจัดการระบบได้</p>
      <button type="button" class="btn btn--ghost btn--block" onClick=${() => store.signOut()}><${Icon} name="logout" size=${18} />ออกจากระบบ</button>
    </div>
  </main>`;
}
