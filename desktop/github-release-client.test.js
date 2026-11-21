const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { fetchGitHubReleases } = require('./github-release-client');

test('packages the GitHub release client with the desktop application', () => {
  const builderConfig = fs.readFileSync(path.join(__dirname, 'electron-builder.yml'), 'utf8');
  assert.match(builderConfig, /- "github-release-client\.js"/);
});

test('paginates until GitHub returns a partial release page', async () => {
  const calls = [];
  const fullPage = Array.from({ length: 3 }, (_, index) => ({ id: index + 1 }));
  const finalPage = [{ id: 4 }];
  const releases = await fetchGitHubReleases('Anionex', 'banana-slides', {
    perPage: 3,
    fetchPage: async (requestPath, options) => {
      calls.push({ requestPath, options });
      return calls.length === 1 ? fullPage : finalPage;
    },
    userAgent: 'pagination-test',
  });

  assert.deepEqual(releases, [...fullPage, ...finalPage]);
  assert.deepEqual(calls, [
    {
      requestPath: '/repos/Anionex/banana-slides/releases?per_page=3&page=1',
      options: { userAgent: 'pagination-test' },
    },
    {
      requestPath: '/repos/Anionex/banana-slides/releases?per_page=3&page=2',
      options: { userAgent: 'pagination-test' },
    },
  ]);
});

test('rejects malformed release pages instead of reporting the app current', async () => {
  await assert.rejects(
    fetchGitHubReleases('Anionex', 'banana-slides', {
      fetchPage: async () => ({ message: 'rate limited' }),
    }),
    /invalid releases response/,
  );
});
