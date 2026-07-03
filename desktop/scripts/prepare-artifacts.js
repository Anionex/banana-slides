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
const http = require('http');
const https = require('https');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const desktopDir = path.resolve(__dirname, '..');
const repoRoot = path.resolve(desktopDir, '..');
const generatedFfmpegDir = path.join(desktopDir, 'ffmpeg');
const generatedMacIconDir = path.join(desktopDir, 'resources', 'icon.iconset');
const generatedMacIconPath = path.join(desktopDir, 'resources', 'icon.icns');
const ffmpegCacheDir = path.join(desktopDir, '.cache', 'ffmpeg');

const windowsFfmpegArchive = {
  url: 'https://github.com/BtbN/FFmpeg-Builds/releases/download/autobuild-2026-06-27-13-21/ffmpeg-n7.1.5-1-g7d0e842004-win64-gpl-7.1.zip',
  sha256: 'd08d3c08dc2b84b3cb59ea110ac8b188684768fc77a5f0f288e13d0258ef1660',
};

function copyDir(src, dest) {
  if (!fs.existsSync(src)) {
    console.error(`ERROR: source not found: ${src}`);
    process.exit(1);
  }
  fs.rmSync(dest, { recursive: true, force: true });
  copyDirDereferenceSymlinks(src, dest);
  console.log(`Copied  ${path.relative(repoRoot, src)}  →  ${path.relative(repoRoot, dest)}`);
}

function copyDirDereferenceSymlinks(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    const stat = entry.isSymbolicLink() ? fs.statSync(srcPath) : null;

    if (entry.isDirectory() || stat?.isDirectory()) {
      copyDirDereferenceSymlinks(srcPath, destPath);
      continue;
    }

    if (entry.isFile() || stat?.isFile()) {
      fs.copyFileSync(srcPath, destPath);
      fs.chmodSync(destPath, fs.statSync(srcPath).mode);
    }
  }
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
  const command = process.platform === 'win32' ? 'where' : 'which';
  try {
    return execFileSync(command, [name], { encoding: 'utf8' }).split(/\r?\n/)[0].trim();
  } catch (error) {
    return '';
  }
}

function resolveInstallerBinary(packageName) {
  try {
    const installer = require(packageName);
    if (installer?.path && fs.existsSync(installer.path)) {
      return installer.path;
    }
  } catch (error) {
    return '';
  }
  return '';
}

function requirePairedFfmpegEnv() {
  const ffmpegSource = process.env.FFMPEG_BIN || '';
  const ffprobeSource = process.env.FFPROBE_BIN || '';
  if ((ffmpegSource && !ffprobeSource) || (!ffmpegSource && ffprobeSource)) {
    console.error(
      'ERROR: FFMPEG_BIN and FFPROBE_BIN must be set together so the packaged backend can use matching binaries.'
    );
    process.exit(1);
  }
  return { ffmpegSource, ffprobeSource };
}

function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function downloadFile(url, dest, redirectCount = 0) {
  if (redirectCount > 5) {
    return Promise.reject(new Error(`Too many redirects while downloading ${url}`));
  }

  return new Promise((resolve, reject) => {
    const client = url.startsWith('https:') ? https : http;
    const request = client.get(url, (response) => {
      if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
        response.resume();
        const location = response.headers.location;
        if (!location) {
          reject(new Error(`Redirect missing Location header while downloading ${url}`));
          return;
        }

        let redirectUrl;
        try {
          redirectUrl = new URL(location, url).toString();
        } catch (error) {
          reject(new Error(`Invalid redirect Location while downloading ${url}: ${location}`));
          return;
        }
        downloadFile(redirectUrl, dest, redirectCount + 1).then(resolve, reject);
        return;
      }

      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`Download failed with HTTP ${response.statusCode}: ${url}`));
        return;
      }

      fs.mkdirSync(path.dirname(dest), { recursive: true });
      const tempDest = `${dest}.tmp-${process.pid}`;
      const file = fs.createWriteStream(tempDest);
      let completed = false;
      let settled = false;
      const settle = (callback) => {
        if (settled) return;
        settled = true;
        callback();
      };
      response.pipe(file);
      file.on('finish', () => {
        completed = true;
      });
      file.on('close', () => {
        if (!completed) {
          fs.rmSync(tempDest, { force: true });
          settle(() => reject(new Error(`Download stream closed before finishing: ${url}`)));
          return;
        }
        try {
          fs.renameSync(tempDest, dest);
          settle(resolve);
        } catch (error) {
          fs.rmSync(tempDest, { force: true });
          settle(() => reject(error));
        }
      });
      file.on('error', (error) => {
        fs.rmSync(tempDest, { force: true });
        settle(() => reject(error));
      });
    });
    request.on('error', reject);
  });
}

async function ensureDownloadedArchive(url, expectedSha256) {
  const archiveName = path.basename(new URL(url).pathname);
  const archiveDir = path.join(ffmpegCacheDir, expectedSha256);
  const archivePath = path.join(archiveDir, archiveName);

  if (fs.existsSync(archivePath)) {
    const actualSha256 = sha256File(archivePath);
    if (actualSha256 === expectedSha256) {
      console.log(`Using cached FFmpeg archive  ${path.relative(repoRoot, archivePath)}`);
      return archivePath;
    }
    console.warn(`WARNING: cached FFmpeg archive checksum mismatch; re-downloading ${archiveName}`);
    fs.rmSync(archivePath, { force: true });
  }

  console.log(`Downloading FFmpeg for Windows  ${url}`);
  await downloadFile(url, archivePath);

  const actualSha256 = sha256File(archivePath);
  if (actualSha256 !== expectedSha256) {
    fs.rmSync(archivePath, { force: true });
    console.error(
      `ERROR: FFmpeg archive checksum mismatch.\n` +
      `Expected: ${expectedSha256}\n` +
      `Actual:   ${actualSha256}\n` +
      'Set FFMPEG_BIN and FFPROBE_BIN to trusted local binaries if you need to bypass the download.'
    );
    process.exit(1);
  }

  return archivePath;
}

