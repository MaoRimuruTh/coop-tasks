// Entry point: real Firebase when config.js has a config, otherwise the demo store.
import { mount } from './app.js';
import { createDemoStore } from './store-demo.js';
import { FIREBASE_CONFIG } from './config.js';
import { rememberJoin } from './views/signin.js';

async function boot() {
  rememberJoin(); // invite link ?join=… must outlive the Google sign-in
  const el = document.getElementById('app');
  let store;
  if (FIREBASE_CONFIG && !/[?&]demo\b/.test(location.search)) {
    const { createFirebaseStore } = await import('./store-firebase.js');
    store = await createFirebaseStore(FIREBASE_CONFIG);
  } else {
    store = createDemoStore();
  }
  await store.ready;
  if (FIREBASE_CONFIG && FIREBASE_CONFIG.useEmulator) window.__coopStore = store; // local emulator tests only
  el.textContent = '';
  mount(store, el);
}

boot().catch((err) => {
  const el = document.getElementById('app');
  el.textContent = '';
  const p = document.createElement('p');
  p.className = 'boot-error';
  p.textContent = `เปิดเว็บไม่สำเร็จ: ${err && err.message ? err.message : err} — ลองรีเฟรชหน้า ถ้ายังไม่ได้ให้แจ้งแอดมิน`;
  el.appendChild(p);
});
