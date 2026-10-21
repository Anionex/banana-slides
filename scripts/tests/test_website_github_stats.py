import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from urllib.error import HTTPError, URLError

spec = importlib.util.spec_from_file_location('stats', Path(__file__).resolve().parents[1] / 'refresh_website_github_stats.py')
stats = importlib.util.module_from_spec(spec)
spec.loader.exec_module(stats)


class SharedSnapshotTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.path = Path(self.temp.name) / 'github.json'
        self.previous = {'repository': stats.REPOSITORY, 'stars': 15000, 'forks': 1000, 'updated_at': '2026-10-01T00:00:00Z'}
        self.path.write_text(json.dumps(self.previous))

    def test_failure_retains_snapshot_across_process_reads(self):
        for error in [URLError('offline'), HTTPError('https://api.github.com', 403, 'limited', {}, None), TimeoutError()]:
            with self.subTest(error=type(error).__name__), patch.object(stats, 'urlopen', side_effect=error):
                with self.assertRaises(type(error)):
                    stats.refresh(self.path)
                self.assertEqual(json.loads(self.path.read_text()), self.previous)
                self.assertEqual(len(list(self.path.parent.iterdir())), 1)

    def test_invalid_responses_never_replace_snapshot(self):
        for data in [{}, {'full_name': 'wrong/repo'}, {'full_name': stats.REPOSITORY, 'stargazers_count': True, 'forks_count': 100}]:
            with self.subTest(data=data), patch.object(stats, 'urlopen', return_value=io.BytesIO(json.dumps(data).encode())):
                with self.assertRaises(ValueError):
                    stats.refresh(self.path)
                self.assertEqual(json.loads(self.path.read_text()), self.previous)

    def test_success_replaces_snapshot_atomically_and_is_readable_by_web_server(self):
        response = {'full_name': stats.REPOSITORY, 'stargazers_count': 16000, 'forks_count': 1100}
        with patch.object(stats, 'urlopen', return_value=io.BytesIO(json.dumps(response).encode())):
            result = stats.refresh(self.path)
        self.assertEqual(json.loads(self.path.read_text()), result)
        self.assertEqual(result['stars'], 16000)
        self.assertEqual(self.path.stat().st_mode & 0o777, 0o644)
        self.assertEqual(len(list(self.path.parent.iterdir())), 1)


if __name__ == '__main__':
    unittest.main()
