// 퍼스트매스 페이지 HTML (스타일: assets/css/site.css, 동작: site.js · school.js)
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
const tel = (p) => esc(String(p || '').replace(/[^0-9+]/g, ''));
const realPhone = (site) => (site.phone && !/^010-0000-0000$/.test(site.phone) ? site.phone : '');

// 한글은 Google Fonts 가 글자 범위별로 쪼개 주므로 화면에 쓰인 글자 묶음만 내려받음
const FONT = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@400;600;700&display=swap">`;

// <script type="application/ld+json"> 안에서 </script> 탈출 방지
const ld = (obj) => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;

function structuredData(site, url) {
  const org = {
    '@context': 'https://schema.org',
    '@type': 'EducationalOrganization',
    name: site.name,
    description: site.heroSub,
    url,
    ...(realPhone(site) ? { telephone: site.phone } : {}),
    ...(site.email ? { email: site.email } : {}),
    ...(site.area ? { areaServed: site.area } : {}),
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: '수학 수업 과정',
      itemListElement: site.courses.map((c) => ({
        '@type': 'Offer',
        description: c.price,
        itemOffered: { '@type': 'Course', name: `수학 · ${c.name}`, description: `${c.target} — ${c.desc}`, provider: { '@type': 'EducationalOrganization', name: site.name, sameAs: url } }
      }))
    }
  };
  const faq = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: site.faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } }))
  };
  return ld(org) + '\n' + ld(faq);
}

// page: { title, desc, url, keywords, extra } / opts: { assetV, verify }
function head(site, page, A, opts) {
  const v = opts.verify || {};
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(page.title)}</title>
<meta name="description" content="${esc(page.desc)}">
<meta name="keywords" content="${esc(page.keywords.join(', '))}">
<meta name="robots" content="index,follow">
${v.google ? `<meta name="google-site-verification" content="${esc(v.google)}">` : ''}
${v.naver ? `<meta name="naver-site-verification" content="${esc(v.naver)}">` : ''}
<meta property="og:type" content="website">
<meta property="og:locale" content="ko_KR">
<meta property="og:site_name" content="${esc(site.name)}">
<meta property="og:title" content="${esc(page.title)}">
<meta property="og:description" content="${esc(page.desc)}">
${page.url ? `<link rel="canonical" href="${esc(page.url)}">
<meta property="og:url" content="${esc(page.url)}">` : ''}
${page.extra || ''}
<meta name="theme-color" content="${esc(site.color)}">
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="10" fill="${site.color}"/><text x="32" y="45" font-size="38" font-family="Arial" font-weight="700" fill="#ffd23f" text-anchor="middle">${esc(site.heroSymbol)}</text></svg>`)}">
${FONT}
<link rel="stylesheet" href="${A}/css/site.css${opts.assetV ? `?v=${opts.assetV}` : ''}">
</head>`;
}

const NAV = [['#worries', '고민 해결'], ['#trial', '무료 학습'], ['#school', '급식·학사일정'], ['#courses', '수업 과정'], ['#faq', 'FAQ']];

// root: 사이트 맨 위까지의 상대 경로 ('' 또는 '../')
const navBar = (site, root, here) => `<header class="nav">
  <div class="wrap nav-inner">
    <a class="brand" href="${root || './'}"><span class="brand-mark" aria-hidden="true">${esc(site.heroSymbol)}</span><span>${esc(site.name)}</span></a>
    <button class="nav-toggle" type="button" aria-label="메뉴 열기" aria-expanded="false"><span></span><span></span><span></span></button>
    <nav class="nav-links" aria-label="주요 메뉴">
      ${NAV.map(([h, t]) => (here === 'school' && h === '#school' ? `<a class="active" href="./" aria-current="page">${t}</a>` : `<a href="${root}${h}">${t}</a>`)).join('\n      ')}
      <a class="btn btn-primary" href="${root}#apply"${root ? '' : ' data-lead-open'}>무료 학습 30분</a>
    </nav>
  </div>
</header>`;

