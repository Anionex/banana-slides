const path = require('path');

const DESKTOP_ICON_RESOURCES = Object.freeze({
  brandPng: 'BananaSlides.icon/Assets/brand-logo.png',
  appPng: 'icon.png',
  appIco: 'icon.ico',
  macComposer: 'BananaSlides.icon',
  macBundle: 'icon.icns',
  macTray: 'trayTemplate.png',
  macTray2x: 'trayTemplate@2x.png',
});

const SPLASH_ICON_PATH = `resources/${DESKTOP_ICON_RESOURCES.brandPng}`;

function getResourceRoot({ isPackaged, resourcesPath, desktopDir }) {
  return isPackaged ? resourcesPath : path.join(desktopDir, 'resources');
}

function getApplicationIconPath(options) {
  const fileName = options.platform === 'win32'
    ? DESKTOP_ICON_RESOURCES.appIco
    : DESKTOP_ICON_RESOURCES.appPng;
  return path.join(getResourceRoot(options), fileName);
}

function getTrayIconPath(options) {
  if (options.platform === 'darwin') {
    return path.join(getResourceRoot(options), DESKTOP_ICON_RESOURCES.macTray);
  }
  return getApplicationIconPath(options);
}

function shouldSetDockIcon({ platform, isPackaged }) {
  return platform === 'darwin' && !isPackaged;
}

module.exports = {
  DESKTOP_ICON_RESOURCES,
  SPLASH_ICON_PATH,
  getApplicationIconPath,
  getTrayIconPath,
  shouldSetDockIcon,
};
