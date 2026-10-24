// Play 출시 노트를 src/data/changelog.ts 맨 위 항목에서 만든다.
// 앱 안 「업데이트 이력」과 Play 출시 노트가 항상 같아진다.
//
//   npx tsx android/release-notes.ts <출력 폴더> <versionName>
//
// 출력: <폴더>/whatsnew-ko-KR, whatsnew-en-US, whatsnew-zh-CN
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CHANGELOG } from '../src/data/changelog';

const [out, versionName] = process.argv.slice(2);
if (!out || !versionName) throw new Error('usage: release-notes.ts <output dir> <versionName>');

// Play 출시 노트는 언어마다 500자까지다.
const LIMIT = 500;
const LANGS = { ko: 'ko-KR', en: 'en-US', zh: 'zh-CN' } as const;

const latest = CHANGELOG[0];
if (latest.version !== versionName) {
  throw new Error(`CHANGELOG top is ${latest.version} but build.gradle versionName is ${versionName}`);
}

mkdirSync(out, { recursive: true });
for (const [key, tag] of Object.entries(LANGS) as [keyof typeof LANGS, string][]) {
  const lines = latest.items.map((item) => `· ${item[key] || item.ko}`);
  // 줄 단위로 줄여 문장이 중간에 끊기지 않게 한다.
  while (lines.length > 1 && lines.join('\n').length > LIMIT) lines.pop();
  let text = lines.join('\n');
  if (text.length > LIMIT) text = text.slice(0, LIMIT - 1) + '…';
  writeFileSync(join(out, `whatsnew-${tag}`), text + '\n');
  console.log(`${tag}: ${text.length} chars`);
}