const footer = (site, root) => `<footer class="footer">
  <div class="wrap">
    <strong>${esc(site.name)}</strong>
    <span>${esc(site.tagline)}</span>
    <span>${[site.phone, site.email].filter(Boolean).map(esc).join(' · ')}</span>
    <a href="${root}school/">전국 중·고 급식·학사일정</a>
    <small>© ${new Date().getFullYear()} ${esc(site.name)}. All rights reserved.</small>
  </div>
</footer>`;

const bodyAttrs = (site, opts) => `data-site="${esc(site.key)}" data-name="${esc(site.name)}" data-api="${esc(opts.apiBase || '')}" data-track="1" data-static="1"`;

const secHead = (no, title, sub) => `<div class="sec-head"><span class="sec-no">${no}</span><h2>${title}</h2>${sub ? `<p>${sub}</p>` : ''}</div>`;

const LEAD_GRADES = ['중1', '중2', '중3', '고1', '고2', '고3·재수생'];
const LEAD_MODES = ['방문수업', '화상수업'];

// 오른쪽 아래 상담 버튼 묶음 (실시간 상담은 site.js 가 Worker 확인 후 맨 위에 넣음)
const ICON_KAKAO = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 3.5c-5 0-9 3.2-9 7.1 0 2.5 1.6 4.7 4.1 5.9l-.9 3.4c-.1.3.3.6.6.4l4-2.6 1.2.1c5 0 9-3.2 9-7.2S17 3.5 12 3.5z"/></svg>';
const ICON_TEL = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 0 1 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1z"/></svg>';
function floatCta(site) {
  const kakao = /^https?:\/\//.test(site.kakao || '') ? site.kakao : '';
  const phone = realPhone(site);
  return `<div class="float-cta" id="floatCta">
  <div class="float-row">
    ${kakao ? `<a class="fc-btn fc-kakao" href="${esc(kakao)}" target="_blank" rel="noopener" aria-label="카톡 상담">${ICON_KAKAO}<span>카톡 상담</span></a>` : ''}
    ${phone ? `<a class="fc-btn fc-tel" href="tel:${tel(phone)}" aria-label="전화 상담 ${esc(phone)}">${ICON_TEL}<span>${esc(phone)}</span></a>` : ''}
  </div>
</div>`;
}

const leadOptions = (name, values) => values.map((v) => `<label class="opt"><input type="radio" name="${name}" value="${esc(v)}"><span>${esc(v)}</span></label>`).join('');

