import { readFileSync, existsSync, mkdirSync, renameSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

// Input: high-resolution, fully loaded artwork captures, without card clipping.
// Usage: node scripts/encode-gallery-covers.mjs <capture-directory>
const input = process.argv[2];
if (!input) throw new Error('Usage: node scripts/encode-gallery-covers.mjs <capture-directory>');
const supported = ['software', 'deepseek', 'gen-z', 'quantum', 'saas', 'food-production'];
const requested = process.argv.slice(3);
const ids = requested.length ? requested : supported;
if (ids.some(id => !supported.includes(id))) throw new Error('Unknown overview deck');
const names = ids.flatMap(id => ['zh', 'en'].map(lang => `${id}-${lang}`));
for (const name of names) {
  const file = resolve(input, `${name}.png`);
  if (!existsSync(file)) throw new Error(`Missing capture: ${file}`);
  const bytes = readFileSync(file);
  if (bytes.toString('hex', 0, 8) !== '89504e470d0a1a0a' || bytes.readUInt32BE(16) < 1600 || bytes.readUInt32BE(20) < 900) {
    throw new Error(`Capture must be a PNG of at least 1600 × 900: ${file}`);
  }
}
const output = resolve(dirname(fileURLToPath(import.meta.url)), '../public/gallery/overviews');
mkdirSync(output, { recursive: true });
const results = names.map(name => {
  const destination = resolve(output, `${name}.webp`);
  const temporary = `${destination}.tmp`;
  execFileSync('cwebp', ['-quiet', '-q', '88', '-m', '6', '-metadata', 'none', '-resize', '1600', '900', resolve(input, `${name}.png`), '-o', temporary], { timeout: 30000 });
  const bytes = readFileSync(temporary);
  if (bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WEBP') throw new Error(`Invalid WebP: ${name}`);
  renameSync(temporary, destination);
  return { name, width: 1600, height: 900, bytes: statSync(destination).size };
});
console.log(JSON.stringify(results, null, 2));
