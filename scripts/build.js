// GitHub Pages 용 정적 빌드: dist/{index.html, school/, assets/}
// STATIC_OUT: 출력 폴더 변경 / STATIC_API_BASE: 상담 API 주소 (없으면 pages.config.json)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { SITE } from '../src/defaults.js';
import { renderSite, renderSchoolPage, renderRobots, renderSitemap } from '../src/render.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = process.env.STATIC_OUT || path.join(root, 'dist');
const cfg = JSON.parse(fs.readFileSync(path.join(root, 'pages.config.json'), 'utf8'));
const apiBase = (process.env.STATIC_API_BASE || cfg.apiBase || '').replace(/\/$/, '');
// 대표 주소: 커스텀 도메인 → 없으면 github.io 주소 (끝에 / 포함)
const canonical = cfg.customDomain ? `https://${cfg.customDomain}/` : cfg.siteUrl ? cfg.siteUrl.replace(/\/?$/, '/') : '';

// fs.cpSync 는 Windows 비ASCII 경로에서 크래시하는 Node 버그가 있어 직접 복사
function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const a = path.join(src, e.name), b = path.join(dst, e.name);
    e.isDirectory() ? copyDir(a, b) : fs.copyFileSync(a, b);
  }
}
fs.rmSync(out, { recursive: true, force: true });
copyDir(path.join(root, 'public/assets'), path.join(out, 'assets'));

// 배포마다 CSS·JS 주소가 달라지게 해서 브라우저에 남은 옛 파일을 쓰지 않게 함
const assetV = crypto.createHash('sha1').update(['css/base.css', 'css/material.css', 'js/site.js', 'js/school.js'].map((f) => fs.readFileSync(path.join(root, 'public/assets', f))).join('')).digest('hex').slice(0, 8);
const opts = { assetV, apiBase, canonical, verify: cfg.verification || {} };

// 학교 검색 목록: [학교명, 중/고, 지역, 교육청코드, 학교코드] (data/schools.json 은 npm run fetch:schools 로 갱신)
const schools = JSON.parse(fs.readFileSync(path.join(root, 'data/schools.json'), 'utf8'));
// 학교코드가 빈 곳은 개교 전 학교라 급식·일정이 없음 (국립대 부설학교는 'C020714' 처럼 영문 포함)
const list = schools.filter((s) => s[5].trim()).map((s) => [s[0], s[1], `${s[2]} ${s[3]}`, s[4], s[5]]);
const bad = list.filter((s) => !/^[A-Z]\d{2}$/.test(s[3]) || !/^[A-Z0-9]{7}$/.test(s[4]) || !['중', '고'].includes(s[1]));
if (bad.length) throw new Error(`data/schools.json 에 코드가 이상한 학교 ${bad.length}곳: ${bad.slice(0, 3).map((s) => s[0]).join(', ')}`);

fs.writeFileSync(path.join(out, 'index.html'), renderSite(SITE, opts));
fs.mkdirSync(path.join(out, 'school'), { recursive: true });
fs.writeFileSync(path.join(out, 'school', 'index.html'), renderSchoolPage(SITE, list.length, opts));
fs.writeFileSync(path.join(out, 'school', 'schools.json'), JSON.stringify(list));
fs.writeFileSync(path.join(out, '404.html'), '<!doctype html><meta charset="utf-8"><title>404</title><p style="font-family:sans-serif;padding:40px">페이지를 찾을 수 없습니다.</p>');
fs.writeFileSync(path.join(out, '.nojekyll'), '');
if (cfg.customDomain) fs.writeFileSync(path.join(out, 'CNAME'), `${cfg.customDomain}\n`);
fs.writeFileSync(path.join(out, 'robots.txt'), renderRobots(canonical));
if (canonical) fs.writeFileSync(path.join(out, 'sitemap.xml'), renderSitemap(canonical, new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10)));
console.log(`built ${SITE.name} → ${out}  (학교 ${list.length}곳, API: ${apiBase || '없음'})`);