// 첫 방문 팝업: 1단계 과정 선택 → 2단계 인적사항 → 완료 (site.js 가 단계 전환·전송)
function leadDialog(tiles) {
  return `<dialog class="lead-modal" id="leadDialog" aria-labelledby="leadTitle">
  <div class="lead-progress" aria-hidden="true"><i></i></div>
  <button class="lead-close" type="button" data-lead-close aria-label="닫기">✕</button>
  <div class="lead-step" data-step="1">
    <h2 id="leadTitle">어떤 수학을 도와드릴까요?</h2>
    <p class="lead-sub">과정을 고르시면 <b>무료 학습 30분</b> 신청으로 이어집니다.</p>
    <div class="lead-grid">
      ${tiles.map((t) => `<button class="lead-tile" type="button" data-lead-pick="${esc(t.name)}"><b>${esc(t.icon)}</b><span>${esc(t.name)}</span></button>`).join('')}
    </div>
  </div>
  <form class="lead-step" id="leadForm" data-step="2" hidden novalidate>
    <button class="lead-back" type="button" data-lead-back>← 과정 다시 고르기</button>
    <h2><span data-lead-picked></span> 1:1 맞춤 수업 무료 학습 30분</h2>
    <div class="hp" aria-hidden="true"><label>웹사이트<input name="website" tabindex="-1" autocomplete="off"></label></div>
    <fieldset><legend>학년</legend><div class="opts">${leadOptions('grade', LEAD_GRADES)}</div></fieldset>
    <fieldset><legend>수업 방식</legend><div class="opts">${leadOptions('mode', LEAD_MODES)}</div></fieldset>
    <fieldset><legend>연락처</legend>
      <div class="lead-fields">
        <input name="name" maxlength="40" placeholder="이름 *" aria-label="이름" autocomplete="name">
        <input name="phone" maxlength="20" inputmode="tel" placeholder="연락처 *" aria-label="연락처" autocomplete="tel">
        <input class="wide" name="school" maxlength="60" placeholder="학교 *" aria-label="학교">
        <div class="wide lead-addr">
          <div class="addr-row">
            <input name="address" readonly placeholder="도로명 주소 * (주소 검색으로 선택)" aria-label="도로명 주소">
            <button class="btn" type="button" data-addr-search>주소 검색</button>
          </div>
          <div class="addr-layer" hidden><div class="addr-embed"></div></div>
          <input name="addressDetail" maxlength="80" placeholder="상세 주소 (동·호수)" aria-label="상세 주소" autocomplete="address-line2">
        </div>
        <textarea class="wide" name="message" rows="2" maxlength="700" placeholder="특이사항 * (원하시는 요일·시간, 아이 상황 등)" aria-label="특이사항"></textarea>
      </div>
    </fieldset>
    <details class="lead-terms"><summary>개인정보 수집·이용 안내 보기</summary>
      <p><b>수집 항목</b> 이름, 연락처, 학년, 학교, 주소, 희망 과정, 수업 방식, 특이사항<br>
      <b>이용 목적</b> 상담 연락, 무료 학습 30분 일정 안내, 선생님 배정<br>
      <b>보유 기간</b> 상담 종료 후 1년, 이후 파기<br>
      동의를 거부할 수 있으나, 거부하시면 신청이 어렵습니다. 만 14세 미만 학생은 보호자가 작성해 주세요.</p>
    </details>
    <label class="agree"><input type="checkbox" name="agree"> [필수] 개인정보 수집·이용에 동의합니다.</label>
    <p class="form-msg" role="alert" aria-live="polite"></p>
    <button class="btn btn-primary btn-lg btn-block" type="submit">무료 학습 30분 신청하기</button>
  </form>
  <div class="lead-step lead-done" data-step="3" hidden>
    <div class="lead-check" aria-hidden="true">✓</div>
    <h2>신청이 접수되었습니다</h2>
    <p class="lead-sub">24시간 이내에 연락드려 무료 학습 30분 일정을 안내해 드리겠습니다.</p>
    <button class="btn btn-primary btn-lg btn-block" type="button" data-lead-close>확인</button>
  </div>
</dialog>`;
}

// 첫 화면 그림: 진단 → 개념 → 유형 → 실전 학습 곡선 (그림만, 성적 수치 약속 아님)
const GRAPH_POINTS = [['진단', 90, 222], ['개념', 180, 186], ['유형', 270, 124], ['실전', 360, 58]];
const heroGraph = () => `<figure class="figure">
  <figcaption>그림 1. 1:1 수업의 학습 곡선</figcaption>
  <svg viewBox="0 0 420 290" role="img" aria-label="진단, 개념, 유형, 실전 단계를 거치며 실력이 오르는 그래프">
    <g class="graph-grid">${[60, 90, 120, 150, 180, 210, 240].map((y) => `<line x1="40" x2="400" y1="${y}" y2="${y}"/>`).join('')}${[90, 135, 180, 225, 270, 315, 360].map((x) => `<line x1="${x}" x2="${x}" y1="30" y2="250"/>`).join('')}</g>
    <path class="graph-axis" d="M40 30V250H404"/>
    <text class="graph-sub" x="46" y="26">실력</text>
    <text class="graph-sub" x="404" y="274" text-anchor="end">학습 단계</text>
    <path class="graph-alone" d="M48 236C150 228 260 226 392 214"/>
    <text class="graph-sub" x="392" y="206" text-anchor="end">혼자 공부</text>
    <path class="graph-hl" pathLength="1" d="M48 236C70 232 80 226 90 222S150 196 180 186S240 150 270 124S330 76 360 58"/>
    <path class="graph-curve" pathLength="1" d="M48 236C70 232 80 226 90 222S150 196 180 186S240 150 270 124S330 76 360 58"/>
    ${GRAPH_POINTS.map(([t, x, y], i) => `<g style="--i:${i}"><circle class="graph-dot" cx="${x}" cy="${y}" r="7"/><text class="graph-text" x="${x}" y="${y - 16}" text-anchor="middle">${t}</text></g>`).join('')}
  </svg>
</figure>`;

