#!/usr/bin/env python3
"""Read-only verification of Banana Slides Docker releases and optional CI wait."""
import argparse
import concurrent.futures
import json
from pathlib import Path
import re
import subprocess
import sys
import time

IMAGES = ('banana-slides', 'banana-slides-backend', 'banana-slides-frontend')
PLATFORMS = {'linux/amd64', 'linux/arm64'}

def command_json(args, timeout=120):
    for attempt in range(3):
        try:
            result = subprocess.run(args, capture_output=True, text=True, timeout=timeout, check=True)
            return json.loads(result.stdout)
        except (subprocess.SubprocessError, json.JSONDecodeError):
            if attempt == 2:
                raise RuntimeError('Command failed after retries: ' + ' '.join(args[:5])) from None
            time.sleep(3 * (attempt + 1))

def inspect(ref, field):
    return command_json(['docker', 'buildx', 'imagetools', 'inspect', ref, '--format', '{{json .' + field + '}}'])

def verify_image(name, version, sha):
    ref = 'anoinex/' + name + ':' + version
    manifest = inspect(ref, 'Manifest')
    actual = {m['platform']['os'] + '/' + m['platform']['architecture'] for m in manifest['manifests']}
    assert PLATFORMS <= actual, f'{ref}: missing platforms: {PLATFORMS - actual}'
    provenance = inspect(ref, 'Provenance')
    evidence = {}
    short_sha = None
    for platform in sorted(PLATFORMS):
        slsa = provenance[platform]['SLSA']
        definition = slsa['buildDefinition']
        args = definition['externalParameters']['request']['args']
        assert args['build-arg:APP_COMMIT_SHA'] == sha, f'{ref} {platform}: source SHA mismatch'
        assert args['build-arg:APP_VERSION_TAG'] == version, f'{ref} {platform}: version mismatch'
        vcs = slsa['runDetails']['metadata']['buildkit_metadata']['vcs']
        assert vcs['revision'] == sha, f'{ref} {platform}: provenance VCS revision mismatch'
        short_sha = args['build-arg:APP_COMMIT_SHORT_SHA']
        assert sha.startswith(short_sha) and len(short_sha) >= 7
        evidence[platform] = {'sha': sha, 'version': version, 'dockerfile': definition['externalParameters']['configSource']['path'], 'digest': next(m['digest'] for m in manifest['manifests'] if m['platform'].get('os') + '/' + m['platform'].get('architecture') == platform)}
    alias = inspect('anoinex/' + name + ':sha-' + short_sha, 'Manifest')
    assert alias['digest'] == manifest['digest'], f'{ref}: SHA tag digest mismatch'
    return {'image': ref, 'digest': manifest['digest'], 'sha_tag': 'sha-' + short_sha, 'platforms': evidence}

def wait_run(run_id):
    deadline = time.monotonic() + 7500
    previous = None
    while time.monotonic() < deadline:
        run = command_json(['gh', 'run', 'view', str(run_id), '--repo', 'Anionex/banana-slides', '--json', 'status,conclusion,jobs'], timeout=45)
        state = {'status': run['status'], 'conclusion': run['conclusion'], 'active_steps': [step['name'] for job in run['jobs'] for step in job['steps'] if step['status'] == 'in_progress']}
        if state != previous:
            print(json.dumps(state), flush=True)
            previous = state
        if run['status'] == 'completed':
            assert run['conclusion'] == 'success', 'GitHub build did not succeed: ' + run['conclusion']
            return
        time.sleep(30)
    raise TimeoutError('Timed out waiting for release build')

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--version', required=True)
    parser.add_argument('--sha', required=True)
    parser.add_argument('--run-id', type=int)
    parser.add_argument('--target', choices=['allinone', 'split', 'both'], default='both')
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    if not re.fullmatch(r'[a-f0-9]{40}', args.sha) or not re.fullmatch(r'[a-zA-Z0-9][a-zA-Z0-9_.-]*', args.version):
        parser.error('Expected a full source SHA and a valid Docker tag')
    try:
        if args.run_id:
            wait_run(args.run_id)
        names = IMAGES[:1] if args.target == 'allinone' else IMAGES[1:] if args.target == 'split' else IMAGES
        with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
            futures = [pool.submit(verify_image, name, args.version, args.sha) for name in names]
            images = [future.result() for future in futures]
        result = {'status': 'verified', 'source_sha': args.sha, 'version': args.version, 'images': images}
        exit_code = 0
    except Exception as error:
        result = {'status': 'verification_failed', 'error': str(error), 'version': args.version}
        exit_code = 1
    args.output.write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps(result, indent=2), flush=True)
    return exit_code

if __name__ == '__main__':
    sys.exit(main())
