// "ฟอร์มมหาลัย" — แบบแจ้งแผนปฏิบัติงานสหกิจศึกษา (มหาวิทยาลัยทักษิณ) filled from the plan.
import { html, useState, useRef, useEffect } from '../vendor/preact-htm.js';
import { useApp } from '../ctx.js';
import { formRows, fmtDateYear, canAssign, displayName } from '../model.js';
import { Icon } from '../ui.js';

const ROWS = 14;

export function UniForm() {
  const { db, me, now, cal, students, store } = useApp();
  const staff = canAssign(me, now);
  const [uid, setUid] = useState(staff ? (students[0] || {}).uid : me.uid);
  const student = db.users[uid] || me;
  const rows = formRows(Object.values(db.plans), student.uid);
  const shown = rows.slice(0, ROWS);
  const mentors = Object.values(db.users).filter((u) => u.role === 'supervisor');
  const mentor = mentors.length === 1 ? mentors[0] : null;
  const canPrint = store.mode !== 'demo';
  const scrollRef = useRef();
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
      <div><h1>ฟอร์มส่งมหาลัย</h1><p class="page-sub">แบบแจ้งแผนปฏิบัติงานสหกิจศึกษา ดึงจากแผน 16 สัปดาห์ให้อัตโนมัติ</p></div>
      ${canPrint ? html`<button type="button" class="btn btn--primary" onClick=${() => window.print()}><${Icon} name="form" size=${18} />พิมพ์ / บันทึกเป็น PDF</button>` : ''}
    </header>
    <div class="no-print form-tools">
      ${staff ? html`<div class="chips" role="group" aria-label="เลือกนักศึกษา">${students.map((u) => html`<button type="button"
        class=${`chip${uid === u.uid ? ' is-on' : ''}`} aria-pressed=${uid === u.uid} onClick=${() => setUid(u.uid)}>${displayName(u)}</button>`)}</div>` : ''}
      ${rows.length > ROWS ? html`<p class="callout callout--stop">หัวข้องานรวมหัวข้อย่อยมี ${rows.length} แถว แต่แบบฟอร์มมี ${ROWS} แถว แสดงได้แค่ ${ROWS} แถวแรก ควรรวมหัวข้อย่อยให้กระชับ</p>` : ''}
      ${!canPrint ? html`<p class="hint-line">หน้าตัวอย่างนี้สั่งพิมพ์ไม่ได้ ในเว็บจริงจะมีปุ่ม “พิมพ์ / บันทึกเป็น PDF” ตรงนี้</p>` : ''}
      <p class="hint-line">เดือนที่ในฟอร์ม = ช่วงละ 4 สัปดาห์ ${cal.months.map((m) => `· เดือนที่ ${m.m} = ${fmtDateYear(m.from)} – ${fmtDateYear(m.to)}`).join(' ')}</p>
    </div>

    <div class="paper-scroll" ref=${scrollRef}>
    <article class="paper" aria-label="แบบแจ้งแผนปฏิบัติงานสหกิจศึกษา">
      <header class="paper-head">
        <p class="paper-org">โครงการสหกิจศึกษาและการศึกษาเชิงบูรณาการกับการทำงาน มหาวิทยาลัยทักษิณ</p>
        <p class="paper-en">Thaksin University Cooperative and Work Integrated Education Project</p>
        <p class="paper-title">แบบแจ้งแผนปฏิบัติงานสหกิจศึกษา</p>
      </header>
      <p class="paper-who"><b>(ผู้ให้ข้อมูล : <u>นิสิต</u> ร่วมกับ <u>พนักงานที่ปรึกษา</u>)</b></p>
      <div class="paper-line"><span>ชื่อ – นามสกุล (นิสิต)</span><em class="fill">${student.name || ''}</em><span>เลขประจำตัว</span><em class="fill fill--short">${student.studentId || ''}</em></div>
      <div class="paper-line"><span>สาขาวิชา</span><em class="fill">${student.major || ''}</em><span>คณะ</span><em class="fill fill--short">${student.faculty || ''}</em></div>
      <div class="paper-line"><span>ปฏิบัติงานสหกิจศึกษา ณ สถานประกอบการ</span><em class="fill">${db.settings.company || ''}</em></div>
      <p class="paper-text">ขอแจ้งรายละเอียดเกี่ยวกับแผนปฏิบัติงานสหกิจศึกษา ดังนี้</p>
      <p class="paper-sub">แผนปฏิบัติงานสหกิจศึกษา</p>
      <table class="paper-table">
        <colgroup><col class="c-no" /><col class="c-task" />${Array.from({ length: 16 }, () => html`<col class="c-week" />`)}</colgroup>
        <thead><tr><th colspan="2">หัวข้องาน</th>${[1, 2, 3, 4].map((m) => html`<th colspan="4" class="m-start">เดือนที่ ${m}</th>`)}</tr></thead>
        <tbody>${Array.from({ length: ROWS }, (_, i) => {
          const r = shown[i];
          return html`<tr class=${r && !r.main ? 'is-step' : ''}>
            <td class="c-no">${r && r.no ? r.no : ''}</td><td class="c-task">${r ? r.title : ''}</td>
            ${Array.from({ length: 16 }, (_, k) => html`<td class=${`c-week${k % 4 === 0 ? ' m-start' : ''}${r && r.weeks.includes(k + 1) ? ' is-on' : ''}`}></td>`)}
          </tr>`;
        })}</tbody>
      </table>
      <div class="paper-sign">
        <div><p>(ลงชื่อ) <span class="dots"></span> นิสิต</p><p>( ${student.name || ' '.repeat(30)} )</p><p>วันที่ <span class="dots dots--short"></span></p></div>
        <div><p>(ลงชื่อ) <span class="dots"></span> พนักงานที่ปรึกษา</p><p>( ${mentor ? mentor.name : ' '.repeat(30)} )</p>
          <p>ตำแหน่ง ${mentor && mentor.position ? html`<span class="fill-inline">${mentor.position}</span>` : html`<span class="dots dots--short"></span>`}</p></div>
      </div>
      <p class="paper-foot">โปรดส่งคืน อาจารย์ที่ปรึกษา CWIE ประจำหลักสูตร ภายในสัปดาห์ที่ 2</p>
    </article>
    </div>
  </section>`;
}