const KEYWORDS = ['수학 과외', '1:1 수학 과외', '중등 수학 과외', '고등 수학 과외', '수학 내신', '모의고사 수학', '수능 수학', '무료 학습'];

// opts: { assetV, apiBase, canonical, verify }
export function renderSite(site, opts = {}) {
  const A = 'assets';
  const v = opts.assetV ? `?v=${opts.assetV}` : '';
  const [first, ...rest] = site.heroTitle.split('\n');
  return `${head(site, {
    title: `${site.name} | ${site.tagline}`, desc: site.heroSub, url: opts.canonical,
    keywords: [site.name, ...KEYWORDS], extra: opts.canonical ? structuredData(site, opts.canonical) : ''
  }, A, opts)}
<body ${bodyAttrs(site, opts)}>
${site.notice ? `<div class="notice" role="status"><div class="wrap">${esc(site.notice)}</div></div>` : ''}
${navBar(site, '', 'home')}

<main>
  <section class="hero">
    <div class="wrap hero-inner">
      <div>
        <span class="tag">${esc(site.heroTag)}</span>
        <h1>${esc(first)}${rest.length ? `<br><span class="hl">${esc(rest.join(' '))}</span>` : ''}</h1>
        <p class="lead">${esc(site.heroSub)}</p>
        <div class="hero-actions">
          <a class="btn btn-primary btn-lg" href="#apply" data-lead-open>무료 학습 30분 신청</a>
          <a class="btn btn-lg" href="#school">우리 아이 학교 급식 보기</a>
        </div>
        <div class="facts">${site.facts.map(([n, t]) => `<div><b>${esc(n)}</b><span>${esc(t)}</span></div>`).join('')}</div>
      </div>
      ${heroGraph()}
    </div>
  </section>

  <section id="worries" class="section">
    <div class="wrap">
      ${secHead('01', '이런 고민, 있으신가요?', '학부모님이 자주 주시는 고민과 퍼스트매스의 풀이입니다.')}
      <div class="grid grid-2">
        ${site.worries.map((x, i) => `<article class="card problem">
          <p class="problem-q"><b>문제 ${i + 1}</b><span>${esc(x.worry)}</span></p>
          <p class="problem-a"><b>풀이</b><span>${esc(x.solution)}</span></p>
        </article>`).join('')}
      </div>
    </div>
  </section>

  <section id="trial" class="section band">
    <div class="wrap">
      ${secHead('02', '무료 학습 30분', '등록을 결정하기 전에 1:1 수학 수업을 직접 받아 보세요. 비용은 없습니다.')}
      <ol class="numline">
        ${site.steps.map((x, i) => `<li data-t="${i + 1}"><h3>${esc(x.title)}</h3><p>${esc(x.desc)}</p></li>`).join('')}
      </ol>
      <div class="band-cta"><a class="btn btn-primary btn-lg" href="#apply" data-lead-open>무료 학습 30분 신청</a></div>
    </div>
  </section>

  <section id="school" class="section">
    <div class="wrap">
      ${secHead('03', '우리 아이 학교, 확인해 볼까요?', '학교 이름만 입력하면 이번 주 급식과 이달 학사일정을 바로 보여드립니다.')}
      ${schoolTool(site, '')}
    </div>
  </section>

  <section id="courses" class="section">
    <div class="wrap">
      ${secHead('04', '수업 과정', '중학교 내신부터 수능까지, 수학만 1:1로 가르칩니다.')}
      <div class="grid grid-3">
        ${site.courses.map((x) => `<article class="card course">
          <span class="tgt">${esc(x.target)}</span>
          <h3>${esc(x.name)}</h3>
          <p>${esc(x.desc)}</p>
          <div class="price">${esc(x.price)}</div>
          <a class="btn" href="#apply" data-course="${esc(x.name)}">이 과정 상담하기</a>
        </article>`).join('')}
      </div>
    </div>
  </section>

  <section id="why" class="section">
    <div class="wrap">
      ${secHead('05', `왜 ${esc(site.name)}인가요?`)}
      <ol class="rules">
        ${site.features.map((x) => `<li><h3>${esc(x.title)}</h3><p>${esc(x.desc)}</p></li>`).join('')}
      </ol>
      ${site.tutors.map((x) => `<article class="card tutor">
        <span class="tutor-mark" aria-hidden="true">${esc(site.heroSymbol)}</span>
        <div><h3>${esc(x.name)}<small>${esc(x.role)}</small></h3><p>${esc(x.bio)}</p></div>
      </article>`).join('')}
    </div>
  </section>

  <section id="faq" class="section">
    <div class="wrap">
      ${secHead('06', '자주 묻는 질문')}
      <div class="faq-list">
        ${site.faqs.map((x) => `<details class="card faq"><summary>${esc(x.q)}</summary><p>${esc(x.a)}</p></details>`).join('')}
      </div>
    </div>
  </section>

  <section id="apply" class="section">
    <div class="wrap apply">
      <div>
        ${secHead('07', '무료 학습 30분 신청', '남겨주신 연락처로 24시간 이내에 연락드립니다.')}
        <ul class="contact-list">
          ${site.phone ? `<li><b>전화</b><a href="tel:${tel(site.phone)}">${esc(site.phone)}</a></li>` : ''}
          ${site.email ? `<li><b>이메일</b><a href="mailto:${esc(site.email)}">${esc(site.email)}</a></li>` : ''}
          ${/^https?:\/\//.test(site.kakao || '') ? `<li><b>카카오톡</b><a href="${esc(site.kakao)}" target="_blank" rel="noopener">오픈채팅 상담</a></li>` : ''}
          ${site.area ? `<li><b>수업 지역</b><span>${esc(site.area)}</span></li>` : ''}
          ${site.hours ? `<li><b>상담 시간</b><span>${esc(site.hours)}</span></li>` : ''}
        </ul>
      </div>
      <form class="card apply-form" id="applyForm" novalidate>
        <div class="hp" aria-hidden="true"><label>웹사이트<input name="website" tabindex="-1" autocomplete="off"></label></div>
        <div class="field"><label for="f-name">이름 (학생 또는 학부모)</label><input id="f-name" name="name" required maxlength="40" autocomplete="name"></div>
        <div class="field"><label for="f-phone">연락처</label><input id="f-phone" name="phone" required maxlength="20" inputmode="tel" placeholder="010-1234-5678" autocomplete="tel"></div>
        <div class="field-row">
          <div class="field"><label for="f-grade">학년</label>
            <select id="f-grade" name="grade">${LEAD_GRADES.map((g) => `<option>${g}</option>`).join('')}</select></div>
          <div class="field"><label for="f-subject">희망 과정</label>
            <select id="f-subject" name="subject"><option value="">선택 안 함</option>${site.courses.map((c) => `<option>${esc(c.name)}</option>`).join('')}</select></div>
        </div>
        <div class="field"><label for="f-msg">문의 내용</label><textarea id="f-msg" name="message" rows="4" maxlength="1000" placeholder="학교, 현재 수학 성적, 희망 수업 요일 등을 적어주세요."></textarea></div>
        <label class="agree"><input type="checkbox" name="agree" required> 상담을 위한 개인정보(이름·연락처) 수집·이용에 동의합니다.</label>
        <button class="btn btn-primary btn-lg btn-block" type="submit">무료 학습 30분 신청하기</button>
        <p class="form-msg" role="alert" aria-live="polite"></p>
      </form>
    </div>
  </section>
</main>

${footer(site, '')}
${floatCta(site)}
<div class="toast" role="status" aria-live="polite"></div>
${leadDialog(site.leadSubjects)}
<script src="${A}/js/site.js${v}" defer></script>
<script src="${A}/js/school.js${v}" defer></script>
</body>
</html>`;
}

