const { app, session } = require('electron');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

const { downloadToPath } = require('../download-manager');

const expected = Buffer.from('banana-slides-electron-download-smoke');

async function run() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'banana-electron-download-'));
  const savePath = path.join(tempDir, 'presentation.pptx');
  const server = http.createServer((_request, response) => {
    response.writeHead(200, {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'Content-Disposition': 'attachment; filename="presentation.pptx"',
      'Content-Length': String(expected.length),
    });
    response.end(expected);
  });

  try {
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();
    const result = await downloadToPath({
      downloadSession: session.defaultSession,
      downloadUrl: `http://127.0.0.1:${port}/presentation.pptx`,
      savePath,
      timeoutMs: 10000,
    });

    if (!result.success) {
      throw new Error(JSON.stringify(result));
    }
    if (!fs.readFileSync(savePath).equals(expected)) {
      throw new Error('Saved file contents do not match the HTTP response.');
    }
    process.stdout.write(`Electron download smoke passed: ${savePath}\n`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(tempDir, { recursive: true, force: true });
    app.quit();
  }
}

app.whenReady().then(run).catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  app.exit(1);
});
