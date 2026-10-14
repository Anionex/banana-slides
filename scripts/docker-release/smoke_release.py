#!/usr/bin/env python3
"""Smoke-test verified Docker artifacts in disposable containers without user data."""
import argparse
import json
from pathlib import Path
import platform
import re
import shutil
import subprocess
import sys
import time
import urllib.request
import uuid

ROOT = Path(__file__).resolve().parent
PLATFORM = 'linux/arm64' if platform.machine() in ('arm64', 'aarch64') else 'linux/amd64'

def run(*args, timeout=60, check=True):
    result = subprocess.run(args, capture_output=True, text=True, timeout=timeout)
    if check and result.returncode:
        raise RuntimeError(' '.join(args[:3]) + ': ' + result.stderr[-1200:])
    return result

def get(url, as_json=True):
    with urllib.request.urlopen(url, timeout=8) as response:
        data = response.read().decode()
    return json.loads(data) if as_json else data

def wait_health(url):
    deadline = time.monotonic() + 180
    while time.monotonic() < deadline:
        try:
            data = get(url)
            if data.get('status') == 'ok':
                return data
        except Exception:
            pass
        time.sleep(3)
    raise TimeoutError('Health check timed out: ' + url)

def port(name, internal):
    info = json.loads(run('docker', 'inspect', name).stdout)[0]
    return 'http://127.0.0.1:' + info['NetworkSettings']['Ports'][str(internal) + '/tcp'][0]['HostPort']

def verify_web(base, version, sha):
    html = get(base + '/', False)
    assert '<div id="root">' in html, 'Missing frontend root element'
    scripts = re.findall(r'<script[^>]+src="([^"]+)"', html)
    assert scripts, 'Missing frontend entry script'
    bundles = ''.join(get(base + '/' + src.lstrip('./'), False) for src in scripts)
    assert sha in bundles and version in bundles, 'Frontend build metadata mismatch'
    projects = get(base + '/api/projects')
    assert projects.get('success') is True, 'Projects API failed: ' + str(projects)
    return {'root': True, 'assets': True, 'version_metadata': True, 'projects_api': True}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--version', required=True)
    parser.add_argument('--target', choices=['allinone', 'split', 'both'], default='both')
    args = parser.parse_args()
    verification_file = 'verification-allinone.json' if args.target == 'allinone' else 'verification.json'
    verified = json.loads((ROOT / verification_file).read_text())
    assert verified['status'] == 'verified' and verified['version'] == args.version
    assert shutil.disk_usage(ROOT).free > 6 * 1024 ** 3, 'Insufficient free disk space for disposable image tests'
    prefix = 'banana-rc-smoke-' + uuid.uuid4().hex[:8]
    containers, pulled = [], []
    network_created = False
    report = {'version': args.version, 'source_sha': verified['source_sha'], 'platform': PLATFORM, 'checks': {}}
    def pull(image):
        ref = image['image'].split(':')[0] + '@' + image['digest']
        existed = run('docker', 'image', 'inspect', ref, check=False).returncode == 0
        print('Pulling ' + image['image'], flush=True)
        run('docker', 'pull', '--platform', PLATFORM, ref, timeout=900)
        if not existed:
            pulled.append(ref)
        return ref
    def start(name, ref, internal, alias=None):
        command = ['docker', 'run', '-d', '--name', name, '--network', prefix, '--platform', PLATFORM, '-p', f'127.0.0.1::{internal}', '-e', 'SECRET_KEY=disposable-release-smoke-test']
        if alias:
            command += ['--network-alias', alias]
        containers.append(name)
        run(*command, ref)
        return port(name, internal)
    def metadata(name):
        info = json.loads(run('docker', 'inspect', name).stdout)[0]
        env = dict(item.split('=', 1) for item in info['Config']['Env'])
        assert env['APP_COMMIT_SHA'] == verified['source_sha']
        assert env['APP_VERSION_TAG'] == args.version
    try:
        run('docker', 'network', 'create', prefix)
        network_created = True
        images = {image['image'].split(':')[0].split('/')[-1]: image for image in verified['images']}
        if args.target != 'split':
            app_name = prefix + '-app'
            base = start(app_name, pull(images['banana-slides']), 80)
            wait_health(base + '/health')
            metadata(app_name)
            report['checks']['allinone'] = verify_web(base, args.version, verified['source_sha'])
            run('docker', 'rm', '-f', app_name)
            containers.remove(app_name)
            # Release this task's image before pulling the second backend variant.
            if pulled:
                run('docker', 'image', 'rm', pulled[0])
                pulled.pop(0)
        if args.target != 'allinone':
            backend_name = prefix + '-backend'
            base = start(backend_name, pull(images['banana-slides-backend']), 5000, 'backend')
            wait_health(base + '/health')
            metadata(backend_name)
            frontend_name = prefix + '-frontend'
            base = start(frontend_name, pull(images['banana-slides-frontend']), 80)
            deadline = time.monotonic() + 30
            while True:
                try:
                    report['checks']['split'] = verify_web(base, args.version, verified['source_sha'])
                    break
                except (OSError, urllib.error.URLError):
                    if time.monotonic() >= deadline:
                        raise
                    time.sleep(1)
        report['status'] = 'passed'
    except Exception as error:
        report['status'] = 'failed'
        report['error'] = str(error)
        for name in containers:
            logs = run('docker', 'logs', '--tail', '100', name, check=False)
            (ROOT / (name + '.log')).write_text(logs.stdout + logs.stderr)
    finally:
        errors = []
        for name in reversed(containers):
            if run('docker', 'rm', '-f', name, check=False).returncode:
                errors.append(name)
        if network_created and run('docker', 'network', 'rm', prefix, check=False).returncode:
            errors.append(prefix)
        for ref in pulled:
            if run('docker', 'image', 'rm', ref, check=False).returncode:
                errors.append(ref)
        report['cleanup'] = 'passed' if not errors else errors
        if errors:
            report['status'] = 'cleanup_failed'
    (ROOT / ('smoke-' + args.target + '.json')).write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report, indent=2), flush=True)
    return 0 if report['status'] == 'passed' else 1

if __name__ == '__main__':
    sys.exit(main())
