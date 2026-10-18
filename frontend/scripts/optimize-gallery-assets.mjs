import { readFileSync, mkdirSync, statSync, renameSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

// Rebuild small display assets from the retained originals; never modify originals.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const decks = JSON.parse(readFileSync(resolve(root, 'src/landing/gallery/manifest.json'), 'utf8'));
const overviews = ['software', 'deepseek', 'gen-z', 'quantum', 'saas', 'food-production'];
const jobs = decks.flatMap(deck => deck.pages.map((_, index) => ({
  input: `public/gallery/${deck.id}/${index + 1}.webp`, output: `public/gallery/thumbnails/${deck.id}/${index + 1}.webp`, width: 320,
})));
for (const id of overviews) for (const lang of ['zh', 'en']) jobs.push({
  input: `public/gallery/overviews/${id}-${lang}.webp`, output: `public/gallery/overviews/${id}-${lang}-800.webp`, width: 800,
});
jobs.push({ input: 'src/assets/logo.png', output: 'src/assets/landing/logo.webp', width: 128 });
let sourceBytes = 0, outputBytes = 0;
for (const { input, output, width } of jobs) {
  const from = resolve(root, input), to = resolve(root, output), temp = `${to}.tmp`;
  mkdirSync(dirname(to), { recursive: true });
  execFileSync('cwebp', ['-quiet', '-q', '85', '-m', '6', '-metadata', 'none', '-resize', String(width), '0', from, '-o', temp], { timeout: 30000 });
  const bytes = readFileSync(temp);
  if (bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WEBP') throw new Error(`Invalid WebP: ${output}`);
  renameSync(temp, to);
  sourceBytes += statSync(from).size; outputBytes += bytes.length;
}
console.log(JSON.stringify({ images: jobs.length, sourceBytes, outputBytes }));
