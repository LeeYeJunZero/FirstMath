(() => {
  const body = document.body;
  const API = (body.dataset.api || '').replace(/\/$/, '');
  const IS_STATIC = body.dataset.static === '1';
  // 서버 모드: 같은 origin 으로 전송 / 정적 모드: API 주소가 있을 때만 전송
  const CAN_SEND = !IS_STATIC || !!API;
  const nav = document.querySelector('.nav');
  const toggle = document.querySelector('.nav-toggle');
  let leadBlocked = IS_STATIC && !API; // 접수 API 가 없으면 팝업을 띄우지 않음
  const motionOK = matchMedia('(prefers-reduced-motion: no-preference)').matches;

  // 방문자 ID (정적 모드는 쿠키 대신 localStorage)
  let vid = '';
  try {
    vid = localStorage.getItem('vid') || '';
    if (!/^[a-f0-9]{32}$/.test(vid)) {
      vid = [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('');
      localStorage.setItem('vid', vid);
    }
  } catch { vid = ''; }

  const post = (path, data) => {
    if (!CAN_SEND) return;
    fetch(API + path, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true, mode: 'cors',
      body: JSON.stringify({ ...data, vid })
    }).catch(() => {});
  };

  // 0) 공지·점검 상태 (텔레그램 /notice, /maint → 재배포 없이 즉시 반영)
  if (IS_STATIC && API) {
    fetch(API + '/api/site', { mode: 'cors', cache: 'no-store' }).then((r) => r.json()).then((s) => {
      if (typeof s.notice === 'string') {
        let bar = document.querySelector('.notice');
        if (!s.notice) bar?.remove();
        else {
          if (!bar) { bar = document.createElement('div'); bar.className = 'notice'; bar.setAttribute('role', 'status'); bar.innerHTML = '<div class="wrap"></div>'; body.prepend(bar); }
          bar.querySelector('.wrap').textContent = s.notice;
        }
      }
      if (s.status === 'maintenance') {
        const main = document.querySelector('main');
        const el = document.createElement('div');
        el.className = 'maint-banner card';
        el.innerHTML = '<b>🛠 사이트 점검 중입니다</b><p>잠시 후 다시 방문해 주세요. 상담 문의는 전화로 부탁드립니다.</p>';
        main?.prepend(el);
        document.querySelectorAll('#applyForm, #leadForm').forEach((f) => f.querySelectorAll('input, select, textarea, button').forEach((x) => (x.disabled = true)));
        // 점검 중에는 팝업을 띄우지 않고, 신청 버튼은 하단 안내로 이동
        leadBlocked = true;
        document.getElementById('leadDialog')?.close();
      }
      // 실시간 상담 창: Worker 가 chat=true 일 때만 (배포 전 옛 Worker·/chat off·점검 중에는 표시 안 함)
      if (s.chat === true && s.status !== 'maintenance') initChat();
    }).catch(() => {});
  }

  // 1) 페이지 조회 (정적 모드만 — 서버 모드는 서버가 HTML 응답 시 직접 기록)
  if (body.dataset.track === '1') post('/api/track', { path: location.pathname + location.search, referrer: document.referrer });

  // 2) 과목 노출: 과목별 과정 블록이 화면에 40% 이상 보이면 페이지 로드당 1회
  const seen = new Set();
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const s = e.target.dataset.impression;
        if (e.isIntersecting && !seen.has(s)) { seen.add(s); post('/api/event', { kind: 'view', subject: s }); io.unobserve(e.target); }
      }
    }, { threshold: 0.4 });
    document.querySelectorAll('[data-impression]').forEach((el) => io.observe(el));
  }

  // 3) 클릭: 링크·버튼·FAQ. 과목 영역 안이면 해당 과목으로 집계
  document.addEventListener('click', (e) => {
    const el = e.target.closest('a, button, summary');
    if (!el || el.closest('.hp, [data-no-track]')) return;
    const label = (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60);
    const subject = el.closest('[data-subject]')?.dataset.subject || '';
    post('/api/event', { kind: 'click', subject, label, href: el.getAttribute('href') || '' });
  }, { capture: true });

  // 모바일 메뉴
  toggle?.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
  });
  document.querySelectorAll('.nav-links a').forEach((a) => a.addEventListener('click', () => {
    nav.classList.remove('open'); toggle?.setAttribute('aria-expanded', 'false');
  }));

  // 스크롤 시 앱바 그림자
  const onScroll = () => nav?.classList.toggle('scrolled', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();

  // 과정 카드 → 폼 과정 자동 선택
  document.querySelectorAll('[data-course]').forEach((a) => a.addEventListener('click', () => {
    const sel = document.getElementById('f-subject');
    if (sel) sel.value = a.dataset.course;
  }));

  // 토스트
  let toastEl = document.querySelector('.toast');
  let tt;
  const toast = (msg) => {
    if (!toastEl) { // 학교 페이지 등 토스트 자리가 없는 페이지
      toastEl = document.createElement('div');
      toastEl.className = 'toast';
      toastEl.setAttribute('role', 'status');
      toastEl.setAttribute('aria-live', 'polite');
      body.append(toastEl);
    }
    toastEl.textContent = msg; toastEl.classList.add('show');
    clearTimeout(tt); tt = setTimeout(() => toastEl.classList.remove('show'), 3200);
  };

  const sendInquiry = async (data) => {
    // 퍼스트티쳐와 같은 Worker·텔레그램을 쓰므로 어느 사이트 문의인지 과목 앞에 표시
    data = { ...data, subject: [body.dataset.name, data.subject].filter(Boolean).join(' · ') };
    // 급식·학사일정에서 학교를 본 방문자의 신청이면 맨 앞에 표시 (Worker /stats 가 이 문구로 전환을 셈)
    let viewed = '';
    try { viewed = localStorage.getItem('fm_school') || ''; } catch { /* 저장 불가 */ }
    if (viewed) data.message = [`유입: 급식·학사일정 (${viewed})`, data.message].filter(Boolean).join('\n');
    const res = await fetch(API + '/api/inquiry', { method: 'POST', mode: 'cors', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error || '전송에 실패했습니다.');
  };
  // 네트워크 오류(서버 꺼짐 등)는 TypeError
  const sendError = (err) => (err instanceof TypeError ? '접수 서버에 연결할 수 없습니다. 잠시 후 다시 시도하거나 전화로 문의해 주세요.' : err.message);

  // 첫 방문 팝업: 과목 선택 → 인적사항 → 완료
  const initLead = (auto = true) => {
    const lead = document.getElementById('leadDialog');
    const leadForm = document.getElementById('leadForm');
    if (!lead || !leadForm) return;
    const DONE_KEY = 'fm_lead_done'; // github.io 에서 퍼스트티쳐와 같은 origin 을 쓸 수 있어 키를 나눔
    let picked = '';
    const setLeadTitle = () => { lead.querySelector('[data-lead-picked]').textContent = picked; };
    const showStep = (n) => {
      lead.dataset.at = n;
      lead.querySelectorAll('.lead-step').forEach((s) => (s.hidden = s.dataset.step !== String(n)));
      lead.querySelector('.lead-tile.picked')?.classList.remove('picked');
      lead.scrollTop = 0;
    };
    const openLead = () => { if (!lead.open) { showStep(1); lead.showModal(); } };
    const fieldOf = (n) => leadForm.elements.namedItem(n);
    const leadMsg = leadForm.querySelector('.form-msg');
    const fail = (text, focusName) => {
      leadMsg.textContent = text; leadMsg.className = 'form-msg err';
      if (focusName) fieldOf(focusName).focus?.();
    };

    lead.addEventListener('click', (e) => {
      if (e.target === lead || e.target.closest('[data-lead-close]')) { lead.close(); return; }
      if (e.target.closest('[data-lead-back]')) { showStep(1); return; }
      const tile = e.target.closest('[data-lead-pick]');
      if (tile) {
        picked = tile.dataset.leadPick;
        setLeadTitle();
        leadMsg.textContent = '';
        tile.classList.add('picked');
        setTimeout(() => showStep(2), motionOK ? 260 : 0);
      }
    });

    const addrBox = leadForm.querySelector('.lead-addr');
    const addrLayer = leadForm.querySelector('.addr-layer');
    const addrEmbed = leadForm.querySelector('.addr-embed');
    let addrZip = '';
    const clearAddr = () => {
      fieldOf('address').value = ''; fieldOf('addressDetail').value = '';
      addrZip = ''; addrLayer.hidden = true; addrEmbed.textContent = '';
    };

    // 대상에 해당하지 않는 항목은 숨김: 성인 → 학교, 화상수업 → 주소
    const syncFields = () => {
      const school = fieldOf('school');
      school.hidden = fieldOf('grade').value === '성인';
      addrBox.hidden = fieldOf('mode').value === '화상수업';
      if (school.hidden) school.value = '';
      if (addrBox.hidden) clearAddr();
    };
    leadForm.addEventListener('change', syncFields);

    // 도로명 주소: 카카오 우편번호 서비스에서 선택한 주소만 입력 (직접 입력 불가)
    // 주의: 이 스크립트 주소에 쿼리 파라미터를 붙이면 서비스가 경고창을 띄우고 멈춤
    const POSTCODE_SRC = 'https://t1.kakaocdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
    const Postcode = () => window.kakao?.Postcode || window.daum?.Postcode;
    let postcodeReady = null;
    const loadPostcode = () => (postcodeReady ||= new Promise((ok, no) => {
      if (Postcode()) return ok();
      const failed = () => { postcodeReady = null; s.remove(); no(new Error('postcode')); };
      const s = document.createElement('script');
      s.src = POSTCODE_SRC;
      s.onload = () => (Postcode() ? ok() : failed());
      s.onerror = failed;
      document.head.appendChild(s);
    }));
    const openAddr = async () => {
      if (!addrLayer.hidden) { addrLayer.hidden = true; return; }
      try {
        await loadPostcode();
      } catch {
        fail('주소 검색을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
        return;
      }
      leadMsg.textContent = '';
      addrEmbed.textContent = '';
      addrLayer.hidden = false;
      new (Postcode())({
        width: '100%', height: '100%',
        oncomplete: (d) => {
          const road = d.roadAddress || d.autoRoadAddress;
          addrLayer.hidden = true;
          if (!road) { fail('도로명 주소가 있는 항목을 선택해 주세요.'); return; }
          addrZip = d.zonecode || '';
          fieldOf('address').value = road;
          fieldOf('addressDetail').focus();
        }
      }).embed(addrEmbed);
      addrLayer.scrollIntoView({ block: 'nearest' });
    };
    leadForm.querySelector('[data-addr-search]').addEventListener('click', openAddr);
    fieldOf('address').addEventListener('click', () => { if (addrLayer.hidden) openAddr(); });

    leadForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = leadForm.querySelector('button[type=submit]');
      const data = Object.fromEntries(new FormData(leadForm).entries());
      data.subject = picked;
      data.agree = fieldOf('agree').checked;
      const val = (n) => String(data[n] || '').trim();
      leadMsg.className = 'form-msg'; leadMsg.textContent = '';
      if (!val('grade')) return fail('학년을 선택해 주세요.');
      if (!val('mode')) return fail('수업 방식을 선택해 주세요.');
      if (!val('name')) return fail('이름을 입력해 주세요.', 'name');
      if (!/^[0-9+\-() ]{8,20}$/.test(val('phone'))) return fail('연락처를 정확히 입력해 주세요.', 'phone');
      if (!fieldOf('school').hidden && !val('school')) return fail('학교를 입력해 주세요.', 'school');
      if (!addrBox.hidden && !val('address')) return fail('주소 검색으로 주소를 선택해 주세요.');
      if (!val('message')) return fail('특이사항을 입력해 주세요.', 'message');
      if (!data.agree) return fail('개인정보 수집·이용에 동의해 주세요.');
      // 우편번호 + 선택한 도로명 주소 + 상세 주소를 한 줄로 전송
      data.address = val('address') ? [addrZip && `[${addrZip}]`, val('address'), val('addressDetail')].filter(Boolean).join(' ') : '';
      delete data.addressDetail;
      // 운영 Worker 의 텔레그램 알림은 이름·연락처·학년·과목·문의 내용을 표시하므로 나머지 항목을 문의 내용에 함께 담음
      data.message = [['수업 방식', data.mode], ['학교', val('school')], ['주소', data.address], ['특이사항', val('message')]]
        .filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join('\n');
      delete data.mode; delete data.school; delete data.address;
      const label = btn.textContent;
      btn.disabled = true; btn.textContent = '전송 중…';
      try {
        await sendInquiry(data);
        leadForm.reset(); clearAddr(); syncFields();
        showStep(3);
        try { sessionStorage.setItem(DONE_KEY, '1'); } catch { /* 저장 불가 */ }
      } catch (err) {
        fail(sendError(err));
      } finally {
        btn.disabled = false; btn.textContent = label;
      }
    });

    document.querySelectorAll('[data-lead-open]').forEach((a) => a.addEventListener('click', (e) => {
      if (leadBlocked) return; // 점검 중 등은 기본 동작(하단 #apply 이동)
      e.preventDefault();
      openLead();
    }));

    // 사이트에 들어올 때마다 표시 (같은 탭에서 신청을 마친 뒤에는 제외)
    let done = false;
    try { done = !!sessionStorage.getItem(DONE_KEY); } catch { /* 저장 불가: 항상 표시 */ }
    // 학교별 과외 페이지의 카드에서 온 경우: 학교 이름을 미리 채우고 항상 표시
    const schoolParam = new URLSearchParams(location.search).get('school');
    if (schoolParam) fieldOf('school').value = schoolParam.slice(0, 60);
    if (auto && (!done || schoolParam) && !leadBlocked) openLead();
  };
  initLead();

  // 상담 신청
  const form = document.getElementById('applyForm');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = form.querySelector('.form-msg');
    const btn = form.querySelector('button[type=submit]');
    const data = Object.fromEntries(new FormData(form).entries());
    data.agree = form.agree.checked;
    msg.className = 'form-msg';
    if (!data.name.trim()) { msg.textContent = '이름을 입력해 주세요.'; msg.classList.add('err'); form.name.focus(); return; }
    if (!/^[0-9+\-() ]{8,20}$/.test(data.phone.trim())) { msg.textContent = '연락처를 정확히 입력해 주세요.'; msg.classList.add('err'); form.phone.focus(); return; }
    if (!data.agree) { msg.textContent = '개인정보 수집·이용에 동의해 주세요.'; msg.classList.add('err'); return; }
    // 정적 호스팅(GitHub Pages)은 API 서버(로컬 PC 터널/VPS)가 연결된 경우에만 접수
    if (IS_STATIC && !API) { msg.textContent = '지금은 온라인 접수가 어렵습니다. 전화로 문의해 주세요.'; msg.classList.add('err'); return; }
    const label = btn.textContent;
    btn.disabled = true; btn.textContent = '전송 중…';
    try {
      await sendInquiry(data);
      form.reset();
      msg.textContent = '상담 신청이 접수되었습니다. 곧 연락드리겠습니다!'; msg.classList.add('ok');
      toast('상담 신청 완료 ✓');
    } catch (err) {
      msg.textContent = sendError(err);
      msg.classList.add('err');
    } finally {
      btn.disabled = false; btn.textContent = label;
    }
  });

  // ───── 실시간 상담 ─────
  // 방문자 메시지 → Worker → 관리자 텔레그램. 관리자가 알림에 답장하면 몇 초 안에 이 창에 표시
  function initChat() {
    if (document.querySelector('.chat-launcher')) return;
    const KEY = 'fmChat';
    const WELCOME = `안녕하세요, ${body.dataset.name}입니다 😊\n수업·수업료·무료 학습 30분 등 궁금한 점을 편하게 남겨 주세요. 선생님이 직접 답해 드려요.`;
    const QUICK = ['수업료가 궁금해요', '무료 학습 30분은 어떻게 받나요?', '화상 수업도 되나요?', '우리 아이 학년도 가능한가요?'];
    const ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.2 3.6c-.5.4-1.3.1-1.3-.6V16A2.5 2.5 0 0 1 4 13.5z"/></svg>';
    const SEND = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3.4 20.4 21 12 3.4 3.6v6.4l12.6 2-12.6 2z"/></svg>';
    const fine = matchMedia('(pointer: fine)').matches;
    const isNum = (m) => typeof m.id === 'number';

    // 상담 상태는 이 브라우저에만 저장 (token 이 있어야 내 대화를 다시 불러옴)
    const st = { token: '', msgs: [], last: 0, seen: 0, at: 0, status: '' };
    try { Object.assign(st, JSON.parse(localStorage.getItem(KEY)) || {}); } catch {}
    if (!Array.isArray(st.msgs)) st.msgs = [];
    st.msgs = st.msgs.filter(isNum);
    const save = () => {
      try { localStorage.setItem(KEY, JSON.stringify({ ...st, msgs: st.msgs.filter(isNum).slice(-100) })); } catch {}
    };

    const launcher = document.createElement('button');
    launcher.type = 'button';
    launcher.className = 'chat-launcher';
    launcher.setAttribute('aria-label', '실시간 상담');
    launcher.setAttribute('aria-expanded', 'false');
    launcher.setAttribute('aria-controls', 'chatPanel');
    launcher.innerHTML = `${ICON}<span>실시간 상담</span><b class="chat-badge" hidden></b>`;
    const panel = document.createElement('section');
    panel.className = 'chat-panel';
    panel.id = 'chatPanel';
    panel.hidden = true;
    panel.dataset.noTrack = '';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-labelledby', 'chatTitle');
    panel.innerHTML = `<header class="chat-head"><span class="chat-avatar" aria-hidden="true"></span>
        <div><h2 id="chatTitle">실시간 상담</h2><p>선생님이 직접 답해 드려요</p></div>
        <button type="button" class="chat-close" aria-label="상담 창 닫기">✕</button></header>
      <div class="chat-log" role="log" aria-live="polite" aria-label="상담 대화"></div>
      <div class="chat-quick" role="group" aria-label="자주 묻는 질문"></div>
      <form class="chat-form"><textarea rows="1" maxlength="1000" placeholder="궁금한 점을 입력하세요" aria-label="상담 메시지"></textarea>
        <button type="submit" class="chat-send" aria-label="보내기" disabled>${SEND}</button></form>
      <p class="chat-note">상담 내용은 답변을 위해 저장돼요. 연락처는 원하실 때만 남겨 주세요.</p>`;
    panel.querySelector('.chat-avatar').textContent = document.querySelector('.brand-mark')?.textContent.trim() || 'F';
    // 오른쪽 아래 버튼 묶음(카톡·전화) 맨 위에 넣음. 묶음이 없는 페이지는 따로 띄움
    const dock = document.getElementById('floatCta');
    if (dock) dock.prepend(launcher); else body.append(launcher);
    body.append(panel);

    const log = panel.querySelector('.chat-log');
    const quick = panel.querySelector('.chat-quick');
    const form = panel.querySelector('.chat-form');
    const input = form.querySelector('textarea');
    const sendBtn = form.querySelector('.chat-send');
    const badge = launcher.querySelector('.chat-badge');
    const baseTitle = document.title;
    let isOpen = false, openedAt = 0, timer = 0, busy = false, queue = Promise.resolve();

    for (const q of QUICK) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = q;
      b.onclick = () => send(q);
      quick.append(b);
    }

    const bubble = (m, who) => {
      const el = document.createElement('div');
      el.className = `chat-msg ${m.from === 'user' ? 'me' : m.from === 'system' ? 'sys' : 'them'}${m.pending ? ' pending' : ''}${m.failed ? ' failed' : ''}`;
      if (who) { const w = document.createElement('span'); w.className = 'who'; w.textContent = '선생님'; el.append(w); }
      const b = document.createElement('div');
      b.className = 'bubble';
      b.textContent = m.text;
      el.append(b);
      if (m.failed) {
        const s = document.createElement('span'); s.className = 'state'; s.textContent = m.failed;
        const r = document.createElement('button'); r.type = 'button'; r.className = 'chat-retry'; r.textContent = '다시 보내기';
        r.onclick = () => { st.msgs = st.msgs.filter((x) => x !== m); send(m.text); };
        el.append(s, r);
      } else if (m.pending) {
        const s = document.createElement('span'); s.className = 'state'; s.textContent = '보내는 중…'; el.append(s);
      } else if (m.at) {
        const t = document.createElement('time'); t.textContent = String(m.at).slice(11, 16); el.append(t);
      }
      return el;
    };
    const render = (toEnd) => {
      const nearEnd = log.scrollHeight - log.scrollTop - log.clientHeight < 80;
      log.textContent = '';
      log.append(bubble({ from: 'admin', text: WELCOME }, true));
      let prev = 'admin';
      for (const m of st.msgs) { log.append(bubble(m, m.from === 'admin' && prev !== 'admin')); prev = m.from; }
      quick.hidden = st.msgs.some((m) => m.from === 'user');
      if (toEnd || nearEnd) log.scrollTop = log.scrollHeight;
    };
    const unread = () => st.msgs.filter((m) => isNum(m) && m.id > st.seen && m.from !== 'user').length;
    const paintBadge = () => {
      const n = isOpen ? 0 : unread();
      badge.hidden = !n;
      badge.textContent = n > 9 ? '9+' : String(n);
      if (!document.hidden) document.title = baseTitle;
    };

    // 새 메시지 반영. 창이 닫혀 있으면 배지·알림, 다른 탭을 보고 있으면 제목에 표시
    const got = (list) => {
      const fresh = [];
      for (const m of list || []) {
        if (!isNum(m) || st.msgs.some((x) => x.id === m.id)) continue;
        st.msgs.push(m);
        fresh.push(m);
        if (m.id > st.last) st.last = m.id;
      }
      if (!fresh.length) return;
      st.msgs.sort((a, b) => (isNum(a) ? a.id : Infinity) - (isNum(b) ? b.id : Infinity));
      st.at = Date.now();
      if (isOpen) st.seen = st.last;
      const replies = fresh.filter((m) => m.from === 'admin').length;
      if (replies && !isOpen) toast('선생님 답장이 왔어요 💬 오른쪽 아래 실시간 상담을 눌러 보세요.');
      if (replies && document.hidden) document.title = `(${replies}) 새 답장 · ${baseTitle}`;
      render();
      paintBadge();
    };

    const api = async (path, data) => {
      const res = await fetch(API + path, { method: 'POST', mode: 'cors', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || '보내지 못했어요. 잠시 후 다시 시도해 주세요.');
      return j;
    };

    // 새 답장 확인 간격: 창을 보고 있으면 3초(조용하면 점점 느리게), 닫혀 있으면 20초(하루 안에 대화한 경우만)
    const delay = () => {
      if (!st.token) return 0;
      const idle = Date.now() - Math.max(st.at || 0, openedAt);
      if (isOpen) return document.hidden ? (idle < 600e3 ? 15000 : 0) : idle < 120e3 ? 3000 : idle < 600e3 ? 6000 : 15000;
      if (document.hidden || st.status === 'closed') return 0;
      return Date.now() - (st.at || 0) < 864e5 ? 20000 : 0;
    };
    const schedule = () => { clearTimeout(timer); const ms = delay(); if (ms) timer = setTimeout(poll, ms); };
    async function poll() {
      clearTimeout(timer);
      if (busy || !st.token) return;
      busy = true;
      try {
        const r = await api('/api/chat/poll', { token: st.token, after: st.last });
        if (r.status === 'none') { st.token = ''; st.status = ''; } // 서버에서 지운 상담 → 다음 메시지는 새 상담
        else { st.status = r.status; got(r.messages); }
        save();
      } catch {} finally { busy = false; schedule(); }
    }

    // 보내기: 순서대로 하나씩 (첫 메시지로 상담방이 만들어진 뒤 다음 메시지)
    function send(raw) {
      const text = String(raw || '').trim().slice(0, 1000);
      if (!text) return;
      const tmp = { id: 'p' + Date.now() + Math.random(), from: 'user', text, pending: true };
      st.msgs.push(tmp);
      render(true);
      queue = queue.then(async () => {
        try {
          const r = await api('/api/chat', { token: st.token, text, after: st.last, page: location.pathname + location.search, title: baseTitle, vid });
          st.msgs = st.msgs.filter((m) => m !== tmp);
          if (r.token) st.token = r.token;
          st.status = r.status || 'open';
          got(r.messages);
          st.seen = Math.max(st.seen, st.last);
        } catch (err) {
          tmp.pending = false;
          tmp.failed = err instanceof TypeError ? '인터넷 연결을 확인해 주세요.' : err.message;
        }
        save();
        render(true);
        paintBadge();
        schedule();
      });
    }

    const grow = () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight + 2, 120) + 'px';
      sendBtn.disabled = !input.value.trim();
    };
    input.addEventListener('input', grow);
    // PC: Enter 보내기 · Shift+Enter 줄바꿈 (한글 조합 중 Enter 는 무시). 휴대폰: Enter 는 줄바꿈, 보내기 버튼으로 전송
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && fine && !e.isComposing && e.keyCode !== 229) { e.preventDefault(); form.requestSubmit(); }
    });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const t = input.value;
      if (!t.trim()) return;
      input.value = '';
      grow();
      send(t);
      if (fine) input.focus();
    });

    const setOpen = (v) => {
      isOpen = v;
      panel.hidden = !v;
      launcher.setAttribute('aria-expanded', String(v));
      if (v) {
        openedAt = Date.now();
        st.seen = st.last;
        save();
        render(true);
        if (fine) input.focus();
        poll();
      } else {
        launcher.focus();
        schedule();
      }
      paintBadge();
    };
    launcher.addEventListener('click', () => setOpen(!isOpen));
    panel.querySelector('.chat-close').addEventListener('click', () => setOpen(false));
    panel.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });
    // 다른 곳에서 열기: href="#chat" 또는 data-chat-open
    document.addEventListener('click', (e) => {
      const a = e.target.closest('[data-chat-open], a[href="#chat"]');
      if (a) { e.preventDefault(); setOpen(true); }
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) schedule();
      else { paintBadge(); poll(); }
    });

    render(true);
    paintBadge();
    if (location.hash === '#chat') setOpen(true);
    else if (st.token && Date.now() - (st.at || 0) < 864e5) poll(); // 최근 대화가 있으면 그사이 온 답장 확인
  }

  // 현재 보고 있는 섹션을 메뉴에 표시
  if ('IntersectionObserver' in window) {
    const links = new Map([...document.querySelectorAll('.nav-links a[href^="#"]:not(.btn)')].map((a) => [a.getAttribute('href').slice(1), a]));
    const spy = new IntersectionObserver((entries) => {
      for (const e of entries) links.get(e.target.id)?.classList.toggle('active', e.isIntersecting);
    }, { rootMargin: '-45% 0px -50% 0px' });
    links.forEach((_, id) => { const s = document.getElementById(id); if (s) spy.observe(s); });
    // 스크롤 등장: 섹션 제목·카드가 화면에 들어올 때 한 번 ('동작 줄이기' 설정이면 생략)
    if (motionOK) {
      const reveal = new IntersectionObserver((entries) => {
        for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); reveal.unobserve(e.target); }
      }, { rootMargin: '0px 0px -8% 0px' });
      document.querySelectorAll('main .sec-head, main .card:not(.apply-form), main .numline li, main .rules').forEach((el) => { el.classList.add('reveal'); reveal.observe(el); });
    }
  }
})();
