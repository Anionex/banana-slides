/**
 * Copy built artifacts into desktop/ before electron-builder runs.
 *
 * Expected sources (relative to repo root):
 *   frontend/dist/          → desktop/frontend/
 *   backend/dist/banana-backend/  → desktop/backend/
 *
 * Run from the desktop/ directory: node scripts/prepare-artifacts.js
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const desktopDir = path.resolve(__dirname, '..');
const repoRoot = path.resolve(desktopDir, '..');
const generatedFfmpegDir = path.join(desktopDir, 'ffmpeg');
const generatedMacIconDir = path.join(desktopDir, 'resources', 'icon.iconset');
const generatedMacIconPath = path.join(desktopDir, 'resources', 'icon.icns');

function copyDir(src, dest) {
  if (!fs.existsSync(src)) {
    console.error(`ERROR: source not found: ${src}`);
    process.exit(1);
  }
  fs.rmSync(dest, { recursive: true, force: true });
  fs.cpSync(src, dest, { recursive: true });
  console.log(`Copied  ${path.relative(repoRoot, src)}  →  ${path.relative(repoRoot, dest)}`);
}

function copyFile(src, dest) {
  if (!fs.existsSync(src)) {
    console.error(`ERROR: source not found: ${src}`);
    process.exit(1);
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  fs.chmodSync(dest, 0o755);
  console.log(`Copied  ${path.relative(repoRoot, src)}  →  ${path.relative(repoRoot, dest)}`);
}

function resolveCommandBinary(name) {
  try {
    return execFileSync('which', [name], { encoding: 'utf8' }).trim();
  } catch (error) {
    return '';
  }
}

function prepareMacIconArtifacts() {
  if (process.platform !== 'darwin') {
    return;
  }

  const sourcePng = path.join(desktopDir, 'resources', 'icon.png');
  if (!fs.existsSync(sourcePng)) {
    console.error(`ERROR: source not found: ${sourcePng}`);
    process.exit(1);
  }

  const sipsBinary = resolveCommandBinary('sips');
  const iconutilBinary = resolveCommandBinary('iconutil');
  if (!sipsBinary || !iconutilBinary) {
    console.error('ERROR: sips/iconutil not found; cannot generate macOS icon.icns.');
    process.exit(1);
  }

  fs.rmSync(generatedMacIconDir, { recursive: true, force: true });
  fs.mkdirSync(generatedMacIconDir, { recursive: true });

  const iconVariants = [
    { size: 16, name: 'icon_16x16.png' },
    { size: 32, name: 'icon_16x16@2x.png' },
    { size: 32, name: 'icon_32x32.png' },
    { size: 64, name: 'icon_32x32@2x.png' },
    { size: 128, name: 'icon_128x128.png' },
    { size: 256, name: 'icon_128x128@2x.png' },
    { size: 256, name: 'icon_256x256.png' },
    { size: 512, name: 'icon_256x256@2x.png' },
    { size: 512, name: 'icon_512x512.png' },
    { size: 1024, name: 'icon_512x512@2x.png' },
  ];

  iconVariants.forEach(({ size, name }) => {
    execFileSync(sipsBinary, ['-z', String(size), String(size), sourcePng, '--out', path.join(generatedMacIconDir, name)], {
      stdio: 'inherit',
    });
  });

  execFileSync(iconutilBinary, ['--convert', 'icns', '--output', generatedMacIconPath, generatedMacIconDir], {
    stdio: 'inherit',
  });

  fs.rmSync(generatedMacIconDir, { recursive: true, force: true });
  console.log(`Generated  ${path.relative(repoRoot, generatedMacIconPath)}`);
}

function prepareFfmpegArtifacts() {
  fs.rmSync(generatedFfmpegDir, { recursive: true, force: true });
  fs.mkdirSync(generatedFfmpegDir, { recursive: true });

  if (process.platform === 'win32') {
    copyFile(path.join(desktopDir, 'resources', 'ffmpeg', 'ffmpeg.exe'), path.join(generatedFfmpegDir, 'ffmpeg.exe'));
    copyFile(path.join(desktopDir, 'resources', 'ffmpeg', 'ffprobe.exe'), path.join(generatedFfmpegDir, 'ffprobe.exe'));
    return;
  }

  const ffmpegSource = process.env.FFMPEG_BIN || resolveCommandBinary('ffmpeg');
  const ffprobeSource = process.env.FFPROBE_BIN || resolveCommandBinary('ffprobe');

  if (!ffmpegSource || !ffprobeSource) {
    console.error(
      'ERROR: ffmpeg/ffprobe not found for this platform. ' +
      'Install them in PATH or set FFMPEG_BIN and FFPROBE_BIN before packaging.'
    );
    process.exit(1);
  }

  copyFile(ffmpegSource, path.join(generatedFfmpegDir, 'ffmpeg'));
  copyFile(ffprobeSource, path.join(generatedFfmpegDir, 'ffprobe'));
}

copyDir(
  path.join(repoRoot, 'frontend', 'dist'),
  path.join(desktopDir, 'frontend'),
);

copyDir(
  path.join(repoRoot, 'backend', 'dist', 'banana-backend'),
  path.join(desktopDir, 'backend'),
);

prepareFfmpegArtifacts();
prepareMacIconArtifacts();

console.log('Artifacts ready.');
