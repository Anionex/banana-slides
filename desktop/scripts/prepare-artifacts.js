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

const desktopDir = path.resolve(__dirname, '..');
const repoRoot = path.resolve(desktopDir, '..');

function copyDir(src, dest) {
  if (!fs.existsSync(src)) {
    console.error(`ERROR: source not found: ${src}`);
    process.exit(1);
  }
  fs.rmSync(dest, { recursive: true, force: true });
  fs.cpSync(src, dest, { recursive: true });
  console.log(`Copied  ${path.relative(repoRoot, src)}  →  ${path.relative(repoRoot, dest)}`);
}

copyDir(
  path.join(repoRoot, 'frontend', 'dist'),
  path.join(desktopDir, 'frontend'),
);

copyDir(
  path.join(repoRoot, 'backend', 'dist', 'banana-backend'),
  path.join(desktopDir, 'backend'),
);

console.log('Artifacts ready.');