// 학교 검색 → 급식·학사일정 (메인 페이지와 school/ 가 함께 씀, assets/js/school.js 가 동작)
// root: 사이트 맨 위까지의 상대 경로. 학교 목록(school/schools.json)은 검색창을 누를 때만 받음
const schoolTool = (site, root) => `<div class="school-tool" data-root="${root}">
    <label class="finder-search"><span aria-hidden="true">⌕</span><input id="schoolQ" type="search" placeholder="학교 이름 또는 지역 (예: 대치중, 강남구)" aria-label="학교 이름 검색" autocomplete="off"></label>
    <p class="school-result-note" id="schoolNote" hidden></p>
    <div class="school-grid" id="schoolResults"></div>

    <div id="schoolView" hidden>
      <div class="sv-head">
        <div><h2 id="svName"></h2><p id="svPlace"></p></div>
        <a class="btn btn-primary" id="svApply" href="${root || './'}">이 학교 수학 무료 학습 30분</a>
      </div>
      <section class="detail-section">
        <div class="sv-bar"><h3>급식</h3><div class="pager" data-no-track><button class="btn" type="button" data-move="week" data-step="-1" aria-label="지난주">‹</button><b id="weekLabel" aria-live="polite"></b><button class="btn" type="button" data-move="week" data-step="1" aria-label="다음 주">›</button></div></div>
        <div class="meal-grid" id="meals"></div>
        <p class="sv-legend">알레르기 번호: 1 난류 · 2 우유 · 3 메밀 · 4 땅콩 · 5 대두 · 6 밀 · 7 고등어 · 8 게 · 9 새우 · 10 돼지고기 · 11 복숭아 · 12 토마토 · 13 아황산류 · 14 호두 · 15 닭고기 · 16 쇠고기 · 17 오징어 · 18 조개류 · 19 잣</p>
      </section>
      <section class="detail-section">
        <div class="sv-bar"><h3>학사일정</h3><div class="pager" data-no-track><button class="btn" type="button" data-move="month" data-step="-1" aria-label="지난달">‹</button><b id="monthLabel" aria-live="polite"></b><button class="btn" type="button" data-move="month" data-step="1" aria-label="다음 달">›</button></div></div>
        <ul class="event-list" id="events"></ul>
      </section>
    </div>
    <p class="school-source">급식·학사일정은 교육부 나이스(NEIS) 교육정보 개방 포털의 공개 자료이며, 학교 사정에 따라 바뀔 수 있습니다. ${esc(site.name)}은(는) 각 학교와 제휴 관계가 없습니다.</p>
  </div>`;

