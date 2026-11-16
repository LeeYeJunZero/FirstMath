import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('빌드: 메인·급식 페이지와 학교 목록', () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'fm-'));
  execFileSync(process.execPath, [path.join(root, 'scripts/build.js')], { env: { ...process.env, STATIC_OUT: out } });
  const home = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
  assert.match(home, /data-name="퍼스트매스"/);
  assert.match(home, /id="leadDialog"/);
  assert.match(home, /href="school\/"/);
  assert.doesNotMatch(home, /퍼스트티쳐/); // 복사해 온 문구가 남지 않게
  const page = fs.readFileSync(path.join(out, 'school/index.html'), 'utf8');
  assert.match(page, /assets\/js\/school\.js/);
  const list = JSON.parse(fs.readFileSync(path.join(out, 'school/schools.json'), 'utf8'));
  assert.ok(list.length > 5000);
  const daechi = list.find((s) => s[0] === '대치중학교');
  assert.deepEqual(daechi, ['대치중학교', '중', '서울특별시 강남구', 'B10', '7091427']);
  fs.rmSync(out, { recursive: true, force: true });
});

test('급식·학사일정 파싱', async () => {
  await import('../public/assets/js/school.js');
  const { dishes, grades, mergeEvents } = globalThis.FM;
  assert.deepEqual(dishes('혼합곡밥 (5)<br/>수제비국 (5.6.9.)<br/>깍두기'), [['혼합곡밥', '5'], ['수제비국', '5.6.9'], ['깍두기', '']]);
  assert.equal(grades({ ONE_GRADE_EVENT_YN: 'Y', TW_GRADE_EVENT_YN: 'Y', THREE_GRADE_EVENT_YN: 'Y' }), '');
  assert.equal(grades({ ONE_GRADE_EVENT_YN: 'N', TW_GRADE_EVENT_YN: 'N', THREE_GRADE_EVENT_YN: 'Y' }), '3학년');
  const ev = (d, n, off = '해당없음') => ({ AA_YMD: d, EVENT_NM: n, SBTR_DD_SC_NM: off, ONE_GRADE_EVENT_YN: 'Y', TW_GRADE_EVENT_YN: 'Y', THREE_GRADE_EVENT_YN: 'Y' });
  const out = mergeEvents([
    ev('20261228', '겨울방학', '휴업일'), ev('20261224', '겨울방학', '휴업일'), ev('20261226', '토요휴업일', '휴업일'),
    ev('20261225', '기독탄신일', '공휴일'), ev('20261223', '방학식'), ev('20261210', '체험학습'), ev('20261230', '체험학습')
  ]);
  assert.deepEqual(out.map((e) => [e.from, e.to, e.name]), [
    ['20261210', '20261210', '체험학습'],
    ['20261223', '20261223', '방학식'],
    ['20261224', '20261228', '겨울방학'], // 사이의 공휴일·주말을 건너뛰어 한 줄
    ['20261225', '20261225', '기독탄신일'],
    ['20261230', '20261230', '체험학습'] // 20일 떨어진 같은 이름은 따로
  ]);
  assert.equal(out[2].off, true);
});
