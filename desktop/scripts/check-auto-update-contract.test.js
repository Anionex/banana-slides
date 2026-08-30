const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const yaml = require('js-yaml');

const desktopDir = path.resolve(__dirname, '..');
const repoRoot = path.resolve(desktopDir, '..');

test('desktop packaging publishes the artifacts required by electron-updater', () => {
  const builderConfig = yaml.load(fs.readFileSync(path.join(desktopDir, 'electron-builder.yml'), 'utf8'));
  const macTargets = builderConfig.mac.target.map((target) => target.target);

  assert.deepEqual(builderConfig.publish, {
    provider: 'github',
    owner: 'Anionex',
    repo: 'banana-slides',
  });
  assert.ok(macTargets.includes('dmg'), 'macOS releases must keep the user-facing DMG');
  assert.ok(macTargets.includes('zip'), 'macOS auto-update requires a ZIP payload');
  assert.equal(builderConfig.mac.identity, undefined, 'macOS signing credentials must not be forcibly disabled');
  assert.ok(builderConfig.files.includes('update-settings.js'));

  const releaseWorkflow = fs.readFileSync(
    path.join(repoRoot, '.github', 'workflows', 'release-desktop.yml'),
    'utf8',
  );
  for (const artifactPattern of ['desktop/dist/*.zip', 'desktop/dist/*.blockmap', 'desktop/dist/latest*.yml']) {
    const escapedPattern = artifactPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const matches = releaseWorkflow.match(new RegExp(escapedPattern, 'g')) || [];
    assert.equal(matches.length, 2, `${artifactPattern} must be uploaded to workflow artifacts and GitHub Releases`);
  }
  assert.match(releaseWorkflow, /MACOS_CSC_LINK:.*secrets\.MACOS_CSC_LINK/);
  assert.match(releaseWorkflow, /MACOS_CSC_KEY_PASSWORD:.*secrets\.MACOS_CSC_KEY_PASSWORD/);
  assert.match(releaseWorkflow, /if \[ -n "\$MACOS_CSC_LINK" \]; then/);
  assert.match(releaseWorkflow, /printf 'CSC_LINK=%s\\n'.*>> "\$GITHUB_ENV"/);
  assert.doesNotMatch(
    releaseWorkflow,
    /CSC_LINK:\s*\$\{\{\s*matrix\.platform.*secrets\.MACOS_CSC_LINK/,
    'an unset signing secret must not become an empty CSC_LINK environment variable',
  );
  assert.doesNotMatch(releaseWorkflow, /desktop\/dist\/\*\.yml/);
});
