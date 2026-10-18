from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch
from urllib.error import HTTPError, URLError
import xml.etree.ElementTree as ET

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import refresh_readme_metrics as metrics


class MetricRefreshTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        (self.root / 'assets/readme').mkdir(parents=True)
        self.data = {'full_name': 'Anionex/banana-slides', 'stargazers_count': 16321,
                     'forks_count': 1893, 'subscribers_count': 63, 'watchers_count': 16321}

    def snapshot(self):
        return {path.name: path.read_bytes() for path in self.root.rglob('*.svg')}

    def refresh(self, data=None):
        with patch.object(metrics, 'fetch_repository', return_value=data or self.data):
            return metrics.refresh(self.root)

    def test_generates_both_themes_with_subscribers_not_watchers_count(self):
        self.assertEqual(len(self.refresh()['changed_files']), 6)
        for theme in ('light', 'dark'):
            tree = ET.parse(self.root / f'assets/readme/metric-eye-{theme}.svg')
            self.assertIn('Watchers\u00a0\u00a063', ''.join(tree.getroot().itertext()))
            self.assertNotIn('16321', ''.join(tree.getroot().itertext()))
        self.assertIn(b'16.3k', self.snapshot()['metric-star-light.svg'])

    def test_no_rewrite_when_rounded_display_is_unchanged(self):
        self.refresh()
        before = self.snapshot()
        with patch.object(metrics.hero.i18n, 'atomic_write') as write:
            result = self.refresh(dict(self.data, stargazers_count=16322))
        self.assertEqual(result['changed_files'], [])
        write.assert_not_called()
        self.assertEqual(before, self.snapshot())

    def test_network_error_preserves_all_previous_files(self):
        self.refresh()
        before = self.snapshot()
        with patch.object(metrics, 'fetch_repository', side_effect=URLError('offline')):
            with self.assertRaises(URLError):
                metrics.refresh(self.root)
        self.assertEqual(before, self.snapshot())

    def test_invalid_or_partial_payload_never_overwrites_good_values(self):
        self.refresh()
        before = self.snapshot()
        for data in ({'message': 'API rate limit exceeded'},
                     dict(self.data, subscribers_count=None),
                     dict(self.data, stargazers_count=-1),
                     dict(self.data, forks_count=True),
                     dict(self.data, full_name='other/repo')):
            with self.subTest(data=data), self.assertRaises(ValueError):
                self.refresh(data)
            self.assertEqual(before, self.snapshot())

    def test_write_failure_rolls_back_entire_set(self):
        self.refresh()
        before = self.snapshot()
        original = metrics.hero.i18n.atomic_write
        calls = 0

        def fail_second_write(path, value):
            nonlocal calls
            calls += 1
            if calls == 2:
                raise OSError('disk failure')
            return original(path, value)

        with patch.object(metrics.hero.i18n, 'atomic_write', side_effect=fail_second_write):
            with self.assertRaises(OSError):
                self.refresh(dict(self.data, stargazers_count=17000))
        self.assertEqual(before, self.snapshot())

    def test_network_retries_are_bounded(self):
        with patch.object(metrics, 'urlopen', side_effect=URLError('offline')) as request, \
                patch.object(metrics.time, 'sleep') as sleep:
            with self.assertRaises(URLError):
                metrics.fetch_repository()
        self.assertEqual(request.call_count, 3)
        self.assertEqual([call.args[0] for call in sleep.call_args_list], [2, 4])

    def test_permanent_http_error_is_not_retried(self):
        error = HTTPError('https://api.github.com', 401, 'Unauthorized', {}, None)
        with patch.object(metrics, 'urlopen', side_effect=error) as request:
            with self.assertRaises(HTTPError):
                metrics.fetch_repository()
        self.assertEqual(request.call_count, 1)

    def test_hero_uses_local_metrics_and_static_license(self):
        template = metrics.hero.template({'desktop': 'https://example.com/releases'})
        self.assertNotIn('img.shields.io', template)
        self.assertIn('./assets/readme/metric-star-light.svg', template)
        self.assertIn('./assets/readme/license-dark.svg', template)


if __name__ == '__main__':
    unittest.main()
