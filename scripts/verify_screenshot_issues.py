#!/usr/bin/env python3
"""Run screenshot issue checks with isolated data, timeouts and service cleanup.

Usage: uv run python scripts/verify_screenshot_issues.py [--mode unit|browser|all]
"""
import argparse
import concurrent.futures
import json
import os
from pathlib import Path
import shutil
import signal
import socket
import subprocess
import sys
import tempfile
import time
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]


def port():
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        return sock.getsockname()[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--mode', choices=['unit', 'browser', 'all'], default='all')
    args = parser.parse_args()
    evidence = ROOT / 'output' / 'issue-verification'
    evidence.mkdir(parents=True, exist_ok=True)
    results, processes, handles = [], [], []
    def run(name, command, cwd=ROOT, env=None, timeout=300):
        with (evidence / f'{name}.log').open('w') as log:
            try:
                process = subprocess.Popen(command, cwd=cwd, env=env, stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
                try:
                    code = process.wait(timeout=timeout)
                except BaseException:
                    os.killpg(process.pid, signal.SIGTERM)
                    try: process.wait(timeout=5)
                    except subprocess.TimeoutExpired:
                        os.killpg(process.pid, signal.SIGKILL); process.wait(timeout=5)
                    raise
                item = {'check': name, 'status': 'passed' if code == 0 else 'failed', 'exit_code': code}
            except subprocess.TimeoutExpired:
                item = {'check': name, 'status': 'timeout'}
        results.append(item)
        print(json.dumps(item), flush=True)
        return item['status'] == 'passed'
    try:
        if args.mode in ('unit', 'all'):
            jobs = [
                ('backend', [sys.executable, '-m', 'pytest', 'backend/tests/unit/test_screenshot_issue_regressions.py', 'backend/tests/unit/test_mineru_path_utils.py', 'backend/tests/unit/test_ai_service_file_refs.py', '-q'], ROOT),
                ('frontend', ['npm', 'run', 'test:run', '--', '--minWorkers=1', '--maxWorkers=2'], ROOT / 'frontend'),
                ('lint', ['npm', 'run', 'lint'], ROOT / 'frontend'),
            ]
            with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
                if not all(pool.map(lambda job: run(*job), jobs)):
                    return 1
        if args.mode in ('browser', 'all'):
            if not run('build', ['npm', 'run', 'build:web'], ROOT / 'frontend'):
                return 1
            with tempfile.TemporaryDirectory(prefix='banana-issue-verification-') as temp:
                temp = Path(temp)
                shutil.copytree(ROOT / 'frontend/dist', temp / 'dist')
                backend_port, frontend_port = port(), port()
                env = {**os.environ, 'DATABASE_PATH': str(temp / 'test.db'), 'UPLOAD_FOLDER': str(temp / 'uploads'),
                       'BACKEND_PORT': str(backend_port), 'GOOGLE_API_KEY': 'fixture-only', 'FLASK_ENV': 'testing',
                       'BASE_URL': f'http://127.0.0.1:{frontend_port}', 'BACKEND_URL': f'http://127.0.0.1:{backend_port}', 'CI': '1', 'BANANA_ISSUE_FIXTURES': '1',
                       'PLAYWRIGHT_JSON_OUTPUT_NAME': str(evidence / 'browser-results.json')}
                for name, command, cwd in [
                    ('server', [sys.executable, 'scripts/verification/issue_fixture_server.py'], ROOT),
                    ('preview', ['npm', 'run', 'preview', '--', '--host', '127.0.0.1', '--port', str(frontend_port), '--strictPort', '--outDir', str(temp / 'dist')], ROOT / 'frontend'),
                ]:
                    log = (evidence / f'{name}.log').open('w'); handles.append(log)
                    processes.append(subprocess.Popen(command, cwd=cwd, env=env, stdout=log, stderr=log, start_new_session=True))
                for url in [env['BACKEND_URL'] + '/health', env['BASE_URL'] + '/api/settings']:
                    deadline = time.monotonic() + 45
                    while True:
                        try:
                            with urlopen(url, timeout=2) as response:
                                if response.status == 200: break
                        except Exception:
                            if any(proc.poll() is not None for proc in processes) or time.monotonic() > deadline: raise RuntimeError('Service readiness failed')
                            time.sleep(.3)
                if not run('browser', ['npx', 'playwright', 'test', 'e2e/screenshot-issues.spec.ts', '--reporter=list,json', '--workers=1'], ROOT / 'frontend', env):
                    return 1
                if not run('oauth-existing', ['npx', 'playwright', 'test', 'e2e/openai-oauth.spec.ts', '--grep', 'Mock tests', '--reporter=list', '--workers=1'], ROOT / 'frontend', env):
                    return 1
                stats = json.loads((evidence / 'browser-results.json').read_text())['stats']
                assert stats['expected'] > 0 and stats['unexpected'] == 0 and stats['skipped'] == 0, stats
        return 0
    finally:
        for proc in processes:
            if proc.poll() is None:
                os.killpg(proc.pid, signal.SIGTERM)
                try: proc.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    os.killpg(proc.pid, signal.SIGKILL); proc.wait(timeout=5)
        for handle in handles: handle.close()
        results.append({'check': 'cleanup', 'status': 'passed' if all(p.poll() is not None for p in processes) else 'failed'})
        (evidence / 'results.json').write_text(json.dumps(results, indent=2) + '\n')


if __name__ == '__main__':
    raise SystemExit(main())
