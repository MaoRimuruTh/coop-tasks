// "ฟอร์มมหาลัย" — แบบแจ้งแผนปฏิบัติงานสหกิจศึกษา (Coop ๐๘, มหาวิทยาลัยทักษิณ).
// The university's own blank form (forms/coop08.svg, made from their PDF) is the background,
// and the answers are laid on top at the spots measured from that PDF, so the print is the real form.
import { html, useState, useRef, useEffect, useLayoutEffect } from '../vendor/preact-htm.js';
import { useApp } from '../ctx.js';
import { formRows, fmtDateYear, canAssign, displayName, mentorOf, isStaff } from '../model.js';
import { Icon } from '../ui.js';

const ROWS = 14;
// positions on the A4 page, in PDF points (595.32 × 841.92), measured from the university's PDF
const FIELD = {
  name: [192.8, 361.8, 236.6, 252.6],
  sid: [420.9, 522.4, 236.6, 252.6],
  major: [138.0, 335.3, 257.6, 273.6],
  faculty: [355.8, 519.3, 257.6, 273.6],
  company: [284.7, 521.5, 278.5, 294.4],
  studentName: [132.0, 274.9, 729.0, 743.1],
  mentorName: [360.4, 493.5, 729.0, 743.1],
  mentorPos: [346.6, 489.6, 747.4, 761.4],
};
const ROW_Y = [371.7, 393.2, 414.5, 436.0, 457.5, 479.0, 500.5, 522.0, 543.3, 564.8, 586.3, 607.8, 629.3, 650.7, 672.2];
const NO_X = [94.1, 106.1];
const TITLE_X = [106.6, 304.6];
const WEEK_X = [304.6, 318.8, 332.9, 347.2, 361.3, 375.6, 389.7, 403.9, 418.0, 432.2, 446.4, 460.7, 474.7, 489.0, 503.1, 517.3, 529.3];
const mm = (pt) => `${(pt * 25.4 / 72).toFixed(2)}mm`;
const box = (x0, x1, y0, y1) => `left:${mm(x0)};top:${mm(y0)};width:${mm(x1 - x0)};height:${mm(y1 - y0)}`;

function Field({ at, value, center }) {
  if (!value) return null;
  const [x0, x1, y0, y1] = at;
  return html`<span class=${`pf${center ? ' pf--center' : ''}`} style=${box(x0, x1, y0, y1)}><span class="pf-t">${value}</span></span>`;
}

// Long answers shrink until they fit their line on the form: names stay on one line,
// task titles try one line first and then two smaller lines inside the row.
const ONE_LINE = [11, 10.2, 9.4, 8.6, 7.8, 7.2];
const TITLE_ONE = [10.5, 9.8, 9.2];
const TITLE_TWO = [9.2, 8.6, 8, 7.4, 6.8];
function fitAll(root) {
  if (!root) return;
  root.querySelectorAll('.pf').forEach((el) => {
    const t = el.querySelector('.pf-t');
    if (!t || el.classList.contains('pf--no')) return;
    const title = el.classList.contains('pf--title');
    el.classList.remove('is-2l');
    const fitsW = () => t.scrollWidth <= el.clientWidth + 0.5;
    const fitsH = () => t.offsetHeight <= el.clientHeight + 0.5 && t.scrollWidth <= el.clientWidth + 0.5;
    for (const s of title ? TITLE_ONE : ONE_LINE) { el.style.fontSize = `${s}pt`; if (fitsW()) return; }
    if (!title) return;
    el.classList.add('is-2l');
    for (const s of TITLE_TWO) { el.style.fontSize = `${s}pt`; if (fitsH()) return; }
  });
}

