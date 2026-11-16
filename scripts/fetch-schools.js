// NEIS 학교기본정보에서 중학교·고등학교만 받아 data/schools.json 으로 저장 (필요할 때 수동 실행, 결과 파일을 커밋)
//   node --env-file=.env scripts/fetch-schools.js
// 형식: [학교명, 학교급(중/고), 시·도, 시·군·구, 교육청코드, 학교코드, 설립구분, 남녀공학, 고교구분, 주소, 홈페이지]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const KEY = process.env.NEIS_API_KEY;
if (!KEY) { console.error('.env 에 NEIS_API_KEY 가 없습니다.'); process.exit(1); }
const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../data/schools.json');
const SIZE = 1000;

async function page(kind, pIndex) {
  const url = 'https://open.neis.go.kr/hub/schoolInfo?' + new URLSearchParams({ KEY, Type: 'json', pIndex: String(pIndex), pSize: String(SIZE), SCHUL_KND_SC_NM: kind });
  for (let attempt = 1; ; attempt++) {
    try {
      const j = await (await fetch(url)).json();
      if (j.RESULT?.CODE === 'INFO-200') return { total: 0, rows: [] };
      if (!j.schoolInfo) throw new Error(`NEIS 응답 오류: ${j.RESULT?.CODE} ${j.RESULT?.MESSAGE}`);
      return { total: j.schoolInfo[0].head[0].list_total_count, rows: j.schoolInfo[1].row };
    } catch (e) {
      if (attempt >= 3) throw new Error(`${kind} ${pIndex}쪽 실패: ${e.message}`); // 키가 든 URL 은 출력하지 않음
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
}
async function all(kind) {
  const rows = [];
  for (let i = 1; ; i++) {
    const p = await page(kind, i);
    rows.push(...p.rows);
    if (p.rows.length < SIZE || rows.length >= p.total) {
      if (rows.length !== p.total) throw new Error(`${kind}: 받은 수(${rows.length})가 전체(${p.total})와 다릅니다.`);
      return rows;
    }
  }
}

const city = (addr) => {
  const t = String(addr || '').trim().split(/\s+/)[1] || '';
  return /[시군구]$/.test(t) ? t : '기타';
};
const clean = (v) => { const s = String(v ?? '').trim(); return !s || s === '해당없음' ? '' : s; };
const rows = [...await all('중학교'), ...await all('고등학교')];
const list = rows.map((r) => [
  r.SCHUL_NM.trim(), r.SCHUL_KND_SC_NM === '중학교' ? '중' : '고', r.LCTN_SC_NM || '기타', city(r.ORG_RDNMA),
  r.ATPT_OFCDC_SC_CODE, r.SD_SCHUL_CODE, clean(r.FOND_SC_NM), clean(r.COEDU_SC_NM), clean(r.HS_SC_NM),
  clean(r.ORG_RDNMA), /^https?:\/\//.test(clean(r.HMPG_ADRES)) ? clean(r.HMPG_ADRES) : (clean(r.HMPG_ADRES) ? 'http://' + clean(r.HMPG_ADRES) : '')
]).sort((a, b) => a[2].localeCompare(b[2], 'ko') || a[3].localeCompare(b[3], 'ko') || a[0].localeCompare(b[0], 'ko'));
fs.writeFileSync(out, '[\n' + list.map((x) => JSON.stringify(x)).join(',\n') + '\n]\n');
console.log(`중학교 ${list.filter((x) => x[1] === '중').length} · 고등학교 ${list.filter((x) => x[1] === '고').length} → data/schools.json`);
