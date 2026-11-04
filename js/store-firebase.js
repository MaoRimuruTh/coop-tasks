// Firebase store: same interface as store-demo.js, backed by Firestore + Google sign-in.
// Free Spark plan only: photos are shrunk on the phone and stored as Firestore documents
// (Cloud Storage would need the paid Blaze plan).
import { stampS, woNumber, displayName, ROLE_TH, shortTitle, canAssign, canReview, isInternAdmin, normCode, fmtTime, isStudent, isStaff, mentorLog, mentorsOf, toggleMentor, MAX_MENTORS, canChat, pairId, isActive, groupHasStaff, groupAutoName, MAX_GROUP } from './model.js';

const SDK = 'https://www.gstatic.com/firebasejs/10.14.1';
const DEFAULT_SETTINGS = { startDate: '2026-11-02', endDate: '2027-02-19', company: '', university: 'มหาวิทยาลัยทักษิณ',
  companyAddress: '', companyPhone: '', companyFax: '', companyHours: '',
  workDays: 'จันทร์–เสาร์', workStart: '08:00', workEnd: '18:00', breakStart: '12:00', breakEnd: '13:00' };
const UNLOCK_MINUTES = 60;
const JOIN_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const newJoinCode = () => Array.from(crypto.getRandomValues(new Uint32Array(8)), (n) => JOIN_ALPHABET[n % JOIN_ALPHABET.length]).join('');
const APPROVED = ['admin', 'supervisor', 'student'];

const thaiError = (e) => {
  const code = (e && e.code) || '';
  if (code.includes('permission-denied')) return new Error('ไม่มีสิทธิ์ทำรายการนี้ ถ้าคิดว่าผิด ให้แจ้งแอดมิน');
  if (code.includes('unavailable') || code.includes('network')) return new Error('ต่ออินเทอร์เน็ตไม่ได้ ระบบจะส่งให้อัตโนมัติเมื่อกลับมาออนไลน์');
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return new Error('ปิดหน้าล็อกอินไปก่อน ลองกดล็อกอินอีกครั้ง');
  if (code === 'auth/unauthorized-domain') return new Error('โดเมนนี้ยังไม่ได้รับอนุญาตใน Firebase (Authentication → Settings → Authorized domains)');
  return e instanceof Error ? e : new Error(String(e));
};

