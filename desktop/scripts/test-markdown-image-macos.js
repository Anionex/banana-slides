#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createRequire } = require('node:module');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const appPath = process.argv[2] || '';
const outDir = path.resolve(process.argv[3] || '/tmp/banana-desktop-markdown-image');

const repoRoot = path.resolve(__dirname, '..', '..');
const frontendRequire = createRequire(path.join(repoRoot, 'frontend', 'package.json'));
const executable = path.join(path.resolve(appPath), 'Contents', 'MacOS', 'Banana Slides');
const smokeResultPath = path.join(outDir, 'smoke-result.json');
const testResultPath = path.join(outDir, 'markdown-image-result.json');
const screenshotPath = path.join(outDir, 'markdown-image.png');
const userDataDir = path.join(outDir, 'user-data');
const stdoutPath = path.join(outDir, 'app-stdout.log');
const stderrPath = path.join(outDir, 'app-stderr.log');
const fixtureImage = fs.readFileSync(path.join(repoRoot, 'frontend', 'e2e', 'fixtures', 'slide_1.jpg'));

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assertSafeOutputDirectory(outputDir) {
  const candidate = path.resolve(outputDir);
  const allowedRoots = [
    '/tmp',
    os.tmpdir(),
    process.env.RUNNER_TEMP,
  ]
    .filter(Boolean)
    .map((itemPath) => path.resolve(itemPath));
  const isAllowed = allowedRoots.some((root) => {
    const relative = path.relative(root, candidate);
    return (
      relative !== ''
      && relative !== '..'
      && !relative.startsWith(`..${path.sep}`)
      && !path.isAbsolute(relative)
    );
  });
  if (!isAllowed) {
    throw new Error(`Unsafe output directory: ${candidate}`);
  }
  return candidate;
}

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function waitForFile(filePath, child, timeoutMs = 120000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (fs.existsSync(filePath)) return;
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(
        `Desktop app exited before creating ${filePath} `
        + `(exitCode: ${child.exitCode}, signalCode: ${child.signalCode})`,
      );
    }
    await delay(250);
  }
  throw new Error(`Timed out waiting for ${filePath}`);
}

async function jsonRequest(url, options = {}) {
  const response = await fetch(url, options);
  const body = await response.text();
  assert.ok(response.ok, `${options.method || 'GET'} ${url} returned ${response.status}: ${body}`);
  return { response, json: body ? JSON.parse(body) : null };
}

async function main() {
  if (!appPath) {
    throw new Error('Usage: test-markdown-image-macos.js <app-path> [out-dir]');
  }
  assert.ok(fs.existsSync(executable), `App executable not found: ${executable}`);
  assertSafeOutputDirectory(outDir);
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  const debugPort = await freePort();
  const stdout = fs.openSync(stdoutPath, 'a');
  const stderr = fs.openSync(stderrPath, 'a');
  const child = spawn(executable, [
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${userDataDir}`,
  ], {
    env: {
      ...process.env,
      BANANA_DESKTOP_SMOKE: '1',
      BANANA_DESKTOP_SMOKE_RESULT: smokeResultPath,
      BANANA_DESKTOP_SMOKE_QUIT_DELAY_MS: '120000',
    },
    stdio: ['ignore', stdout, stderr],
  });

  let browser;
  let projectId;
  try {
    await waitForFile(smokeResultPath, child);
    const smoke = JSON.parse(fs.readFileSync(smokeResultPath, 'utf8'));
    assert.equal(smoke.ok, true);
    assert.ok(smoke.backendPort);
    assert.match(smoke.url, /^file:.*index\.html/);

    const backendUrl = `http://127.0.0.1:${smoke.backendPort}`;
    await jsonRequest(`${backendUrl}/health`);

    const form = new FormData();
    form.append('file', new Blob([fixtureImage], { type: 'image/jpeg' }), 'desktop-markdown.jpg');
    const upload = await jsonRequest(`${backendUrl}/api/materials/upload`, {
      method: 'POST',
      body: form,
    });
    assert.equal(upload.response.status, 201);
    const material = upload.json.data;

    const project = await jsonRequest(`${backendUrl}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creation_type: 'idea',
        idea_prompt: 'desktop markdown image DMG test',
      }),
    });
    assert.equal(project.response.status, 201);
    projectId = project.json.data.project_id;

    const pageRecord = await jsonRequest(`${backendUrl}/api/projects/${projectId}/pages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        order_index: 0,
        outline_content: { title: 'Desktop image', points: [] },
        description_content: {
          text: `![real DMG material](${material.url})`,
        },
      }),
    });
    assert.equal(pageRecord.response.status, 201);

    const { chromium } = frontendRequire('@playwright/test');
    browser = await chromium.connectOverCDP(`http://127.0.0.1:${debugPort}`);
    let page;
    const pageDeadline = Date.now() + 10000;
    while (Date.now() < pageDeadline) {
      const context = browser.contexts()[0];
      page = context?.pages().find((candidate) => candidate.url().includes('index.html'));
      if (page) break;
      await delay(200);
    }
    assert.ok(page, 'Electron main window was not available');

    const expectedImageUrl = `${backendUrl}${material.url}`;
    const imageResponse = page.waitForResponse(
      (response) => response.url() === expectedImageUrl && response.request().resourceType() === 'image',
    );
    const targetUrl = new URL(page.url());
    targetUrl.hash = `/project/${projectId}/detail`;
    await page.goto(targetUrl.toString());

    const image = page.getByAltText('real DMG material');
    await image.waitFor({ state: 'visible' });
    assert.equal(await image.getAttribute('src'), expectedImageUrl);
    assert.equal((await imageResponse).status(), 200);
    await page.waitForFunction((alt) => {
      const element = document.querySelector(`img[alt="${alt}"]`);
      return element instanceof HTMLImageElement && element.complete && element.naturalWidth > 0;
    }, 'real DMG material');
    await page.screenshot({ path: screenshotPath, fullPage: true });

    fs.writeFileSync(testResultPath, JSON.stringify({
      ok: true,
      appUrl: targetUrl.toString(),
      backendPort: smoke.backendPort,
      imageUrl: expectedImageUrl,
      imageStatus: 200,
      screenshotPath,
    }, null, 2));
    process.stdout.write(`Desktop Markdown image test passed: ${testResultPath}\n`);
  } finally {
    if (projectId && fs.existsSync(smokeResultPath)) {
      try {
        const smoke = JSON.parse(fs.readFileSync(smokeResultPath, 'utf8'));
        await fetch(`http://127.0.0.1:${smoke.backendPort}/api/projects/${projectId}`, {
          method: 'DELETE',
          signal: AbortSignal.timeout(5000),
        });
      } catch {
        // Cleanup failure must not prevent the browser and app from closing.
      }
    }
    await browser?.close().catch(() => undefined);
    if (child.exitCode === null) child.kill('SIGTERM');
    fs.closeSync(stdout);
    fs.closeSync(stderr);
  }
}

if (require.main === module) {
  main().catch((error) => {
    try {
      assertSafeOutputDirectory(outDir);
      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(testResultPath, JSON.stringify({ ok: false, error: error.stack || error.message }, null, 2));
    } catch {
      // Do not write diagnostics to a path that failed the deletion safety check.
    }
    process.stderr.write(`${error.stack || error.message}\n`);
    process.exit(1);
  });
}

module.exports = { assertSafeOutputDirectory, waitForFile };
