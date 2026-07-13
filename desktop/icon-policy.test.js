const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');
const {
  getApplicationIconPath,
  getTrayIconPath,
  shouldSetDockIcon,
} = require('./icon-policy');

const packagedContext = {
  isPackaged: true,
  resourcesPath: path.join(path.sep, 'Applications', 'Banana Slides.app', 'Contents', 'Resources'),
  desktopDir: path.join(path.sep, 'repo', 'desktop'),
};

test('packaged macOS uses the bundle icon and never overrides the Dock icon', () => {
  const context = { ...packagedContext, platform: 'darwin' };

  assert.equal(
    getApplicationIconPath(context),
    path.join(packagedContext.resourcesPath, 'icon.png'),
  );
  assert.equal(shouldSetDockIcon(context), false);
});

test('macOS Tray uses its dedicated template image', () => {
  const context = { ...packagedContext, platform: 'darwin' };

  assert.equal(
    getTrayIconPath(context),
    path.join(packagedContext.resourcesPath, 'trayTemplate.png'),
  );
});

test('development macOS may set the Dock icon from the shared app master', () => {
  const context = {
    isPackaged: false,
    resourcesPath: path.join(path.sep, 'unused'),
    desktopDir: path.join(path.sep, 'repo', 'desktop'),
    platform: 'darwin',
  };

  assert.equal(
    getApplicationIconPath(context),
    path.join(context.desktopDir, 'resources', 'icon.png'),
  );
  assert.equal(shouldSetDockIcon(context), true);
});

test('Windows keeps using the ICO app icon for the window and Tray', () => {
  const context = { ...packagedContext, platform: 'win32' };
  const expected = path.join(packagedContext.resourcesPath, 'icon.ico');

  assert.equal(getApplicationIconPath(context), expected);
  assert.equal(getTrayIconPath(context), expected);
  assert.equal(shouldSetDockIcon(context), false);
});
