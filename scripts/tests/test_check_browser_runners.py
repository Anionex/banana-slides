import importlib.util
from pathlib import Path
import shutil
import tempfile
import unittest

import yaml


ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location(
    'check_browser_runners', ROOT / 'scripts/check_browser_runners.py'
)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class BrowserRunnerTests(unittest.TestCase):
    def test_repository_workflows(self):
        checked, errors = module.check_workflows(ROOT / '.github/workflows')
        self.assertGreaterEqual(len(checked), 3)
        self.assertEqual(errors, [])

    def test_new_workflow_and_renamed_job_are_not_missed(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)
            (path / 'new-browser-workflow.yaml').write_text(yaml.safe_dump({
                'jobs': {
                    'new-job': {
                        'runs-on': 'ubuntu-latest',
                        'steps': [{'run': 'npx playwright install --with-deps chromium'}],
                    },
                    'build-only': {'runs-on': 'ubuntu-latest', 'steps': []},
                },
            }))
            checked, errors = module.check_workflows(path)
            self.assertEqual(checked, ['new-browser-workflow.yaml:new-job'])
            self.assertEqual(len(errors), 1)
            self.assertIn('ubuntu-latest', errors[0])

    def test_reverting_any_existing_browser_runner_is_rejected(self):
        source = ROOT / '.github/workflows'
        for file in source.glob('*.yml'):
            workflow = yaml.safe_load(file.read_text())
            for job_id, _ in module.browser_jobs(workflow):
                with self.subTest(workflow=file.name, job=job_id):
                    with tempfile.TemporaryDirectory() as directory:
                        target = Path(directory) / 'workflows'
                        shutil.copytree(source, target)
                        changed = yaml.safe_load(file.read_text())
                        changed['jobs'][job_id]['runs-on'] = 'ubuntu-latest'
                        (target / file.name).write_text(yaml.safe_dump(changed))
                        _, errors = module.check_workflows(target)
                        self.assertEqual(len(errors), 1)
                        self.assertIn(f'{file.name}:{job_id}', errors[0])

    def test_browser_commands_require_explicit_supported_runner(self):
        for command in ('npx playwright test', 'npm run test:e2e',
                        'pnpm exec playwright install-deps chromium'):
            for runner in ('ubuntu-latest', 'ubuntu-26.04', '${{ matrix.os }}', None):
                with self.subTest(command=command, runner=runner):
                    with tempfile.TemporaryDirectory() as directory:
                        path = Path(directory)
                        (path / 'browser.yml').write_text(yaml.safe_dump({
                            'jobs': {'browser': {
                                'runs-on': runner, 'steps': [{'run': command}],
                            }},
                        }))
                        _, errors = module.check_workflows(path)
                        self.assertEqual(len(errors), 1)

    def test_step_names_comments_and_artifact_paths_do_not_select_jobs(self):
        jobs = list(module.browser_jobs({'jobs': {'report': {
            'runs-on': 'ubuntu-latest',
            'steps': [
                {'name': 'Playwright report', 'uses': 'actions/upload-artifact@v4',
                 'with': {'path': 'playwright-report/'}},
                {'run': '# npx playwright test\necho done'},
            ],
        }}}))
        self.assertEqual(jobs, [])

    def test_empty_scan_cannot_pass(self):
        with tempfile.TemporaryDirectory() as directory:
            checked, errors = module.check_workflows(Path(directory))
            self.assertEqual(checked, [])
            self.assertEqual(len(errors), 1)


if __name__ == '__main__':
    unittest.main()
