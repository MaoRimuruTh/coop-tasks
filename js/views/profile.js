// "ข้อมูลของฉัน" — each person fills the details that go on the university form.
// Interns pick their พี่ที่ดูแล (one or more, and who signs the form); staff tap the interns they look after.
import { html, useState } from '../vendor/preact-htm.js';
import { useApp } from '../ctx.js';
import { isStudent, isStaff, displayName, mentorsOf, mentorOf, MAX_MENTORS } from '../model.js';
import { Sheet, Field, Icon } from '../ui.js';

export function ProfileSheet({ onClose }) {
  const { db, me, store, toast } = useApp();
  const [f, setF] = useState({ name: me.name || '', nickname: me.nickname || '', studentId: me.studentId || '',
    major: me.major || '', faculty: me.faculty || '', position: me.position || '' });
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const student = isStudent(me);
  const staffMember = isStaff(me);
  const byName = (a, b) => displayName(a).localeCompare(displayName(b), 'th');
  const staff = Object.values(db.users).filter(isStaff).sort(byName);
  const interns = Object.values(db.users).filter((u) => isStudent(u) && ['student', 'admin'].includes(u.role)).sort(byName);

  // interns: the พี่ที่ดูแล list and who signs the form, saved with the rest
  const mineBefore = mentorsOf(me).filter((id) => isStaff(db.users[id]));
  const signBefore = (mentorOf(db.users, { ...me, mentors: mineBefore }) || {}).uid || '';
  const [mentors, setMentors] = useState(mineBefore);
  const [sign, setSign] = useState(mineBefore.includes(signBefore) ? signBefore : (mineBefore[0] || ''));
  const signer = mentors.includes(sign) ? sign : (mentors[0] || '');
  const toggle = (id) => {
    if (mentors.includes(id)) { setMentors(mentors.filter((x) => x !== id)); return; }
    if (mentors.length >= MAX_MENTORS) { toast(`เลือกพี่ที่ดูแลได้ไม่เกิน ${MAX_MENTORS} คน`, 'bad'); return; }
    setMentors([...mentors, id]);
  };
  const mentorsChanged = mentors.join() !== mineBefore.join() || (mentors.length > 0 && signer !== signBefore);

  const save = async () => {
    if (!f.name.trim()) { toast('ใส่ชื่อ–นามสกุล', 'bad'); return; }
    const patch = { name: f.name.trim(), nickname: f.nickname.trim() };
    if (student) Object.assign(patch, { studentId: f.studentId.trim(), major: f.major.trim(), faculty: f.faculty.trim() });
    if (staffMember) patch.position = f.position.trim();
    try {
      await store.updateUser(me.uid, patch);
      if (student && mentorsChanged) await store.setMentors(me.uid, mentors, signer || null);
      toast('บันทึกข้อมูลของฉันแล้ว', 'ok'); onClose();
    } catch (ex) { toast(ex.message, 'bad'); }
  };
  // staff: tap an intern to add (or remove) yourself as one of their พี่ที่ดูแล; saved straight away
  const toggleMentee = async (u) => {
    try {
      const on = await store.toggleMentee(u.uid);
      toast(on ? `รับดูแล ${displayName(u)} แล้ว` : `เลิกดูแล ${displayName(u)} แล้ว`, 'ok');
    } catch (ex) { toast(ex.message, 'bad'); }
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
        <${Field} id="pf-major" label="สาขาวิชา"><input id="pf-major" type="text" value=${f.major} onInput=${set('major')} /><//>
        <div class="field">
          <span class="field-label">พี่ที่ดูแลเรา (พนักงานที่ปรึกษา) เลือกได้หลายคน</span>
          ${staff.length ? html`<div class="chips" role="group" aria-label="พี่ที่ดูแลเรา">${staff.map((u) => {
            const on = mentors.includes(u.uid);
            return html`<button type="button" class=${`chip chip--sm${on ? ' is-on' : ''}`} aria-pressed=${on} onClick=${() => toggle(u.uid)}>
              ${on ? html`<${Icon} name="check" size=${16} />` : ''}${displayName(u)}${u.position ? html`<small class="chip-note">${u.position}</small>` : ''}</button>`;
          })}</div>` : html`<p class="hint-line">ยังไม่มีพี่ในระบบ ให้พี่สมัครเข้าทีมด้วยลิงก์ชวนก่อน</p>`}
        </div>
        ${mentors.length > 1 ? html`<${Field} id="pf-sign" label="พี่ที่ลงชื่อในฟอร์มส่งมหาลัย" hint="ฟอร์มมีช่องพนักงานที่ปรึกษาช่องเดียว">
          <div class="select-wrap"><select id="pf-sign" value=${signer} onChange=${(e) => setSign(e.target.value)}>
            ${mentors.map((id) => html`<option value=${id}>${(db.users[id] || {}).name || displayName(db.users[id])}${db.users[id] && db.users[id].position ? ` · ${db.users[id].position}` : ''}</option>`)}
          </select></div><//>`
        : html`<p class="hint-line">${mentors.length ? `${displayName(db.users[mentors[0]])} จะลงชื่อในช่องพนักงานที่ปรึกษาของฟอร์มส่งมหาลัย` : 'ชื่อและตำแหน่งของพี่จะลงในช่องลงชื่อของฟอร์มส่งมหาลัย'}</p>`}` : ''}
      ${staffMember ? html`<${Field} id="pf-pos" label="ตำแหน่ง" hint="ลงในช่องตำแหน่งของฟอร์มมหาลัย"><input id="pf-pos" type="text" value=${f.position} onInput=${set('position')} /><//>
        <div class="field">
          <span class="field-label">น้องที่ฉันดูแล (เป็นพนักงานที่ปรึกษา)</span>
          ${interns.length ? html`<div class="chips" role="group" aria-label="น้องที่ฉันดูแล">${interns.map((u) => {
            const ids = mentorsOf(u);
            const on = ids.includes(me.uid);
            const others = ids.filter((x) => x !== me.uid && db.users[x]).map((x) => displayName(db.users[x]));
            return html`<button type="button" class=${`chip chip--sm${on ? ' is-on' : ''}`} aria-pressed=${on} onClick=${() => toggleMentee(u)}>
              ${on ? html`<${Icon} name="check" size=${16} />` : ''}${displayName(u)}${others.length ? html`<small class="chip-note">${on ? 'ร่วมกับ' : 'ดูแลโดย'} ${others.join(', ')}</small>` : ''}</button>`;
          })}</div>
          <p class="hint-line">แตะชื่อน้องที่เราดูแล บันทึกทันที น้องหนึ่งคนมีพี่ที่ดูแลได้หลายคน คนที่ลงชื่อในฟอร์มน้องเป็นคนเลือก</p>`
          : html`<p class="hint-line">ยังไม่มีน้องฝึกงานในระบบ</p>`}
        </div>` : ''}
    </div>
  <//>`;
}