export async function createFirebaseStore(config) {
  const [{ initializeApp }, A, F] = await Promise.all([
    import(`${SDK}/firebase-app.js`), import(`${SDK}/firebase-auth.js`), import(`${SDK}/firebase-firestore.js`),
  ]);
  const app = initializeApp(config);
  const auth = A.getAuth(app);
  let fs;
  try {
    fs = F.initializeFirestore(app, { localCache: F.persistentLocalCache({ tabManager: F.persistentMultipleTabManager() }) });
  } catch {
    fs = F.getFirestore(app);
  }
  if (config.useEmulator) {
    A.connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    F.connectFirestoreEmulator(fs, '127.0.0.1', 8080);
  }
  const { doc, collection, collectionGroup, onSnapshot, getDoc, getDocs, setDoc, updateDoc, deleteDoc, writeBatch, runTransaction, query, orderBy, limit, limitToLast, where, Timestamp, serverTimestamp, increment, arrayUnion } = F;
  // chat times are server timestamps (one clock for both phones); the app works with milliseconds
  const ms = (v) => (v && typeof v.toMillis === 'function' ? v.toMillis() : typeof v === 'number' ? v : 0);

  const S = { me: null, users: {}, plans: {}, tasks: {}, progress: {}, settings: DEFAULT_SETTINGS, activity: [], join: null, chats: {}, chatOff: false,
    talk: {}, seen: {}, talkLoaded: false, online: navigator.onLine, loaded: false };
  const listeners = new Set();
  const subIndex = {}; // subId -> taskId (filled by subsFor)
  const newNos = {}; // taskId -> work-order number, for tasks created on this phone
  const fileCache = {};
  let unsubs = [];
  let snap = build();
  let readyResolve;
  const ready = new Promise((r) => { readyResolve = r; });
  setTimeout(() => readyResolve(), 6000); // never leave the page blank on a slow first load

  function build() {
    const tasks = {};
    for (const [id, t] of Object.entries(S.tasks)) tasks[id] = { ...t, state: S.progress[id] || {} };
    return { settings: { ...DEFAULT_SETTINGS, ...S.settings }, users: S.users, plans: S.plans, tasks, activity: S.activity, join: S.join,
      chats: S.chats, chatOff: S.chatOff, chatsLoaded: !!S.chatsLoaded, talk: S.talk, commentSeen: S.seen, talkLoaded: S.talkLoaded, me: S.me, actor: S.me && S.me.uid, online: S.online, loaded: S.loaded, persistOk: true };
  }
  const emit = () => { snap = build(); listeners.forEach((fn) => fn()); };
  const uid = () => auth.currentUser && auth.currentUser.uid;
  const role = () => (S.me ? S.me.role : 'none');
  const must = (ok, msg) => { if (!ok) throw new Error(msg); };
  const LOCKED = 'บัญชีนี้ล็อกโหมดผู้มอบงานอยู่ ขอรหัสจากชิเอลแล้วปลดล็อกที่หน้าจัดการระบบ';
  const mayAssign = () => must(canAssign(S.me), isInternAdmin(S.me) ? LOCKED : 'เฉพาะพี่ผู้ดูแลหรือแอดมินที่สั่งงานได้');
  const notOwn = (assignees) => must(!(isInternAdmin(S.me) && assignees.includes(uid())), 'งานที่ตัวเองเป็นผู้รับ ให้พี่ผู้ดูแลเป็นคนสั่งหรือแก้');
  const now = () => stampS(new Date());
  const activityRef = () => doc(collection(fs, 'activity'));
  const logIn = (batch, text, taskId = null) => {
    const t = taskId && S.tasks[taskId];
    batch.set(activityRef(), { at: now(), by: uid(), text: t ? `${text} “${shortTitle(t.title)}”` : text, taskId });
  };
  const wrap = (fn) => async (...args) => { try { return await fn(...args); } catch (e) { throw thaiError(e); } };

  window.addEventListener('online', () => { S.online = true; emit(); });
  window.addEventListener('offline', () => { S.online = false; emit(); });

  function stopData() { unsubs.forEach((u) => u()); unsubs = []; }
  let retryTimer = null;
  const onListenError = (e) => {
    console.warn('listener stopped:', e && e.code);
    if (retryTimer) return;
    retryTimer = setTimeout(() => { retryTimer = null; if (S.me && APPROVED.includes(S.me.role)) startData(); }, 2000);
  };
  function startData() {
    stopData();
    const keep = (u) => unsubs.push(u);
    const listen = (ref, fn) => keep(onSnapshot(ref, fn, onListenError));
    listen(collection(fs, 'users'), (qs) => { S.users = Object.fromEntries(qs.docs.map((d) => [d.id, { uid: d.id, ...d.data() }])); emit(); });
    listen(collection(fs, 'plans'), (qs) => { S.plans = Object.fromEntries(qs.docs.map((d) => [d.id, { id: d.id, ...d.data() }])); emit(); });
    listen(collection(fs, 'tasks'), (qs) => { S.tasks = Object.fromEntries(qs.docs.map((d) => [d.id, { id: d.id, ...d.data() }])); S.loaded = true; emit(); });
    listen(collectionGroup(fs, 'progress'), (qs) => {
      const p = {};
      qs.docs.forEach((d) => { const tid = d.ref.parent.parent.id; (p[tid] = p[tid] || {})[d.id] = d.data(); });
      S.progress = p; emit();
    });
    listen(doc(fs, 'settings', 'app'), (d) => { S.settings = d.exists() ? d.data() : {}; emit(); });
    listen(query(collection(fs, 'activity'), orderBy('at', 'desc'), limit(60)), (qs) => { S.activity = qs.docs.map((d) => d.data()); emit(); });
    // my private chats only (the rules let nobody else read them); a failure here never restarts the other listeners
    keep(onSnapshot(query(collection(fs, 'chats'), where('members', 'array-contains', S.me.uid)), { includeMetadataChanges: true }, (qs) => {
      S.chats = Object.fromEntries(qs.docs.map((d) => {
        const x = d.data({ serverTimestamps: 'estimate' });
        return [d.id, { id: d.id, pending: d.metadata.hasPendingWrites, kind: x.kind || 'pair', name: x.name || '', host: x.host || null, createdBy: x.createdBy || null,
          members: x.members || [], lastText: x.lastText || '', lastBy: x.lastBy || null, lastAt: ms(x.lastAt),
          seen: Object.fromEntries(Object.entries(x.seen || {}).map(([k, v]) => [k, ms(v)])) }];
      }));
      S.chatOff = false; S.chatsLoaded = true; emit();
    }, (e) => { console.warn('chat listener stopped:', e && e.code); S.chatOff = true; emit(); }));
    // comment summaries per work order, and when I last read each one's comments
    keep(onSnapshot(collection(fs, 'talk'), (qs) => {
      S.talk = Object.fromEntries(qs.docs.map((d) => {
        const x = d.data({ serverTimestamps: 'estimate' });
        return [d.id, { n: x.n || 0, lastAt: ms(x.lastAt), lastBy: x.lastBy || null, lastText: x.lastText || '', people: x.people || [] }];
      }));
      S.talkLoaded = true; emit();
    }, (e) => console.warn('comment listener stopped:', e && e.code)));
    keep(onSnapshot(doc(fs, 'seen', S.me.uid), (d) => {
      const c = (d.exists() && d.data({ serverTimestamps: 'estimate' }).comments) || {};
      S.seen = Object.fromEntries(Object.entries(c).map(([k, v]) => [k, ms(v)]));
      emit();
    }, (e) => console.warn('seen listener stopped:', e && e.code)));
    if (S.me && S.me.role === 'admin') {
      // invite codes for the two invite links; made the first time the admin opens the app
      listen(doc(fs, 'meta', 'join'), (d) => {
        if (!d.exists()) { setDoc(doc(fs, 'meta', 'join'), { supervisor: newJoinCode(), student: newJoinCode() }).catch(() => {}); return; }
        S.join = d.data(); emit();
      });
    }
  }

  const store = {
    mode: 'firebase',
    ready,
    adminOpen: false,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    snapshot() { return snap; },

    signIn: wrap(async () => {
      const provider = new A.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      try { await A.signInWithPopup(auth, provider); } catch (e) {
        if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') {
          await A.signInWithRedirect(auth, provider);
        } else throw e;
      }
    }),
    signOut: () => A.signOut(auth),
    // test hook for the local emulator only
    _test: config.useEmulator ? { fs, F, auth } : undefined,
    _signInForTest: config.useEmulator ? (email, name) => A.signInWithCredential(auth,
      A.GoogleAuthProvider.credential(JSON.stringify({ sub: email, email, email_verified: true, name }))) : undefined,

    // a new person joins with the invite code from the link: staff fill a position, interns a student ID
    register: async ({ role, code, name, nickname = '', position = '', studentId = '', major = '', faculty = '' }) => {
      const c = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      must(role === 'student' || role === 'supervisor', 'เลือกก่อนว่าเป็นพี่ผู้ดูแลหรือนักศึกษา');
      must(String(name).trim(), 'ใส่ชื่อ–นามสกุล');
      if (role === 'supervisor') must(String(position).trim(), 'ใส่ตำแหน่ง (ใช้ลงฟอร์มส่งมหาลัย)');
      else {
        must(String(studentId).trim(), 'ใส่เลขประจำตัวนิสิต');
        must(String(major).trim() && String(faculty).trim(), 'ใส่สาขาวิชาและคณะ (ใช้ลงฟอร์มส่งมหาลัย)');
      }
      must(c, 'ใส่รหัสเข้าทีม หรือเปิดจากลิงก์ที่แอดมินส่งให้');
      const patch = role === 'student'
        ? { role, isStudent: true, name: name.trim(), nickname: nickname.trim(), studentId: studentId.trim(), major: major.trim(), faculty: faculty.trim() }
        : { role, isStudent: false, name: name.trim(), nickname: nickname.trim(), position: position.trim() };
      const b = writeBatch(fs);
      b.set(doc(fs, 'joins', uid()), { role, code: c, at: now() });
      b.update(doc(fs, 'users', uid()), patch);
      b.set(activityRef(), { at: now(), by: uid(), taskId: null,
        text: role === 'student' ? `ลงทะเบียนเป็นนักศึกษา (${patch.studentId})` : `ลงทะเบียนเป็นพนักงานผู้ดูแล (${patch.position})` });
      try { await b.commit(); } catch (e) {
        if (String(e.code || '').includes('permission-denied')) throw new Error('รหัสเข้าทีมไม่ถูก หรือไม่ตรงกับบทบาทที่เลือก ขอลิงก์ใหม่จากแอดมิน');
        throw thaiError(e);
      }
    },
    rotateJoinCode: wrap(async (which) => {
      must(role() === 'admin', 'เปลี่ยนลิงก์ชวนได้เฉพาะแอดมิน');
      await setDoc(doc(fs, 'meta', 'join'), { [which]: newJoinCode() }, { merge: true });
    }),

    claimAdmin: wrap(async () => {
      const b = writeBatch(fs);
      b.set(doc(fs, 'meta', 'admin'), { uid: uid(), at: now() });
      b.update(doc(fs, 'users', uid()), { role: 'admin', isStudent: true });
      await b.commit();
      store.adminOpen = false;
      await setDoc(doc(fs, 'settings', 'app'), DEFAULT_SETTINGS, { merge: true });
    }),

    // the work-order number of a task just created, before the listener brings it in
    noOf: (id) => (S.tasks[id] && S.tasks[id].no) || newNos[id] || null,
    createTask: wrap(async (input) => {
      mayAssign(); notOwn(input.assignees);
      const ref = doc(collection(fs, 'tasks'));
      await runTransaction(fs, async (tx) => {
        const cRef = doc(fs, 'meta', 'counter');
        const c = await tx.get(cRef);
        const no = (c.exists() ? c.data().n : 0) + 1;
        tx.set(cRef, { n: no });
        tx.set(ref, { ...input, no, createdBy: uid(), created: now() });
        input.assignees.forEach((a) => tx.set(doc(fs, 'tasks', ref.id, 'progress', a), { s: 'assigned', at: now() }));
        tx.set(activityRef(), { at: now(), by: uid(), text: `สั่งงาน ${woNumber({ no })} “${shortTitle(input.title)}”`, taskId: ref.id });
        newNos[ref.id] = no;
      });
      return ref.id;
    }),
    updateTask: wrap(async (id, patch) => {
      mayAssign();
      const t = S.tasks[id];
      notOwn(t.assignees); notOwn(patch.assignees || []);
      const b = writeBatch(fs);
      b.update(doc(fs, 'tasks', id), patch);
      if (patch.assignees) {
        patch.assignees.filter((a) => !t.assignees.includes(a)).forEach((a) => b.set(doc(fs, 'tasks', id, 'progress', a), { s: 'assigned', at: now() }));
        t.assignees.filter((a) => !patch.assignees.includes(a)).forEach((a) => b.delete(doc(fs, 'tasks', id, 'progress', a)));
      }
      logIn(b, `แก้ไข ${woNumber(t)}`, id);
      await b.commit();
    }),
    deleteTask: wrap(async (id) => {
      mayAssign();
      let t = S.tasks[id];
      if (!t) { // "ยกเลิก" tapped before the new work order reached the list
        const d = await getDoc(doc(fs, 'tasks', id));
        must(d.exists(), 'ไม่พบใบสั่งงานนี้ อาจถูกลบไปแล้ว');
        t = { id, ...d.data() };
      }
      notOwn(t.assignees);
      const [subs, files, talk] = await Promise.all([getDocs(collection(fs, 'tasks', id, 'subs')), getDocs(query(collection(fs, 'attachments'), where('taskId', '==', id))),
        getDocs(collection(fs, 'tasks', id, 'comments'))]);
      const b = writeBatch(fs);
      subs.docs.forEach((d) => b.delete(d.ref));
      talk.docs.forEach((d) => b.delete(d.ref));
      if (S.talk[id]) b.delete(doc(fs, 'talk', id));
      files.docs.forEach((d) => b.delete(d.ref));
      t.assignees.forEach((a) => b.delete(doc(fs, 'tasks', id, 'progress', a)));
      b.delete(doc(fs, 'tasks', id));
      logIn(b, `ลบ ${woNumber(t)}`);
      await b.commit();
    }),
    ack: wrap(async (id) => {
      const t = S.tasks[id];
      must(t.assignees.includes(uid()), 'กดรับทราบได้เฉพาะคนที่ได้รับงาน');
      const b = writeBatch(fs);
      b.set(doc(fs, 'tasks', id, 'progress', uid()), { s: 'ack', at: now() });
      logIn(b, `รับทราบ ${woNumber(t)}`, id);
      await b.commit();
    }),
    submit: wrap(async (id, { note = '', link = '', images = [] }) => {
      const t = S.tasks[id];
      must(t.assignees.includes(uid()), 'ส่งงานได้เฉพาะคนที่ได้รับงาน');
      const at = now();
      const fileIds = [];
      for (const img of images) { // one document per photo keeps each under Firestore's 1 MiB limit
        const fref = doc(collection(fs, 'attachments'));
        await setDoc(fref, { taskId: id, by: uid(), name: img.name, type: img.type, data: img.data, size: img.size || 0, at });
        fileIds.push(fref.id);
      }
      const forUids = t.mode === 'group' ? t.assignees : [uid()];
      const auto = t.needsReview === false;
      const b = writeBatch(fs);
      const sref = doc(collection(fs, 'tasks', id, 'subs'));
      b.set(sref, { by: uid(), for: forUids, note, link, files: fileIds, at,
        review: auto ? { decision: 'approved', note: 'ปิดงานอัตโนมัติ (งานนี้ไม่ต้องตรวจ)', by: uid(), at } : null });
      forUids.forEach((u) => b.set(doc(fs, 'tasks', id, 'progress', u), { s: auto ? 'approved' : 'submitted', at }));
      logIn(b, `${auto ? 'ทำเสร็จ' : 'ส่ง'} ${woNumber(t)}${t.mode === 'group' ? ' (ในนามกลุ่ม)' : ''}`, id);
      await b.commit();
    }),
    review: wrap(async (subId, decision, note = '') => {
      must(canReview(S.me), 'ตรวจงานได้เฉพาะพี่ผู้ดูแล');
      const tid = subIndex[subId];
      const sref = doc(fs, 'tasks', tid, 'subs', subId);
      const sub = (await getDoc(sref)).data();
      must(!sub.for.includes(uid()), 'ตรวจงานของตัวเองไม่ได้ ให้พี่ผู้ดูแลเป็นคนตรวจ');
      const at = now();
      const b = writeBatch(fs);
      b.update(sref, { review: { decision, note, by: uid(), at } });
      const s = decision === 'approved' ? 'approved' : 'changes';
      sub.for.forEach((u) => b.set(doc(fs, 'tasks', tid, 'progress', u), note ? { s, at, note } : { s, at }));
      const who = sub.for.map((u) => displayName(S.users[u])).join(', ');
      logIn(b, `${decision === 'approved' ? 'ตรวจผ่าน' : 'ให้แก้'} ${woNumber(S.tasks[tid])} · ${who}`, tid);
      await b.commit();
    }),
    unreview: wrap(async (subId) => {
      must(canReview(S.me), 'ยกเลิกผลตรวจได้เฉพาะพี่ผู้ดูแล');
      const tid = subIndex[subId];
      const sref = doc(fs, 'tasks', tid, 'subs', subId);
      const sub = (await getDoc(sref)).data();
      const b = writeBatch(fs);
      b.update(sref, { review: null });
      sub.for.forEach((u) => b.set(doc(fs, 'tasks', tid, 'progress', u), { s: 'submitted', at: sub.at }));
      logIn(b, `ยกเลิกผลตรวจ ${woNumber(S.tasks[tid])}`, tid);
      await b.commit();
    }),
    unsubmit: wrap(async (subId) => {
      const tid = subIndex[subId];
      const sref = doc(fs, 'tasks', tid, 'subs', subId);
      const sub = (await getDoc(sref)).data();
      must(sub.for.includes(uid()) && !sub.review, 'ยกเลิกได้เฉพาะงานที่ตัวเองส่งและพี่ยังไม่ตรวจ');
      const b = writeBatch(fs);
      b.delete(sref);
      (sub.files || []).forEach((f) => { if (sub.by === uid()) b.delete(doc(fs, 'attachments', f)); });
      sub.for.forEach((u) => b.set(doc(fs, 'tasks', tid, 'progress', u), { s: 'ack', at: now() }));
      logIn(b, `ยกเลิกการส่ง ${woNumber(S.tasks[tid])}`, tid);
      await b.commit();
    }),
    subsFor: wrap(async (taskId) => {
      const qs = await getDocs(query(collection(fs, 'tasks', taskId, 'subs'), orderBy('at', 'desc')));
      return qs.docs.map((d) => { subIndex[d.id] = taskId; return { id: d.id, taskId, ...d.data() }; });
    }),
    file: wrap(async (id) => {
      if (fileCache[id]) return fileCache[id];
      const d = await getDoc(doc(fs, 'attachments', id));
      if (!d.exists()) return null;
      fileCache[id] = { id, ...d.data() };
      return fileCache[id];
    }),

    savePlan: wrap(async (plan) => {
      mayAssign();
      const ref = plan.id ? doc(fs, 'plans', plan.id) : doc(collection(fs, 'plans'));
      const { id: _drop, ...data } = plan;
      const b = writeBatch(fs);
      b.set(ref, data);
      logIn(b, `${plan.id ? 'แก้แผน' : 'เพิ่มงานในแผน'}: ${plan.title}`);
      await b.commit();
      return ref.id;
    }),
    deletePlan: wrap(async (id) => {
      mayAssign();
      const b = writeBatch(fs);
      b.delete(doc(fs, 'plans', id));
      logIn(b, `ลบงานในแผน: ${(S.plans[id] || {}).title || ''}`);
      await b.commit();
    }),
    updateUser: wrap(async (id, patch) => {
      must(role() === 'admin' || id === uid(), 'แก้ข้อมูลผู้ใช้ได้เฉพาะแอดมิน');
      const mine = id === uid() && S.me;
      must(!mine || ((patch.role ?? S.me.role) === S.me.role && (patch.isStudent ?? S.me.isStudent) === S.me.isStudent),
        'เปลี่ยนบทบาทของตัวเองไม่ได้ ให้คนอื่นที่เป็นแอดมินเปลี่ยนให้');
      const b = writeBatch(fs);
      b.update(doc(fs, 'users', id), patch);
      const who = displayName(S.users[id]);
      if (patch.role === 'blocked') logIn(b, `ปิดบัญชี ${who}`);
      else if (patch.role === 'pending') logIn(b, `เปิดบัญชี ${who} กลับ`);
      else if (patch.role && (!S.users[id] || S.users[id].role !== patch.role)) logIn(b, `ตั้ง ${who} เป็น${ROLE_TH[patch.role] || patch.role}`);
      await b.commit();
    }),
    // one-time code from Ciel opens assigner mode for an hour; the reason goes into the activity log
    unlockAssigner: async (code, reason) => {
      const c = normCode(code);
      const why = String(reason || '').trim();
      must(isInternAdmin(S.me), 'โหมดนี้มีไว้สำหรับแอดมินที่เป็นนักศึกษาด้วย');
      must(c.length === 12, 'รหัสมี 12 ตัว เช่น ABCD-EFGH-JKMN');
      must(why.length >= 5, 'บอกเหตุผลสั้นๆ ว่าจะเข้าไปทำอะไร');
      const until = Timestamp.fromMillis(Date.now() + UNLOCK_MINUTES * 60000);
      const b = writeBatch(fs);
      b.set(doc(fs, 'unlocks', c), { by: uid(), at: now(), reason: why.slice(0, 300), until });
      b.update(doc(fs, 'users', uid()), { assignerUntil: until, lastUnlock: c });
      b.set(activityRef(), { at: now(), by: uid(), text: `เปิดโหมดผู้มอบงานถึง ${fmtTime(until.toDate())} น. · เหตุผล: ${why.slice(0, 120)}`, taskId: null });
      try { await b.commit(); } catch (e) {
        if (String(e.code || '').includes('permission-denied')) throw new Error('รหัสไม่ถูก หรือถูกใช้ไปแล้ว ขอรหัสใหม่จากชิเอล');
        throw thaiError(e);
      }
    },
    lockAssigner: wrap(async () => {
      const b = writeBatch(fs);
      b.update(doc(fs, 'users', uid()), { assignerUntil: null });
      logIn(b, 'ล็อกโหมดผู้มอบงาน');
      await b.commit();
    }),
    // พี่ที่ดูแล: the intern (or the admin) sets the whole list and who signs the form;
    // a staff member adds or removes only himself (toggleMentee)
    setMentors: wrap(async (sid, ids, sign) => {
      const st = S.users[sid];
      must(st && isStudent(st), 'พี่ที่ดูแลมีไว้สำหรับน้องฝึกงาน');
      must(sid === uid() || role() === 'admin', 'เลือกพี่ที่ดูแลได้เฉพาะของตัวเอง');
      const next = [...new Set(ids || [])].filter(Boolean);
      must(next.every((x) => isStaff(S.users[x])), 'พี่ที่ดูแลต้องเป็นพนักงานของบริษัท');
      must(next.length <= MAX_MENTORS, `เลือกพี่ที่ดูแลได้ไม่เกิน ${MAX_MENTORS} คน`);
      const signer = sign && next.includes(sign) ? sign : (next[0] || null);
      const b = writeBatch(fs);
      b.update(doc(fs, 'users', sid), { mentors: next, mentor: signer });
      logIn(b, mentorLog(S.users, uid(), sid, next, signer));
      await b.commit();
    }),
    toggleMentee: wrap(async (sid) => {
      const st = S.users[sid];
      must(st && isStudent(st), 'พี่ที่ดูแลมีไว้สำหรับน้องฝึกงาน');
      must(isStaff(S.me), 'รับดูแลน้องได้เฉพาะพนักงานของบริษัท');
      const { next, sign, on } = toggleMentor(st, uid());
      must(next.length <= MAX_MENTORS, `น้องคนนี้มีพี่ที่ดูแลครบ ${MAX_MENTORS} คนแล้ว`);
      const b = writeBatch(fs);
      b.update(doc(fs, 'users', sid), { mentors: next, mentor: sign });
      logIn(b, mentorLog(S.users, uid(), sid, next, sign));
      await b.commit();
      return on;
    }),

    // private chat: chats/{a_b} holds the members and the last message, chats/{a_b}/msgs the messages
    subscribeChat(cid, cb) {
      const q = query(collection(fs, 'chats', cid, 'msgs'), orderBy('at'), limitToLast(300));
      let unsub = null; let timer = null; let tries = 0; let stopped = false;
      const start = () => {
        unsub = onSnapshot(q, { includeMetadataChanges: true }, (qs) => {
          tries = 0;
          cb(qs.docs.map((d) => {
            const x = d.data({ serverTimestamps: 'estimate' });
            return { id: d.id, by: x.by, text: x.text, sys: !!x.sys, deleted: !!x.deleted, editedAt: ms(x.editedAt), at: ms(x.at), pending: d.metadata.hasPendingWrites };
          }));
        }, (e) => {
          // a group made a moment ago may not have reached the server yet: look again shortly
          if (!stopped && String((e && e.code) || '').includes('permission') && tries < 6) { tries += 1; timer = setTimeout(start, 400 * tries); return; }
          cb(null, thaiError(e));
        });
      };
      start();
      return () => { stopped = true; clearTimeout(timer); if (unsub) unsub(); };
    },
    // no await on the server: offline, the message waits in the phone and goes out when the line is back
    sendChat(otherId, text) {
      const body = String(text || '').trim();
      must(body, 'พิมพ์ข้อความก่อน');
      must(body.length <= 2000, 'ข้อความยาวเกิน 2,000 ตัวอักษร แบ่งส่งเป็นหลายข้อความ');
      must(canChat(S.me, S.users[otherId]), 'แชทได้เฉพาะระหว่างพี่ผู้ดูแลกับน้องฝึกงาน');
      const me = uid(); const members = [me, otherId].sort(); const cid = members.join('_');
      const b = writeBatch(fs);
      b.set(doc(fs, 'chats', cid), { members, lastAt: serverTimestamp(), lastText: body.slice(0, 140), lastBy: me, seen: { [me]: serverTimestamp() } }, { merge: true });
      b.set(doc(collection(fs, 'chats', cid, 'msgs')), { by: me, text: body, at: serverTimestamp() });
      return b.commit().catch((e) => { throw thaiError(e); });
    },
    markChatSeen(cid) {
      return updateDoc(doc(fs, 'chats', cid), { [`seen.${uid()}`]: serverTimestamp() }).catch((e) => console.warn('seen:', e && e.code));
    },
    chatId: (otherId) => pairId(uid(), otherId),
    // fix or take back my own message within 15 minutes; the chat list preview follows when it was the last one
    editChat(cid, mid, text, isLast) {
      const body = String(text || '').trim();
      must(body, 'ข้อความว่างไม่ได้ ถ้าจะลบให้กดยกเลิกข้อความ');
      must(body.length <= 2000, 'ข้อความยาวเกิน 2,000 ตัวอักษร');
      const c = S.chats[cid]; const me = uid();
      const b = writeBatch(fs);
      b.update(doc(fs, 'chats', cid, 'msgs', mid), { text: body, editedAt: serverTimestamp() });
      if (isLast && c && c.lastBy === me) b.update(doc(fs, 'chats', cid), { lastText: body.slice(0, 140) });
      return b.commit().catch((e) => { throw thaiError(e); });
    },
    unsendChat(cid, mid, isLast) {
      const c = S.chats[cid]; const me = uid();
      const b = writeBatch(fs);
      b.update(doc(fs, 'chats', cid, 'msgs', mid), { text: '', deleted: true, editedAt: serverTimestamp() });
      if (isLast && c && c.lastBy === me) b.update(doc(fs, 'chats', cid), { lastText: 'ยกเลิกข้อความ' });
      return b.commit().catch((e) => { throw thaiError(e); });
    },

    // ความเห็นในใบสั่งงาน: tasks/{tid}/comments, with a small summary in talk/{tid} for the red dot
    subscribeComments(tid, cb) {
      const q = query(collection(fs, 'tasks', tid, 'comments'), orderBy('at'));
      return onSnapshot(q, { includeMetadataChanges: true }, (qs) => cb(qs.docs.map((d) => {
        const x = d.data({ serverTimestamps: 'estimate' });
        return { id: d.id, by: x.by, text: x.text, deleted: !!x.deleted, at: ms(x.at), editedAt: ms(x.editedAt), pending: d.metadata.hasPendingWrites };
      })), (e) => cb(null, thaiError(e)));
    },
    addComment(tid, text) {
      const body = String(text || '').trim();
      const t = S.tasks[tid]; const me = uid();
      must(body, 'พิมพ์ความเห็นก่อน');
      must(body.length <= 2000, 'ความเห็นยาวเกิน 2,000 ตัวอักษร');
      must(isStaff(S.me) || role() === 'admin' || (t && t.assignees.includes(me)), 'เฉพาะพี่ผู้ดูแลและน้องที่ได้งานนี้แสดงความเห็นได้');
      const b = writeBatch(fs);
      b.set(doc(collection(fs, 'tasks', tid, 'comments')), { by: me, text: body, at: serverTimestamp() });
      // counted and listed on the server, so two people commenting at once never undo each other
      b.set(doc(fs, 'talk', tid), { n: increment(1), lastAt: serverTimestamp(), lastBy: me, lastText: body.slice(0, 140), people: arrayUnion(me) }, { merge: true });
      b.set(doc(fs, 'seen', me), { comments: { [tid]: serverTimestamp() } }, { merge: true });
      return b.commit().catch((e) => { throw thaiError(e); });
    },
    editComment(tid, id, text, isLast) {
      const body = String(text || '').trim();
      must(body, 'ความเห็นว่างไม่ได้ ถ้าจะลบให้กดยกเลิก');
      must(body.length <= 2000, 'ความเห็นยาวเกิน 2,000 ตัวอักษร');
      const t = S.talk[tid]; const me = uid();
      const b = writeBatch(fs);
      b.update(doc(fs, 'tasks', tid, 'comments', id), { text: body, editedAt: serverTimestamp() });
      if (isLast && t && t.lastBy === me) b.update(doc(fs, 'talk', tid), { lastText: body.slice(0, 140) });
      return b.commit().catch((e) => { throw thaiError(e); });
    },
    unsendComment(tid, id, isLast) {
      const t = S.talk[tid]; const me = uid();
      const b = writeBatch(fs);
      b.update(doc(fs, 'tasks', tid, 'comments', id), { text: '', deleted: true, editedAt: serverTimestamp() });
      if (isLast && t && t.lastBy === me) b.update(doc(fs, 'talk', tid), { lastText: 'ยกเลิกความเห็น' });
      return b.commit().catch((e) => { throw thaiError(e); });
    },
    markCommentsSeen(tid) {
      return setDoc(doc(fs, 'seen', uid()), { comments: { [tid]: serverTimestamp() } }, { merge: true }).catch((e) => console.warn('seen:', e && e.code));
    },

    // group chats: chats/{autoId} with a name, a host (a staff member who must stay in) and up to 20 people
    createGroup({ name, members }) {
      const me = uid();
      const all = [...new Set([me, ...(members || [])])].filter((x) => isActive(S.users[x]) || x === me);
      must(all.length >= 2, 'เลือกคนเข้ากลุ่มอย่างน้อย 1 คน');
      must(all.length <= MAX_GROUP, `กลุ่มหนึ่งมีได้ไม่เกิน ${MAX_GROUP} คน`);
      must(groupHasStaff(S.users, all), 'กลุ่มต้องมีพี่ผู้ดูแลอย่างน้อย 1 คน');
      const host = isStaff(S.me) ? me : all.find((x) => isStaff(S.users[x]));
      const nm = String(name || '').trim().slice(0, 60) || groupAutoName(S.users, all);
      const ref = doc(collection(fs, 'chats'));
      const done = setDoc(ref, { kind: 'group', name: nm, host, createdBy: me, members: all,
        lastAt: serverTimestamp(), lastText: `สร้างกลุ่ม “${nm}”`.slice(0, 140), lastBy: me, seen: { [me]: serverTimestamp() } }).catch((e) => { throw thaiError(e); });
      return { id: ref.id, done };
    },
    sendGroup(cid, text) {
      const body = String(text || '').trim();
      must(body, 'พิมพ์ข้อความก่อน');
      must(body.length <= 2000, 'ข้อความยาวเกิน 2,000 ตัวอักษร แบ่งส่งเป็นหลายข้อความ');
      const c = S.chats[cid]; const me = uid();
      must(c && c.members.includes(me), 'คุณไม่ได้อยู่ในกลุ่มนี้แล้ว');
      const b = writeBatch(fs);
      b.update(doc(fs, 'chats', cid), { lastAt: serverTimestamp(), lastText: body.slice(0, 140), lastBy: me, [`seen.${me}`]: serverTimestamp() });
      b.set(doc(collection(fs, 'chats', cid, 'msgs')), { by: me, text: body, at: serverTimestamp() });
      return b.commit().catch((e) => { throw thaiError(e); });
    },
    // staff in the group: rename, add or remove people; the change is posted in the chat as a note
    updateGroup: wrap(async (cid, { name, members }, note) => {
      const c = S.chats[cid]; const me = uid();
      must(c && c.kind === 'group' && c.members.includes(me), 'คุณไม่ได้อยู่ในกลุ่มนี้แล้ว');
      must(isStaff(S.me), 'แก้กลุ่มได้เฉพาะพี่ผู้ดูแลที่อยู่ในกลุ่ม');
      const all = [...new Set([me, ...(members || c.members)])];
      must(all.length >= 2, 'กลุ่มต้องมีอย่างน้อย 2 คน');
      must(all.length <= MAX_GROUP, `กลุ่มหนึ่งมีได้ไม่เกิน ${MAX_GROUP} คน`);
      const nm = String(name || '').trim().slice(0, 60) || c.name;
      const host = all.includes(c.host) ? c.host : me;
      const text = String(note || 'แก้ไขกลุ่ม').slice(0, 140);
      const b = writeBatch(fs);
      b.update(doc(fs, 'chats', cid), { name: nm, members: all, host, lastAt: serverTimestamp(), lastText: text, lastBy: me, [`seen.${me}`]: serverTimestamp() });
      b.set(doc(collection(fs, 'chats', cid, 'msgs')), { by: me, text, at: serverTimestamp(), sys: true });
      await b.commit();
    }),
    leaveGroup: wrap(async (cid) => {
      const c = S.chats[cid]; const me = uid();
      must(c && c.kind === 'group' && c.members.includes(me), 'คุณไม่ได้อยู่ในกลุ่มนี้แล้ว');
      const rest = c.members.filter((x) => x !== me);
      const patch = { members: rest, lastAt: serverTimestamp(), lastText: 'ออกจากกลุ่ม', lastBy: me };
      if (c.host === me) {
        const next = rest.find((x) => isStaff(S.users[x]));
        must(next, 'กลุ่มต้องมีพี่ผู้ดูแลอย่างน้อย 1 คน เพิ่มพี่อีกคนก่อนออก');
        patch.host = next;
      }
      await updateDoc(doc(fs, 'chats', cid), patch);
    }),

    updateSettings: wrap(async (patch) => {
      must(role() === 'admin', 'ตั้งค่าได้เฉพาะแอดมิน');
      await setDoc(doc(fs, 'settings', 'app'), patch, { merge: true });
    }),
    exportData() {
      return { exportedAt: now(), settings: snap.settings, users: snap.users, plans: snap.plans, tasks: snap.tasks, activity: snap.activity };
    },
  };
  let meUnsub = null;
  A.onAuthStateChanged(auth, async (user) => {
    if (meUnsub) { meUnsub(); meUnsub = null; }
    stopData();
    if (!user) { S.me = null; S.users = {}; S.tasks = {}; S.progress = {}; S.plans = {}; S.chats = {}; S.chatsLoaded = false; emit(); readyResolve(); return; }
    try {
      const ref = doc(fs, 'users', user.uid);
      const got = await getDoc(ref);
      if (!got.exists()) {
        await setDoc(ref, { uid: user.uid, name: user.displayName || user.email || 'ผู้ใช้ใหม่', email: user.email || '',
          photo: user.photoURL || '', role: 'pending', isStudent: false, created: now() });
      }
      const adminDoc = await getDoc(doc(fs, 'meta', 'admin'));
      store.adminOpen = !adminDoc.exists();
    } catch (e) { console.error(e); }
    let started = false;
    meUnsub = onSnapshot(doc(fs, 'users', user.uid), { includeMetadataChanges: true }, (d) => {
      if (d.metadata.hasPendingWrites) return;
      S.me = d.exists() ? { uid: d.id, ...d.data() } : null;
      if (S.me && APPROVED.includes(S.me.role) && !started) { started = true; startData(); }
      if (S.me && !APPROVED.includes(S.me.role) && started) { started = false; stopData(); }
      emit();
      readyResolve();
    }, () => readyResolve());
  });

  return store;
}