// 급식·학사일정 전용 페이지 (dist/school/): 검색 결과 공유·검색엔진 노출용
export function renderSchoolPage(site, total, opts = {}) {
  const A = '../assets';
  const v = opts.assetV ? `?v=${opts.assetV}` : '';
  const n = total.toLocaleString('ko-KR');
  return `${head(site, {
    title: `우리 학교 급식표 · 학사일정 | 전국 중·고등학교 | ${site.name}`,
    desc: `전국 중·고등학교 ${n}곳의 이번 주 급식 메뉴와 이달 학사일정(시험·방학·행사)을 학교 이름으로 바로 찾아보세요.`,
    url: opts.canonical ? opts.canonical + 'school/' : '',
    keywords: ['급식표', '학교 급식', '오늘 급식', '학사일정', '중학교 급식', '고등학교 급식', '시험 일정', site.name]
  }, A, opts)}
<body ${bodyAttrs(site, opts)}>
${navBar(site, '../', 'school')}
<main>
  <section class="page-hero">
    <div class="wrap">
      <nav class="crumbs" aria-label="현재 위치"><a href="../">홈</a><span aria-hidden="true">›</span><span>급식·학사일정</span></nav>
      <h1 id="pageTitle">우리 학교 급식·학사일정</h1>
      <p class="lead">전국 중·고등학교 <b>${n}곳</b>의 이번 주 급식과 이달 학사일정을 학교 이름으로 바로 확인하세요.</p>
    </div>
  </section>
  <div class="wrap page-main">
    ${schoolTool(site, '../')}
  </div>
</main>
${footer(site, '../')}
${floatCta(site)}
<script src="${A}/js/site.js${v}" defer></script>
<script src="${A}/js/school.js${v}" defer></script>
</body>
</html>`;
}

export const renderRobots = (canonical) => `User-agent: *\nAllow: /\n${canonical ? `\nSitemap: ${canonical}sitemap.xml\n` : ''}`;

export const renderSitemap = (canonical, lastmod) => `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${['', 'school/'].map((p) => `  <url><loc>${esc(canonical + p)}</loc><lastmod>${esc(lastmod)}</lastmod><changefreq>weekly</changefreq></url>`).join('\n')}
</urlset>
`;
