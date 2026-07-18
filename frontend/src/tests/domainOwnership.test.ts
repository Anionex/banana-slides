import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

describe('domain ownership', () => {
  const firstPartyFiles = [
    '.github/ISSUE_TEMPLATE/bug_report.yml',
    'README.md',
    'README_EN.md',
    'docs/quickstart.mdx',
    'docs/zh/quickstart.mdx',
    'skills/banana-cli/references/setup.md',
    'frontend/src/components/shared/Footer.tsx',
    'frontend/src/components/shared/HelpModal.tsx',
  ];

  it.each(firstPartyFiles)('keeps the first-party domain in %s', (relativePath) => {
    const content = fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
    expect(content).toContain('bananaslides.online');
    const contentWithoutProviderLinks = content.replace(/api\.inferera\.com/gi, '');
    expect(contentWithoutProviderLinks.toLowerCase()).not.toContain('inferera.com');
  });

  const providerExamples = [
    '.env.example',
    'docs/configuration.mdx',
    'docs/zh/configuration.mdx',
  ];

  it.each(providerExamples)('keeps the provider domain in %s', (relativePath) => {
    const content = fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
    expect(content).toContain('https://api.inferera.com');
  });
});
