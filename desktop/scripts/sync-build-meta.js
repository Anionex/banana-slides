#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..', '..');
const outputPath = path.resolve(__dirname, '..', 'build-meta.json');

function git(args) {
  return execFileSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
  }).trim();
}

const commitHash = git(['rev-parse', 'HEAD']);
const commitTimeIso = git(['show', '-s', '--format=%cI', 'HEAD']);
const commitTimestamp = Number.parseInt(git(['show', '-s', '--format=%ct', 'HEAD']), 10);
const dirty = git(['status', '--porcelain']).length > 0;
const buildTimestamp = Math.floor(Date.now() / 1000);
const buildTimeIso = new Date(buildTimestamp * 1000).toISOString();

const buildMeta = {
  commitHash,
  commitTimeIso,
  commitTimestamp,
  dirty,
  buildTimeIso,
  buildTimestamp,
};

fs.writeFileSync(outputPath, `${JSON.stringify(buildMeta, null, 2)}\n`, 'utf8');
process.stdout.write(`Wrote ${outputPath}\n`);