function extractWindowsZip(zipPath, dest) {
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });
  const quotedZipPath = zipPath.replace(/'/g, "''");
  const quotedDest = dest.replace(/'/g, "''");
  execFileSync(
    'powershell',
    [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      `Expand-Archive -LiteralPath '${quotedZipPath}' -DestinationPath '${quotedDest}' -Force`,
    ],
    { stdio: 'inherit' },
  );
}

function findFile(root, fileName) {
  const entries = fs.readdirSync(root, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(root, entry.name);
    if (entry.isFile() && entry.name.toLowerCase() === fileName.toLowerCase()) {
      return entryPath;
    }
    if (entry.isDirectory()) {
      const found = findFile(entryPath, fileName);
      if (found) {
        return found;
      }
    }
  }
  return '';
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

async function prepareWindowsFfmpegArtifacts() {
  const { ffmpegSource, ffprobeSource } = requirePairedFfmpegEnv();
  if (ffmpegSource && ffprobeSource) {
    copyFile(ffmpegSource, path.join(generatedFfmpegDir, 'ffmpeg.exe'));
    copyFile(ffprobeSource, path.join(generatedFfmpegDir, 'ffprobe.exe'));
    return;
  }

  const customDownloadUrl = process.env.FFMPEG_DOWNLOAD_URL || '';
  const customSha256 = process.env.FFMPEG_DOWNLOAD_SHA256 || '';
  if (customDownloadUrl && !customSha256) {
    console.error(
      'ERROR: FFMPEG_DOWNLOAD_SHA256 is required when overriding FFMPEG_DOWNLOAD_URL. ' +
      'Alternatively set FFMPEG_BIN and FFPROBE_BIN to trusted local binaries.'
    );
    process.exit(1);
  }

  const downloadUrl = customDownloadUrl || windowsFfmpegArchive.url;
  const expectedSha256 = customSha256 || windowsFfmpegArchive.sha256;
  if (!expectedSha256) {
    console.error(
      'ERROR: FFMPEG_DOWNLOAD_SHA256 is required when overriding FFMPEG_DOWNLOAD_URL. ' +
      'Alternatively set FFMPEG_BIN and FFPROBE_BIN to trusted local binaries.'
    );
    process.exit(1);
  }

  const archivePath = await ensureDownloadedArchive(downloadUrl, expectedSha256);
  const extractedDir = path.join(ffmpegCacheDir, expectedSha256, 'extracted');
  extractWindowsZip(archivePath, extractedDir);

  const ffmpegSourcePath = findFile(extractedDir, 'ffmpeg.exe');
  const ffprobeSourcePath = findFile(extractedDir, 'ffprobe.exe');
  if (!ffmpegSourcePath || !ffprobeSourcePath) {
    console.error(
      `ERROR: FFmpeg archive did not contain ffmpeg.exe and ffprobe.exe: ${archivePath}\n` +
      'Set FFMPEG_BIN and FFPROBE_BIN to trusted local binaries if you use a custom archive.'
    );
    process.exit(1);
  }

  copyFile(ffmpegSourcePath, path.join(generatedFfmpegDir, 'ffmpeg.exe'));
  copyFile(ffprobeSourcePath, path.join(generatedFfmpegDir, 'ffprobe.exe'));
}

async function prepareFfmpegArtifacts() {
  fs.rmSync(generatedFfmpegDir, { recursive: true, force: true });
  fs.mkdirSync(generatedFfmpegDir, { recursive: true });

  if (process.platform === 'win32') {
    await prepareWindowsFfmpegArtifacts();
    return;
  }

  const envSources = requirePairedFfmpegEnv();
  const ffmpegSource = (
    envSources.ffmpegSource ||
    resolveInstallerBinary('@ffmpeg-installer/ffmpeg') ||
    resolveCommandBinary('ffmpeg')
  );
  const ffprobeSource = (
    envSources.ffprobeSource ||
    resolveInstallerBinary('@ffprobe-installer/ffprobe') ||
    resolveCommandBinary('ffprobe')
  );

  if (!ffmpegSource || !ffprobeSource) {
    console.error(
      'ERROR: ffmpeg/ffprobe not found for this platform. ' +
      'Install desktop npm dependencies, install ffmpeg so both commands are in PATH, ' +
      'or set FFMPEG_BIN and FFPROBE_BIN to matching binaries before packaging.'
    );
    process.exit(1);
  }

  copyFile(ffmpegSource, path.join(generatedFfmpegDir, 'ffmpeg'));
  copyFile(ffprobeSource, path.join(generatedFfmpegDir, 'ffprobe'));
}

async function main() {
  copyDir(
    path.join(repoRoot, 'frontend', 'dist'),
    path.join(desktopDir, 'frontend'),
  );

  copyDir(
    path.join(repoRoot, 'backend', 'dist', 'banana-backend'),
    path.join(desktopDir, 'backend'),
  );

  await prepareFfmpegArtifacts();
  prepareMacIconArtifacts();

  console.log('Artifacts ready.');
}

main().catch((error) => {
  console.error(`ERROR: ${error.message}`);
  process.exit(1);
});