export function UniForm() {
  const { db, me, now, cal, students, store, toast, openProfile } = useApp();
  const staff = canAssign(me, now);
  const [uid, setUid] = useState(staff ? (students[0] || {}).uid : me.uid);
  const student = db.users[uid] || me;
  const rows = formRows(Object.values(db.plans), student.uid);
  const shown = rows.slice(0, ROWS);
  const mentor = mentorOf(db.users, student);
  const canPrint = store.mode !== 'demo';
  const takeOn = async () => {
    try { await store.setMentor(student.uid, me.uid); toast(`รับดูแล ${displayName(student)} แล้ว ชื่อเราจะลงในฟอร์มของน้อง`, 'ok'); } catch (ex) { toast(ex.message, 'bad'); }
  };
  const scrollRef = useRef();
  const paperRef = useRef();
  useLayoutEffect(() => { fitAll(paperRef.current); });
  useEffect(() => {
    // Sarabun arrives a moment after the page, so measure again once the fonts are in
    const again = () => fitAll(paperRef.current);
    if (document.fonts) { document.fonts.ready.then(again); document.fonts.addEventListener('loadingdone', again); }
    window.addEventListener('beforeprint', again);
    return () => { if (document.fonts) document.fonts.removeEventListener('loadingdone', again); window.removeEventListener('beforeprint', again); };
  }, []);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    const fit = () => el.style.setProperty('--paper-zoom', Math.min(1, el.clientWidth / 794).toFixed(3));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return html`<section class="page page--form">
    <header class="page-head no-print">
      <div><h1>ฟอร์มส่งมหาลัย</h1><p class="page-sub">แบบแจ้งแผนปฏิบัติงานสหกิจศึกษา (Coop ๐๘) ดึงจากแผน 16 สัปดาห์ให้อัตโนมัติ</p></div>
      ${canPrint ? html`<button type="button" class="btn btn--primary" onClick=${() => window.print()}><${Icon} name="form" size=${18} />พิมพ์ / บันทึกเป็น PDF</button>` : ''}
    </header>
    <div class="no-print form-tools">
      ${staff ? html`<div class="chips" role="group" aria-label="เลือกนักศึกษา">${students.map((u) => html`<button type="button"
        class=${`chip${uid === u.uid ? ' is-on' : ''}`} aria-pressed=${uid === u.uid} onClick=${() => setUid(u.uid)}>${displayName(u)}</button>`)}</div>` : ''}
      ${rows.length > ROWS ? html`<p class="callout callout--stop">หัวข้องานรวมหัวข้อย่อยมี ${rows.length} แถว แต่แบบฟอร์มมี ${ROWS} แถว แสดงได้แค่ ${ROWS} แถวแรก ควรรวมหัวข้อย่อยให้กระชับ</p>` : ''}
      ${!mentor && student.uid === me.uid ? html`<p class="hint-line">ยังไม่ได้เลือกพนักงานที่ปรึกษาของเรา ช่องชื่อพี่จะเว้นว่างไว้
        <button type="button" class="link-btn link-btn--inline" onClick=${openProfile}>เลือกพี่ที่ดูแล</button></p>` : ''}
      ${!mentor && student.uid !== me.uid && !isStaff(me) ? html`<p class="hint-line">${displayName(student)} ยังไม่ได้เลือกพนักงานที่ปรึกษา ช่องชื่อพี่จะเว้นว่างไว้</p>` : ''}
      ${isStaff(me) && student.uid !== me.uid && !student.mentor && (!mentor || mentor.uid !== me.uid) ? html`<p class="hint-line">${mentor ? `ตอนนี้ฟอร์มใส่ชื่อ ${displayName(mentor)} ไว้ก่อน (มีพี่คนเดียวในระบบ)` : `${displayName(student)} ยังไม่มีพนักงานที่ปรึกษา ช่องชื่อพี่จะเว้นว่างไว้`}
        <button type="button" class="link-btn link-btn--inline" onClick=${takeOn}>ฉันเป็นพนักงานที่ปรึกษาของ${displayName(student)}</button></p>` : ''}
      ${!canPrint ? html`<p class="hint-line">หน้าตัวอย่างนี้สั่งพิมพ์ไม่ได้ ในเว็บจริงจะมีปุ่ม “พิมพ์ / บันทึกเป็น PDF” ตรงนี้</p>` : ''}
      <p class="hint-line">เดือนที่ในฟอร์ม = ช่วงละ 4 สัปดาห์ ${cal.months.map((m) => `· เดือนที่ ${m.m} = ${fmtDateYear(m.from)} – ${fmtDateYear(m.to)}`).join(' ')}</p>
    </div>

    <div class="paper-scroll" ref=${scrollRef}>
    <article class="paper paper--coop" ref=${paperRef} aria-label="แบบแจ้งแผนปฏิบัติงานสหกิจศึกษา Coop ๐๘">
      <img class="paper-bg" src="forms/coop08.svg" alt="" aria-hidden="true" />
      <${Field} at=${FIELD.name} value=${student.name} />
      <${Field} at=${FIELD.sid} value=${student.studentId} />
      <${Field} at=${FIELD.major} value=${student.major} />
      <${Field} at=${FIELD.faculty} value=${student.faculty} />
      <${Field} at=${FIELD.company} value=${db.settings.company} />
      ${shown.map((r, i) => {
        const y0 = ROW_Y[i]; const y1 = ROW_Y[i + 1];
        return html`
          ${r.no ? html`<span class="pf pf--center pf--no" style=${box(NO_X[0], NO_X[1], y0, y1)}>${r.no}</span>` : ''}
          <span class=${`pf pf--title${r.main ? '' : ' pf--sub'}`} style=${box(TITLE_X[0] + (r.main ? 2 : 9), TITLE_X[1] - 2, y0, y1)}><span class="pf-t">${r.main ? r.title : `- ${r.title}`}</span></span>
          ${r.weeks.filter((n) => n >= 1 && n <= 16).map((n) => html`<span class="pf-tick" style=${box(WEEK_X[n - 1] + 0.7, WEEK_X[n] - 0.7, y0 + 0.7, y1 - 0.7)}></span>`)}`;
      })}
      <${Field} at=${FIELD.studentName} value=${student.name} center />
      <${Field} at=${FIELD.mentorName} value=${mentor && mentor.name} center />
      <${Field} at=${FIELD.mentorPos} value=${mentor && mentor.position} />
    </article>
    </div>
  </section>`;
}
