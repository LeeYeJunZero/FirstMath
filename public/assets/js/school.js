// 급식·학사일정 페이지: 학교 검색(schools.json) → NEIS 급식(주간)·학사일정(월간)을 브라우저에서 직접 조회
(() => {
  const NEIS = 'https://open.neis.go.kr/hub/';
  const DAY = ['일', '월', '화', '수', '목', '금', '토'];
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  const md = (s) => `${+s.slice(4, 6)}/${+s.slice(6)}`;
  const label = (s) => `${md(s)} (${DAY[new Date(+s.slice(0, 4), s.slice(4, 6) - 1, +s.slice(6)).getDay()]})`;
  const dayNo = (s) => Date.UTC(+s.slice(0, 4), s.slice(4, 6) - 1, +s.slice(6)) / 864e5;

  // '혼합곡밥 (5)<br/>수제비국 (5.6.9.)' → [['혼합곡밥', '5'], ['수제비국', '5.6.9']]
  const dishes = (s) => String(s || '').split(/<br\s*\/?>/i).map((x) => x.trim()).filter(Boolean)
    .map((x) => { const m = x.match(/^(.*?)\s*\(([\d.]+)\)$/); return m ? [m[1], m[2].replace(/\.$/, '')] : [x, '']; });
  // 일부 학년만 하는 행사 → '1·2학년' (중·고는 3개 학년, 전 학년이면 표시 안 함)
  const grades = (r) => {
    const g = ['ONE', 'TW', 'THREE'].map((k, i) => (r[`${k}_GRADE_EVENT_YN`] === 'Y' ? i + 1 : 0)).filter(Boolean);
    return g.length && g.length < 3 ? `${g.join('·')}학년` : '';
  };
  // 방학·시험처럼 날마다 한 줄씩 오는 행사는 한 줄로 합침 (사이에 공휴일·주말이 끼어 5일까지 벌어진 것도)
  const mergeEvents = (rows) => {
    const out = [];
    for (const r of rows.filter((x) => x.EVENT_NM.trim() !== '토요휴업일').sort((a, b) => a.AA_YMD.localeCompare(b.AA_YMD))) {
      const e = { from: r.AA_YMD, to: r.AA_YMD, name: r.EVENT_NM.trim(), off: r.SBTR_DD_SC_NM === '휴업일', grades: grades(r) };
      const p = out.findLast((x) => x.name === e.name && x.grades === e.grades);
      if (p && dayNo(e.from) - dayNo(p.to) <= 5) p.to = e.from; else out.push(e);
    }
    return out;
  };

  if (typeof document === 'undefined') { globalThis.FM = { dishes, grades, mergeEvents }; return; } // node --test 용

  // 키 없이 부르면 한 번에 5건까지만 주므로, 1쪽에서 총 건수를 보고 나머지 쪽을 한꺼번에 받음
  // shortcut: 최대 20쪽(100건)까지만 받음, 한 달 일정이 100건을 넘는 학교가 나오면 Worker 프록시 + API 키로 전환
  const neis = async (service, params) => {
    const page = async (p) => {
      const j = await (await fetch(NEIS + service + '?' + new URLSearchParams({ Type: 'json', pIndex: p, pSize: 5, ...params }))).json();
      if (j.RESULT?.CODE === 'INFO-200') return { total: 0, rows: [] }; // 해당 기간 자료 없음
      const d = j[service];
      if (!d) throw new Error(j.RESULT?.MESSAGE || 'NEIS');
      return { total: d[0].head[0].list_total_count, rows: d[1].row };
    };
    const first = await page(1);
    const pages = Math.min(Math.ceil(first.total / 5), 20);
    const more = await Promise.all(Array.from({ length: Math.max(pages - 1, 0) }, (_, i) => page(i + 2)));
    return first.rows.concat(...more.map((x) => x.rows));
  };

  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const input = $('schoolQ'), results = $('schoolResults'), note = $('schoolNote'), view = $('schoolView');
  const mealsBox = $('meals'), eventsBox = $('events');
  const root = document.querySelector('.school-tool').dataset.root; // 메인 '' / school/ '../'
  const pageTitle = $('pageTitle'); // school/ 페이지에만 있음
  const KIND = { 중: '중학교', 고: '고등학교' };
  const MAX = 24;

  // 학교 목록: [학교명, 중/고, 지역, 교육청코드, 학교코드]
  let list = null, loading = null;
  const load = () => (loading ||= fetch(`${root}school/schools.json`).then((r) => r.json()).then((j) => { list = j; }).catch(() => { loading = null; }));
  const norm = (x) => x.replace(/\s+/g, '').toLowerCase();
  const say = (text) => { note.textContent = text; note.hidden = !text; };

  let timer;
  const search = async () => {
    const q = norm(input.value);
    if (!q) { results.textContent = ''; say(''); return; }
    if (!list) await load();
    if (!list) { say('학교 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'); return; }
    if (norm(input.value) !== q) return; // 불러오는 사이 검색어가 바뀜
    const hits = list.filter(([name, , place]) => norm(name).includes(q) || norm(place).includes(q));
    results.textContent = '';
    for (const [name, kind, place, , code] of hits.slice(0, MAX)) {
      const a = el('a', 'card school-card');
      a.href = `${root}school/?code=${code}`; // 새 탭·공유용 주소. 그냥 누르면 아래에서 이 자리에 바로 표시
      a.dataset.code = code;
      a.append(el('b', 'school-name', name), el('span', '', `${place} · ${KIND[kind]}`));
      results.append(a);
    }
    say(!hits.length ? '찾는 학교가 없습니다. 이름을 줄여서 검색해 보세요.'
      : hits.length > MAX ? `${hits.length.toLocaleString('ko-KR')}곳 중 ${MAX}곳을 보여드립니다. 이름을 더 입력해 주세요.` : `${hits.length}곳을 찾았습니다.`);
  };
  input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(search, 120); });
  input.addEventListener('focus', load, { once: true });

  // 선택한 학교
  let school = null, mealReq = 0, eventReq = 0;
  let week = [0, 6].includes(new Date().getDay()) ? 1 : 0; // 주말에는 다음 주 급식부터
  let month = 0;
  const today = ymd(new Date());

  const showMeals = async () => {
    const req = ++mealReq;
    const start = new Date(); start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7) + week * 7);
    const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(d.getDate() + i); return ymd(d); });
    $('weekLabel').textContent = `${md(days[0])} – ${md(days[4])}`;
    mealsBox.textContent = '불러오는 중…';
    let rows;
    try {
      rows = await neis('mealServiceDietInfo', { ATPT_OFCDC_SC_CODE: school[3], SD_SCHUL_CODE: school[4], MLSV_FROM_YMD: days[0], MLSV_TO_YMD: days[6] });
    } catch {
      if (req === mealReq) mealsBox.textContent = '급식 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.';
      return;
    }
    if (req !== mealReq) return; // 그사이 다른 주를 누름
    mealsBox.textContent = '';
    for (const [i, day] of days.entries()) {
      const meals = rows.filter((r) => r.MLSV_YMD === day).sort((a, b) => a.MMEAL_SC_CODE - b.MMEAL_SC_CODE);
      if (i > 4 && !meals.length) continue; // 주말은 급식이 있을 때만
      const card = el('article', `card meal-day${day === today ? ' today' : ''}`);
      card.append(el('h4', '', day === today ? `${label(day)} 오늘` : label(day)));
      if (!meals.length) card.append(el('p', 'meal-none', '급식 정보 없음'));
      for (const m of meals) {
        const head = el('p', 'meal-name', m.MMEAL_SC_NM);
        if (m.CAL_INFO) head.append(el('span', 'kcal', ` ${m.CAL_INFO}`));
        const ul = el('ul');
        for (const [dish, allergy] of dishes(m.DDISH_NM)) {
          const li = el('li', '', dish);
          if (allergy) li.append(el('small', '', ` ${allergy}`));
          ul.append(li);
        }
        card.append(head, ul);
      }
      mealsBox.append(card);
    }
  };

  const showEvents = async () => {
    const req = ++eventReq;
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth() + month, 1);
    const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
    $('monthLabel').textContent = `${first.getFullYear()}년 ${first.getMonth() + 1}월`;
    eventsBox.textContent = '';
    eventsBox.append(el('li', 'event-none', '불러오는 중…'));
    let rows;
    try {
      rows = await neis('SchoolSchedule', { ATPT_OFCDC_SC_CODE: school[3], SD_SCHUL_CODE: school[4], AA_FROM_YMD: ymd(first), AA_TO_YMD: ymd(last) });
    } catch {
      if (req === eventReq) eventsBox.firstChild.textContent = '학사일정을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.';
      return;
    }
    if (req !== eventReq) return;
    const events = mergeEvents(rows);
    eventsBox.textContent = '';
    if (!events.length) eventsBox.append(el('li', 'event-none', '등록된 일정이 없습니다.'));
    for (const e of events) {
      const li = el('li', e.off ? 'off' : '');
      li.append(el('time', '', e.from === e.to ? label(e.from) : `${label(e.from)} – ${label(e.to)}`), el('span', '', e.name));
      if (e.grades) li.append(el('small', '', e.grades));
      eventsBox.append(li);
    }
  };

  const open = (s) => {
    school = s;
    const [name, kind, place] = s;
    if (pageTitle) {
      pageTitle.textContent = `${name} 급식·학사일정`;
      document.title = `${name} 급식표 · 학사일정 | ${document.body.dataset.name}`;
      history.replaceState(null, '', `?code=${s[4]}`);
    }
    $('svName').textContent = name;
    $('svPlace').textContent = `${place} · ${KIND[kind]}`;
    $('svApply').href = `${root || './'}?school=${encodeURIComponent(name)}`; // 메인 페이지가 학교를 채운 신청 팝업을 띄움
    view.hidden = false;
    showMeals();
    showEvents();
  };

  results.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-code]');
    if (!a || !list || e.ctrlKey || e.metaKey || e.shiftKey) return; // 새 탭으로 열기는 그대로 둠
    e.preventDefault();
    open(list.find((x) => x[4] === a.dataset.code));
    results.textContent = ''; say('');
    view.scrollIntoView({ block: 'start' });
  });

  view.addEventListener('click', (e) => {
    const b = e.target.closest('[data-move]');
    if (!b || !school) return;
    if (b.dataset.move === 'week') { week += +b.dataset.step; showMeals(); } else { month += +b.dataset.step; showEvents(); }
  });

  const code = new URLSearchParams(location.search).get('code');
  if (code) {
    load().then(() => {
      const s = list?.find((x) => x[4] === code);
      if (s) open(s); else say('학교를 찾을 수 없습니다. 이름으로 다시 검색해 주세요.');
    });
  }
})();
