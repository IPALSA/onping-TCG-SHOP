/* backend.js - Firebase(Auth + Firestore) + 치지직 로그인 연동. firebase-config.js 를 채우면 자동 활성화 */
(function () {
  const cfg = window.FIREBASE_CONFIG;
  if (!cfg || !cfg.apiKey || /YOUR_/.test(cfg.apiKey) || typeof firebase === 'undefined') { console.log('[로컬 모드] Firebase 설정이 없습니다.'); return; }
  firebase.initializeApp(cfg);
  const auth = firebase.auth(), db = firebase.firestore(), FV = firebase.firestore.FieldValue;
  let user = null, uref = null, isAdmin = false, wantGo = false, unsubs = [], synced = {}, tm;

  /* ---------- 카드 도감 (관리자 -> Firestore, 유저 <- Firestore) ---------- */
  const kk2 = k => { const [g, i] = k.split('-'); return { g, i: +i }; };
  const docOf = k => { const { g, i } = kk2(k), m = D.meta[k] || {}; return { g, i, img: (D.imgs[g] || [])[i] || '', name: m.name || '', type: m.type || '', count: m.count || 1, price: m.price || 0 }; };
  const allKeys2 = () => { const s = new Set(Object.keys(D.meta)); G.forEach(g => (D.imgs[g] || []).forEach((x, i) => { if (x) s.add(g + '-' + i); })); return [...s]; };
  function applyCat(c) {
    D.back = c.back || null; Object.assign(D.counts, c.counts || {}); D.imgs = {}; D.meta = {};
    (c.cards || []).forEach(x => { const k = x.g + '-' + x.i; if (x.img) (D.imgs[x.g] = D.imgs[x.g] || [])[x.i] = x.img; D.meta[k] = { name: x.name, type: x.type || undefined, count: x.count, price: x.price }; });
    synced = {}; allKeys2().forEach(k => synced[k] = JSON.stringify(docOf(k)));
  }
  async function loadCat() {
    try {
      const cs = await db.doc('config/main').get(); if (!cs.exists) return;
      const c = cs.data(); let cache = null;
      try { cache = JSON.parse(localStorage.getItem('ontcg_cat')); } catch (e) {}
      if (!(cache && cache.ver === c.ver)) {
        const q = await db.collection('cards').get();
        cache = { ver: c.ver, back: c.back || '', counts: c.counts || {}, cards: q.docs.map(d => d.data()) };
        try { localStorage.setItem('ontcg_cat', JSON.stringify(cache)); } catch (e) {}
      }
      applyCat(cache);
    } catch (e) { console.error(e); toast('카드 정보를 불러오지 못했어요'); }
  }
  async function sync() {
    if (!isAdmin) return;
    const cur = {}, ops = [];
    allKeys2().forEach(k => { const d = docOf(k), s = JSON.stringify(d); cur[k] = s; if (synced[k] !== s) ops.push(['set', k, d]); });
    Object.keys(synced).forEach(k => { if (!(k in cur)) ops.push(['del', k]); });
    try {
      for (let i = 0; i < ops.length; i += 15) {
        const b = db.batch();
        ops.slice(i, i + 15).forEach(([t, k, d]) => { const r = db.collection('cards').doc(k); t === 'set' ? b.set(r, d) : b.delete(r); });
        await b.commit();
      }
      await db.doc('config/main').set({ back: D.back || '', counts: D.counts, ver: Date.now() });
      synced = cur; toast('서버에 저장됐어요');
    } catch (e) { console.error(e); toast('서버 저장 실패: 관리자 권한을 확인하세요'); }
  }
  save = function () { if (isAdmin) { clearTimeout(tm); tm = setTimeout(sync, 1500); } };
  const _oa = openAdm;
  openAdm = function () { isAdmin ? _oa() : toast('관리자 권한이 없는 계정이에요'); };

  /* ---------- 치지직 로그인: 치지직 OAuth -> Cloud Function -> Firebase 커스텀 토큰 ---------- */
  const CZ = window.CHZZK || {};
  function login() {
    if (!CZ.clientId || !CZ.redirectUri || !CZ.loginFn) { toast('firebase-config.js 의 CHZZK 설정을 확인하세요'); return; }
    const st = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now()).replace(/-/g, '');
    sessionStorage.setItem('chzzk_state', st);
    location.href = 'https://chzzk.naver.com/account-interlock?clientId=' + encodeURIComponent(CZ.clientId)
      + '&redirectUri=' + encodeURIComponent(CZ.redirectUri) + '&state=' + st;
  }
  async function finishLogin() {
    const q = new URLSearchParams(location.search), code = q.get('code'), state = q.get('state');
    if (!code || !state) return;
    history.replaceState(null, '', location.pathname + location.hash);
    if (state !== sessionStorage.getItem('chzzk_state')) { toast('로그인 검증에 실패했어요. 다시 시도해주세요'); return; }
    sessionStorage.removeItem('chzzk_state');
    try {
      const r = await fetch(CZ.loginFn, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, state }) });
      const j = await r.json();
      if (!r.ok || !j.token) throw new Error(j.error || 'login');
      wantGo = true;
      await auth.signInWithCustomToken(j.token);
    } catch (e) { console.error(e); wantGo = false; toast('치지직 로그인에 실패했어요'); }
  }
  function gb() {
    $('gBtn').textContent = user ? '로그아웃 (' + S.nick + ')' : '치지직으로 로그인';
    $('nick').disabled = !!user; $('nickBtn').style.display = user ? 'none' : ''; $('nickNote').style.display = user ? 'block' : 'none';   // 로그인하면 치지직 닉네임으로 고정
  }
  $('startBtn').onclick = () => user ? go('s-hub') : login();
  $('gBtn').onclick = () => user ? auth.signOut().then(() => location.reload()) : login();
  $('reset').style.display = 'none';

  /* ---------- 유저 데이터 ---------- */
  window.onSaveS = () => { if (uref) uref.update({ photo: S.photo || '' }).catch(() => {}); };
  setGold = function (n) { gold = n; $('gold').textContent = gold.toLocaleString(); };   // 골드는 서버 값/트랜잭션으로만 변경
  saveCol = function () { if (uref) uref.update({ col }).catch(e => console.error(e)); };

  /* ---------- 거래 (트랜잭션) ---------- */
  seedMk = function () {};
  const rf = () => { if ($('trOv').classList.contains('on') && trV === 'buy') trR(); };
  buy = async function (id) {
    const l = MK.L.find(x => String(x.id) === id); if (!l || !uref) return;
    try {
      await db.runTransaction(async tx => {
        const lr = db.collection('listings').doc(id), ls = await tx.get(lr), bs = await tx.get(uref);
        if (!ls.exists) throw new Error('gone');
        const d = ls.data(), b = bs.data();
        if (d.u === user.uid) throw new Error('own');
        if ((b.gold || 0) < d.p) throw new Error('gold');
        const cc = Object.assign({}, b.col); cc[d.k] = (cc[d.k] || 0) + 1; const now = Date.now();
        tx.delete(lr);
        tx.update(uref, { gold: FV.increment(-d.p), col: cc });
        tx.set(db.collection('trades').doc(), { k: d.k, p: d.p, t: now });
        tx.set(db.collection('users').doc(d.u).collection('inbox').doc(), { amt: d.p, k: d.k, t: now });
      });
      beep(880); toast('구매 완료');
    } catch (e) { toast(e.message === 'gold' ? '골드가 부족해요' : e.message === 'gone' ? '이미 판매된 카드예요' : e.message === 'own' ? '내 카드는 살 수 없어요' : '구매 실패'); }
  };
  $('slOk').onclick = async () => {
    const p = Math.round(+$('slIn').value), mp = mprice(sk);
    if (!(p > 0)) { toast('금액을 입력하세요'); return; }
    if (p > mp * 3) { toast('시세의 300%를 넘는 금액은 등록할 수 없어요'); return; }
    try {
      await db.runTransaction(async tx => {
        const bs = await tx.get(uref), cc = Object.assign({}, bs.data().col);
        if (!(cc[sk] > 0)) throw new Error('none');
        cc[sk]--; if (!cc[sk]) delete cc[sk];
        tx.update(uref, { col: cc });
        tx.set(db.collection('listings').doc(), { u: user.uid, sname: S.nick, k: sk, p, t: Date.now() });
      });
      $('slOv').classList.remove('on'); toast('판매 등록됨'); trR();
    } catch (e) { toast('판매 등록 실패'); }
  };
  async function cancelL(id) {
    try {
      await db.runTransaction(async tx => {
        const lr = db.collection('listings').doc(id), ls = await tx.get(lr);
        if (!ls.exists || ls.data().u !== user.uid) throw new Error('x');
        const d = ls.data(), bs = await tx.get(uref), cc = Object.assign({}, bs.data().col);
        cc[d.k] = (cc[d.k] || 0) + 1; tx.delete(lr); tx.update(uref, { col: cc });
      });
      toast('판매를 취소했어요');
    } catch (e) { toast('취소 실패'); }
  }
  const _trR = trR;
  trR = function () {
    _trR(); if (trV !== 'buy') return;
    const mine = MK.L.filter(l => l.s === 'me'); if (!mine.length) return;
    $('trB').insertAdjacentHTML('beforeend', '<h3 style="margin:16px 0 6px">내 판매 중</h3><div class="grid" id="mg"></div>');
    mine.forEach(l => { const { g, i } = kk2(l.k), w = document.createElement('div'); w.className = 'cw'; w.appendChild(cardEl(g, i));
      w.insertAdjacentHTML('beforeend', `<div class="cap">${meta(g, i).name}<br>${l.p} G</div><button class="btn sm" data-cancel="${l.id}">취소</button>`); $('mg').appendChild(w); });
  };
  $('trB').addEventListener('click', e => { const c = e.target.closest('[data-cancel]'); if (c) cancelL(c.dataset.cancel); });
  async function claim(d) {
    try {
      let amt = 0;
      await db.runTransaction(async tx => { const s = await tx.get(d.ref); if (!s.exists) return; amt = s.data().amt || 0; tx.delete(d.ref); tx.update(uref, { gold: FV.increment(amt) }); });
      if (amt) { toast('판매 완료 +' + amt + ' G'); beep(880); }
    } catch (e) { console.error(e); }
  }

  /* ---------- 인증 상태 ---------- */
  auth.onAuthStateChanged(async u => {
    unsubs.forEach(f => f()); unsubs = []; user = u; isAdmin = false; gb();
    if (!u) { uref = null; return; }
    uref = db.collection('users').doc(u.uid);
    try { isAdmin = (await db.collection('admins').doc(u.uid).get()).exists; } catch (e) {}
    await loadCat();
    const s = await uref.get();
    if (!s.exists) { toast('계정 정보를 찾을 수 없어요. 다시 로그인해주세요'); auth.signOut(); return; }
    unsubs.push(uref.onSnapshot(sn => {
      const d = sn.data(); if (!d) return;
      gold = d.gold != null ? d.gold : 0; $('gold').textContent = gold.toLocaleString(); col = d.col || {};
      S.nick = d.nick || S.nick; S.nickTs = d.nickTs || 0; S.photo = d.photo || ''; applyS(); gb();
    }));
    unsubs.push(db.collection('listings').orderBy('t', 'desc').limit(100).onSnapshot(q => {
      MK.L = q.docs.map(d => { const x = d.data(); return { id: d.id, s: x.u === u.uid ? 'me' : (x.sname || '?'), k: x.k, p: x.p, t: x.t }; }); rf();
    }));
    unsubs.push(db.collection('trades').where('t', '>', Date.now() - 864e5).orderBy('t').onSnapshot(q => { MK.T = q.docs.map(d => d.data()); rf(); }));
    unsubs.push(uref.collection('inbox').onSnapshot(q => q.docChanges().forEach(c => { if (c.type === 'added') claim(c.doc); })));
    gb();
    if (wantGo && $('s-start').classList.contains('on')) go('s-hub');
    wantGo = false;
  });

  finishLogin();

  /* 공용 카드팩 3D 모델: 저장소 루트에 pack.glb 를 올리면 모든 유저에게 적용 */
  fetch('pack.glb', { method: 'HEAD' }).then(r => { if (r.ok && typeof useModel === 'function') useModel('pack.glb'); }).catch(() => {});
})();
