// Run: node scripts/generate_readme_buttons.mjs [--check]
// Pure SVG assets: no external fonts, CSS, scripts, or theme detection required.
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const check = process.argv.includes('--check');
if (process.argv.slice(2).some(arg => arg !== '--check')) {
  console.error(JSON.stringify({ status: 'error', message: 'Usage: node scripts/generate_readme_buttons.mjs [--check]' }));
  process.exit(1);
}
const directory = new URL('../assets/buttons/', import.meta.url);
// Vendored, unmodified Lucide nodes preserve the upstream geometry and license.
const iconSource = JSON.parse(await readFile(new URL('../assets/readme/lucide-icons.json', import.meta.url), 'utf8'));
const icons = Object.fromEntries(Object.entries(iconSource.icons).map(([name, icon]) => [name, icon.body]));
const { languages } = JSON.parse(await readFile(new URL('../docs/i18n/languages.json', import.meta.url), 'utf8'));
const buttons = languages.flatMap(language => [
  ...Object.entries(language.buttons).flatMap(([icon, [label, width]]) => [false, true].map(dark => ({
    name: `${icon}-${language.asset}${dark ? '-dark' : ''}`, label, width, icon, primary: icon === 'demo', dark,
  }))),
  ...[false, true].map(active => ({
    name: `language-${language.asset}${active ? '-active' : ''}`,
    label: language.name, width: language.width, compact: true, active,
  })),
]);
buttons.push({ name: 'language-divider', width: 14, divider: true });
// Slice one continuous, interlocking segmented control into independently linked cells.
for (const selected of languages) for (const dark of [false, true]) {
  let start = 0;
  const total = languages.reduce((sum, language) => sum + language.width, 0);
  const paper = dark ? '#0D1117' : '#FFFFFF';
  const inactive = dark ? '#252B32' : '#EEF0F3';
  const active = dark ? '#F0F2F5' : '#24292F';
  const pieces = languages.map((language, index) => {
    const end = start + language.width;
    const selectedHere = language.asset === selected.asset;
    const left = index === 0 ? `M12 0` : `M${start} 0`;
    const right = index === languages.length - 1
      ? `H${end-12}A12 12 0 0 1 ${end} 12A12 12 0 0 1 ${end-12} 24`
      : `H${end}C${end-14.4} 0 ${end-14.4} 24 ${end} 24`;
    const close = index === 0 ? 'H12A12 12 0 0 1 0 12A12 12 0 0 1 12 0Z'
      : `H${start}C${start-14.4} 24 ${start-14.4} 0 ${start} 0Z`;
    const fill = selectedHere ? active : inactive;
    const color = dark ? (selectedHere ? '#24292F' : '#B7C0CB') : (selectedHere ? '#FFFFFF' : '#445166');
    const label = language.name.replaceAll('&','&amp;');
    const seam = index === languages.length - 1 ? '' : `<path d="M${end} 0C${end-14.4} 0 ${end-14.4} 24 ${end} 24" fill="none" stroke="${paper}" stroke-width="2"/>`;
    const value = `<path d="${left}${right}${close}" fill="${fill}"/>${seam}<text x="${start+language.width/2-(index===languages.length-1?2:7)}" y="16.5" text-anchor="middle" fill="${color}" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC',sans-serif" font-size="12" font-weight="600">${label}</text>`;
    start = end;
    return value;
  }).join('');
  start = 0;
  for (const language of languages) {
    buttons.push({name:`language-${language.asset}-selected-${selected.asset}-${dark?'dark':'light'}`,raw:`<svg xmlns="http://www.w3.org/2000/svg" width="${language.width}" height="24" viewBox="${start} 0 ${language.width} 24" role="img" aria-label="${language.name}"><title>${language.name}</title>${pieces}</svg>\n`});
    start += language.width;
  }
}


function render({ label, width, icon, primary, compact, active, divider, dark }) {
  label = label?.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
  if (divider) return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="30" viewBox="0 0 14 30" aria-hidden="true">
  <path d="M7 9v12" stroke="#B8BDC5" stroke-width="1.5" stroke-linecap="round"/>
</svg>
`;
  // Transparent vertical padding keeps wrapped rows apart without README CSS.
  const height = compact ? 30 : 38;
  const fill = compact ? (active ? '#24292F' : '#EEF0F3') : primary ? '#FFD52C' : dark ? '#21262D' : '#F3F4F6';
  const stroke = compact ? (active ? '#363D44' : '#EEF0F3') : primary ? '#EBC327' : dark ? '#30363D' : '#ECEEF1';
  const color = compact ? (active ? '#FFFFFF' : '#445166') : primary ? '#29270D' : dark ? '#EEEDE7' : '#24262B';
  const labelWidth = [...label].reduce((sum, char) => sum + (char.codePointAt(0) > 255 ? 13 : 6.7), 0);
  const iconX = (width - labelWidth - 23) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${label}">
  <title>${label}</title>
  <rect x="0.5" y="${compact ? .5 : 3.5}" width="${width - 1}" height="${compact ? 29 : 31}" rx="${compact ? 15 : 6}" fill="${fill}" stroke="${stroke}"/>
${icon ? `  <g transform="translate(${iconX} 11.5) scale(.625)" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${icons[icon]}</g>\n` : ''}  <text x="${icon ? (width + 23) / 2 : width / 2}" y="${compact ? 20 : 24}" text-anchor="middle" fill="${color}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif" font-size="${compact ? 14 : 13}" font-weight="600">${label}</text>
</svg>
`;
}

try {
  if (!check) await mkdir(directory, { recursive: true });
  const results = await Promise.all(buttons.map(async button => {
    const file = new URL(`${button.name}.svg`, directory);
    const expected = button.raw ?? render(button);
    if (check) {
      if (await readFile(file, 'utf8') !== expected) throw new Error(`Stale asset: ${button.name}.svg`);
    } else {
      await writeFile(file, expected);
    }
    return button.name;
  }));
  console.log(JSON.stringify({ status: 'ok', mode: check ? 'check' : 'generate', assets: results }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ status: 'error', message: error.message }));
  process.exitCode = 1;
}
