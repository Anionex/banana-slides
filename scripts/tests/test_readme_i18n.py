"""Offline behavioral checks; never call a real translation API."""
import copy
import json
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import translate_readme_incremental as syncer


class SyncTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.config = copy.deepcopy(syncer.load_config(syncer.ROOT))
        self.config['languages'] = [lang for lang in self.config['languages']
                                    if lang['code'] in ('zh-CN', 'en', 'ja')]
        path = self.root / syncer.CONFIG
        path.parent.mkdir(parents=True)
        path.write_text(json.dumps(self.config))
        for lang in self.config['languages']:
            for name in ['language', 'demo', 'docs', 'desktop', 'deploy', 'community-x', 'community-wechat']:
                for active in ['', '-active', '-dark']:
                    asset = self.root / f'assets/buttons/{name}-{lang["asset"]}{active}.svg'
                    asset.parent.mkdir(parents=True, exist_ok=True)
                    asset.write_text('<svg/>')
            for selected in self.config['languages']:
                for theme in ['light', 'dark']:
                    asset = self.root / f'assets/buttons/language-{lang["asset"]}-selected-{selected["asset"]}-{theme}.svg'
                    asset.write_text('<svg/>')
        actions = '\n'.join(f'<a href="https://example.com/{name}"><img src="./assets/buttons/{name}-zh.svg"></a>'
                            for name in ['demo', 'docs', 'desktop', 'deploy'])
        self.source = {
            'hero': '<!-- readme:languages -->\n<!-- /readme:languages -->\n'
                    f'<!-- readme:actions -->\n{actions}\n<!-- /readme:actions -->\n介绍。\n\n',
            'install': '## 安装\n\n使用 `uv`。\n\n```bash\n# setup\nuv sync\n```\n\n',
            'usage': '## 使用\n\n打开项目。\n\n',
        }
        self.write_source()
        self.calls = []

    def write_source(self):
        (self.root / 'README.md').write_text(syncer.assemble(self.source))

    def fake(self, source, previous, target, language):
        self.calls.append((language['code'], source, previous, target))
        return source.replace('安装', 'Install').replace('使用', 'Usage').replace('介绍', 'Introduction')

    def run_sync(self, **kwargs):
        return syncer.sync(self.root, translator=self.fake, **kwargs)

    def test_initial_sync_then_noop_needs_no_credentials(self):
        self.assertEqual(self.run_sync()['calls'], 6)
        self.calls.clear()
        result = self.run_sync(check=True)
        self.assertEqual(result['calls'], 0)
        self.assertEqual(result['changed_files'], [])
        self.assertFalse(self.calls)

    def test_only_changed_section_translates_and_receives_previous_versions(self):
        self.run_sync()
        before = (self.root / 'README_EN.md').read_text()
        self.calls.clear()
        old = self.source['usage']
        self.source['usage'] += '新功能。\n\n'
        self.write_source()
        self.assertEqual(self.run_sync()['calls'], 2)
        self.assertTrue(all(call[2] == old for call in self.calls))
        self.assertTrue(all('Usage' in call[3] for call in self.calls))
        after = (self.root / 'README_EN.md').read_text()
        self.assertEqual(syncer.blocks(before)['install'], syncer.blocks(after)['install'])

    def test_rename_move_add_delete_use_ids_not_titles_or_positions(self):
        self.run_sync()
        self.source['usage'] = self.source['usage'].replace('## 使用', '## 新标题')
        self.source = {'hero': self.source['hero'], 'usage': self.source['usage'],
                       'new': '## 新标题\n\nNew section.\n\n'}
        self.write_source()
        self.assertEqual(self.run_sync()['calls'], 4)
        self.assertEqual(list(syncer.blocks((self.root / 'README_EN.md').read_text())), ['hero', 'usage', 'new'])
        self.source = {'hero': self.source['hero'], 'new': self.source['new'], 'usage': self.source['usage']}
        self.write_source()
        self.assertEqual(self.run_sync()['calls'], 0)
        self.assertEqual(list(syncer.blocks((self.root / 'README_EN.md').read_text())), list(self.source))

    def test_existing_editorial_changes_are_preserved(self):
        self.run_sync()
        path = self.root / 'README_EN.md'
        path.write_text(path.read_text().replace('打开项目。', 'Carefully edited English wording.'))
        before = path.read_text()
        self.assertEqual(self.run_sync()['calls'], 0)
        self.assertEqual(path.read_text(), before)

    def test_failure_does_not_overwrite_any_edition_or_state(self):
        self.run_sync()
        paths = [self.root / name for name in ['README_EN.md', 'README_JA.md', syncer.STATE]]
        before = {path: path.read_bytes() for path in paths}
        self.source['usage'] += 'Changed.\n\n'
        self.write_source()
        def broken(*args):
            raise RuntimeError('synthetic failure')
        with self.assertRaises(RuntimeError):
            syncer.sync(self.root, translator=broken)
        self.assertEqual(before, {path: path.read_bytes() for path in paths})
        self.assertEqual(self.run_sync()['calls'], 2)

    def test_selection_keeps_other_language_snapshot_and_pending_changes(self):
        self.run_sync()
        self.source['usage'] += 'Changed.\n\n'
        self.write_source()
        self.assertEqual(self.run_sync(selected=['en'])['calls'], 1)
        plan = self.run_sync(plan=True)
        self.assertEqual(plan['languages']['en']['translate'], [])
        self.assertEqual(plan['languages']['ja']['translate'], ['usage'])
        with self.assertRaises(ValueError):
            self.run_sync(selected=['unknown'])

    def test_button_text_and_urls_update_without_translation(self):
        self.run_sync()
        self.source['hero'] = self.source['hero'].replace('https://example.com/demo', 'https://example.com/new-demo')
        self.write_source()
        self.config['languages'][1]['buttons']['demo'][0] = 'New demo'
        (self.root / syncer.CONFIG).write_text(json.dumps(self.config))
        self.assertEqual(self.run_sync()['calls'], 0)
        target = (self.root / 'README_EN.md').read_text()
        self.assertIn('https://example.com/new-demo', target)
        self.assertIn('alt="New demo"', target)

    def test_missing_and_duplicate_ids_fail_before_translation(self):
        self.source['usage'] += '## Unmarked\n\nText\n'
        self.write_source()
        with self.assertRaises(ValueError):
            self.run_sync()
        self.assertFalse(self.calls)
        with self.assertRaises(ValueError):
            syncer.blocks('<!-- i18n:hero -->\nx\n<!-- i18n:hero -->\ny\n')

    def test_theme_pictures_preserve_navigation_fragments(self):
        self.source['hero'] = self.source['hero'].replace('https://example.com/deploy',
                                                        'https://example.com/readme#installation')
        self.write_source()
        self.run_sync()
        rendered = (self.root / 'README_EN.md').read_text()
        self.assertEqual(syncer.action_destinations(rendered)['deploy'],
                         'https://example.com/readme#installation')
        self.assertIn('<source media="(prefers-color-scheme: dark)"', rendered)
        self.assertNotIn('#installation#gh-dark-mode-only', rendered)
        self.assertEqual(self.run_sync()['calls'], 0)

    def test_missing_dark_source_is_detected_before_writing(self):
        (self.root / 'assets/buttons/docs-en-dark.svg').unlink()
        with self.assertRaisesRegex(ValueError, 'Missing asset: assets/buttons/docs-en-dark.svg'):
            self.run_sync()
        self.assertFalse((self.root / 'README_EN.md').exists())
        self.assertFalse((self.root / syncer.STATE).exists())

    def test_protected_content_and_fences_roundtrip(self):
        text = ('## Header\n\n```env\n# comment\n## not a heading\nKEY=value\n```\n'
                '> ```bash\n> echo hi\n> ```\n'
                '<a href="https://example.com">Title</a> [link](./README.md) `command`\n')
        masked, values = syncer.protect(text)
        self.assertEqual(syncer.restore(masked, values), text)
        self.assertEqual(len(syncer.headings(text)), 1)
        with self.assertRaises(ValueError):
            syncer.restore(masked.replace('⟦R0000⟧', ''), values)
        with self.assertRaises(ValueError):
            syncer.validate_translation(text, text.replace('KEY=value', 'KEY=wrong'))
        with self.assertRaises(ValueError):
            syncer.validate_translation(text, text + '\n```bash\nbroken\n')

    def test_plan_is_read_only_and_check_rejects_pending(self):
        before = (self.root / 'README.md').read_bytes()
        self.assertEqual(self.run_sync(plan=True)['calls'], 6)
        with self.assertRaises(ValueError):
            self.run_sync(check=True)
        self.assertFalse((self.root / syncer.STATE).exists())
        self.assertEqual((self.root / 'README.md').read_bytes(), before)
        self.assertFalse(self.calls)

    def test_edits_during_translation_are_never_overwritten(self):
        self.run_sync()
        previous_state = (self.root / syncer.STATE).read_bytes()
        self.source['usage'] += 'Translation input.\n\n'
        self.write_source()
        def editing(source, old, target, language):
            path = self.root / 'README_EN.md'
            path.write_text(path.read_text() + '\nNew user edit.\n')
            return self.fake(source, old, target, language)
        with self.assertRaisesRegex(ValueError, 'edited during translation'):
            syncer.sync(self.root, selected=['en'], translator=editing)
        self.assertIn('New user edit.', (self.root / 'README_EN.md').read_text())
        self.assertEqual((self.root / syncer.STATE).read_bytes(), previous_state)

    def test_korean_particle_cannot_become_part_of_raw_url(self):
        source = '详情 https://example.com/121\n[链接](https://example.com/docs)\n'
        masked, values = syncer.protect(source)
        output = '자세한 내용은 ⟦R0000⟧를 확인하세요.\n[문서](⟦R0001⟧)\n'
        restored = syncer.restore(syncer.separate_raw_urls(output, masked, values), values)
        self.assertIn('https://example.com/121 를', restored)
        self.assertIn('[문서](https://example.com/docs)', restored)
        syncer.validate_translation(source, restored)

    def test_code_placeholder_does_not_join_next_list_item(self):
        source = '1. Set up:\n   ```env\n   KEY=value\n   ```\n2. Run.\n'
        masked, values = syncer.protect(source)
        self.assertIn('⟦R0000⟧\n2. Run.', masked)
        self.assertEqual(syncer.restore(masked, values), source)


if __name__ == '__main__':
    unittest.main()
