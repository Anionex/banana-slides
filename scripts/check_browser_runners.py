#!/usr/bin/env python3
"""Require the tested runner for browser jobs in every GitHub workflow.

Usage: python scripts/check_browser_runners.py [workflow-directory]
Requires PyYAML==6.0.3. Update the policy together with Playwright/OS validation.
Dynamic runners fail closed: browser jobs must explicitly select the tested OS.
"""

from pathlib import Path
import re
import sys

import yaml


BROWSER_RUNNER = 'ubuntu-24.04'
BROWSER_COMMAND = re.compile(r'\bplaywright\b|\btest:e2e\b')


def browser_jobs(workflow):
    for job_id, job in workflow.get('jobs', {}).items():
        # Inspect commands, not job/step names or artifact paths. Include npm
        # test:e2e aliases as well as direct Playwright install/test invocations.
        commands = '\n'.join(
            line for step in job.get('steps', [])
            for line in step.get('run', '').splitlines()
            if not line.lstrip().startswith('#')
        )
        if BROWSER_COMMAND.search(commands):
            yield job_id, job.get('runs-on')


def check_workflows(directory):
    checked = []
    errors = []
    files = sorted(set(directory.glob('*.yml')) | set(directory.glob('*.yaml')))
    for file in files:
        workflow = yaml.safe_load(file.read_text())
        for job_id, runner in browser_jobs(workflow):
            label = f'{file.name}:{job_id}'
            checked.append(label)
            if runner != BROWSER_RUNNER:
                errors.append(
                    f'{label}: runs-on must be {BROWSER_RUNNER!r} '
                    f'for the locked Playwright version; got {runner!r}'
                )
    if not checked:
        errors.append(f'No browser jobs found in {directory}; check the scan path.')
    return checked, errors


def main():
    directory = (Path(sys.argv[1]) if len(sys.argv) > 1 else
                 Path(__file__).resolve().parents[1] / '.github/workflows')
    checked, errors = check_workflows(directory)
    for label in checked:
        print(f'Checked {label}')
    for error in errors:
        print(error, file=sys.stderr)
    return 1 if errors else 0


if __name__ == '__main__':
    sys.exit(main())
