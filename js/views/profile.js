// "ข้อมูลของฉัน" — each person fills the details that go on the university form.
import { html, useState } from '../vendor/preact-htm.js';
import { useApp } from '../ctx.js';
import { isStudent } from '../model.js';
import { Sheet, Field, Icon } from '../ui.js';

export function ProfileSheet({ onClose }) {
  const { me, store, toast } = useApp();
  const [f, setF] = useState({ name: me.name || '', nickname: me.nickname || '', studentId: me.studentId || '',
    major: me.major || '', faculty: me.faculty || '', position: me.position || '' });
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const student = isStudent(me);
  const save = async () => {
    if (!f.name.trim()) { toast('ใส่ชื่อ–นามสกุล', 'bad'); return; }
    const patch = { name: f.name.trim(), nickname: f.nickname.trim() };
    if (student) Object.assign(patch, { studentId: f.studentId.trim(), major: f.major.trim(), faculty: f.faculty.trim() });
    if (me.role === 'supervisor') patch.position = f.position.trim();
    try { await store.updateUser(me.uid, patch); toast('บันทึกข้อมูลของฉันแล้ว', 'ok'); onClose(); } catch (ex) { toast(ex.message, 'bad'); }
  };
  return html`<${Sheet} title="ข้อมูลของฉัน" onClose=${onClose}
    footer=${html`${store.mode !== 'demo' ? html`<button type="button" class="btn btn--ghost" onClick=${() => store.signOut()}><${Icon} name="logout" size=${18} />ออกจากระบบ</button>` : ''}
      <span class="foot-space"></span>
      <button type="button" class="btn btn--primary" onClick=${save}>บันทึก</button>`}>
    <div class="form">
      ${me.email ? html`<p class="quiet">ล็อกอินด้วย ${me.email}</p>` : ''}
      <div class="form-pair">
        <${Field} id="pf-name" label="ชื่อ – นามสกุล"><input id="pf-name" type="text" value=${f.name} onInput=${set('name')} /><//>
        <${Field} id="pf-nick" label="ชื่อเล่น" hint="ใช้แสดงในรายการงาน"><input id="pf-nick" type="text" value=${f.nickname} onInput=${set('nickname')} /><//>
      </div>
      ${student ? html`<p class="hint-line">ข้อมูลด้านล่างใช้กรอกฟอร์มส่งมหาลัย</p>
        <div class="form-pair">
          <${Field} id="pf-sid" label="เลขประจำตัวนิสิต"><input id="pf-sid" type="text" inputmode="numeric" value=${f.studentId} onInput=${set('studentId')} /><//>
          <${Field} id="pf-fac" label="คณะ"><input id="pf-fac" type="text" value=${f.faculty} onInput=${set('faculty')} /><//>
        </div>
        <${Field} id="pf-major" label="สาขาวิชา"><input id="pf-major" type="text" value=${f.major} onInput=${set('major')} /><//>` : ''}
      ${me.role === 'supervisor' ? html`<${Field} id="pf-pos" label="ตำแหน่ง" hint="ลงในช่องตำแหน่งของฟอร์มมหาลัย"><input id="pf-pos" type="text" value=${f.position} onInput=${set('position')} /><//>` : ''}
    </div>
  <//>`;
}
