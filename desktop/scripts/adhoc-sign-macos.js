const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

function walk(root, visitor) {
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const entryPath = path.join(root, entry.name);
    if (entry.isSymbolicLink()) {
      continue;
    }
    if (entry.isDirectory()) {
      visitor(entryPath, entry);
      walk(entryPath, visitor);
    } else if (entry.isFile()) {
      visitor(entryPath, entry);
    }
  }
}

function isMachO(filePath) {
  try {
    const output = execFileSync('file', ['-b', filePath], { encoding: 'utf8' });
    return output.includes('Mach-O');
  } catch (error) {
    return false;
  }
}

function isFrameworkRootBinary(filePath) {
  const parent = path.dirname(filePath);
  if (!parent.endsWith('.framework')) {
    return false;
  }
  const frameworkName = path.basename(parent, '.framework');
  return path.basename(filePath) === frameworkName;
}

function shouldSignBundle(entryPath) {
  if (!entryPath.endsWith('.app') && !entryPath.endsWith('.framework')) {
    return false;
  }

  // PyInstaller's embedded Python.framework is a partial framework layout; signing
  // its Mach-O files is enough, while signing the directory itself is ambiguous.
  return !entryPath.endsWith(`${path.sep}Python.framework`);
}

function codesign(targetPath) {
  execFileSync('codesign', ['--force', '--sign', '-', '--timestamp=none', targetPath], {
    stdio: 'inherit',
  });
}

function findApp(context) {
  const expectedApp = path.join(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}.app`,
  );
  if (fs.existsSync(expectedApp)) {
    return expectedApp;
  }

  const apps = fs.readdirSync(context.appOutDir)
    .filter((name) => name.endsWith('.app'))
    .map((name) => path.join(context.appOutDir, name));
  if (apps.length !== 1) {
    throw new Error(`Expected one macOS app bundle in ${context.appOutDir}, found ${apps.length}`);
  }
  return apps[0];
}

exports.default = async function adhocSignMacos(context) {
  if (context.electronPlatformName !== 'darwin') {
    return;
  }

  const appPath = findApp(context);
  const machOFiles = [];
  const nestedBundles = [];

  walk(appPath, (entryPath, entry) => {
    if (entry.isDirectory() && shouldSignBundle(entryPath)) {
      nestedBundles.push(entryPath);
      return;
    }
    if (entry.isFile() && !isFrameworkRootBinary(entryPath) && isMachO(entryPath)) {
      machOFiles.push(entryPath);
    }
  });

  for (const filePath of machOFiles) {
    codesign(filePath);
  }

  nestedBundles
    .sort((a, b) => b.length - a.length)
    .forEach(codesign);

  codesign(appPath);
};
