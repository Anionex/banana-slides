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

console.log('Artifacts ready.');
