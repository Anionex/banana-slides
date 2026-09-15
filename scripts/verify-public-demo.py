#!/usr/bin/env python3
"""Real API acceptance for public-demo isolation and generation.

API credentials are read from standard input, never command-line arguments.
Run each provider separately; results contain no key or prompt/response body.
"""
import argparse
import json
import sys
import time
import uuid
from urllib.request import Request, urlopen
from urllib.error import HTTPError


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--base-url', default='http://localhost:5487')
    parser.add_argument('--partner', choices=['apimart', 'volcengine', 'inferera'], required=True)
    parser.add_argument('--image', action='store_true')
    parser.add_argument('--flow', action='store_true')
    parser.add_argument('--stream', action='store_true', help='Verify streaming outline and descriptions without image generation')
    parser.add_argument('--browser-tests', action='store_true', help='Run real concurrent settings tests in a browser, with credential cleanup')
    parser.add_argument('--tools-project', help='Existing test project with an image; read MinerU token on stdin line 2 and verify renovation/editable export')
    args = parser.parse_args()
    key = sys.stdin.readline().strip()
    if not key:
        raise ValueError('Credential required on standard input')
    if args.browser_tests:
        import os
        import subprocess
        from pathlib import Path
        env = dict(os.environ, CI='true', BASE_URL=args.base_url.replace(':5487', ':3487'),
                   PUBLIC_DEMO_LIVE_KEY=key, PUBLIC_DEMO_LIVE_PROVIDER=args.partner)
        result = subprocess.run(['npx', 'playwright', 'test', 'e2e/public-settings-live.spec.ts', '--reporter=list'],
                                cwd=Path(__file__).resolve().parents[1] / 'frontend', env=env, timeout=210,
                                stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
        print(result.stdout.replace(key, '[REDACTED]'))
        return result.returncode
    visitor = str(uuid.uuid4())
    mineru_token = sys.stdin.readline().strip() if args.tools_project else ''
    def call(path, data=None, method=None, token=visitor):
        body = json.dumps(data).encode() if data is not None else None
        req = Request(args.base_url + path, body, headers={'Content-Type': 'application/json', 'X-User-Token': token}, method=method or ('POST' if data is not None else 'GET'))
        try:
            with urlopen(req, timeout=180) as response:
                result = json.load(response)
                if not result.get('success', True):
                    raise RuntimeError('API returned an error: ' + str(result.get('error', {}).get('code', 'unknown')))
                return result.get('data', result)
        except HTTPError as e:
            raise RuntimeError(f'HTTP {e.code}: {path}') from None
    evidence = {'partner': args.partner, 'checks': {}}
    def task(name):
        started = call('/api/settings/tests/' + name, {})
        deadline = time.monotonic() + 300
        while time.monotonic() < deadline:
            status = call('/api/settings/tests/' + started['task_id'] + '/status')
            if status['status'] == 'FAILED':
                error = str(status.get('error', 'test failed')).replace(key, '[REDACTED]')
                raise RuntimeError(error[:700])
            if status['status'] == 'COMPLETED':
                return {'status': 'passed'}
            time.sleep(2)
        raise TimeoutError(name)
    try:
        saved = call('/api/settings', {'partner': args.partner, 'api_key': key}, 'PUT')
        assert saved['api_key_length'] == len(key)
        assert key not in json.dumps(saved)
        other = call('/api/settings', token=str(uuid.uuid4()))
        assert other['api_key_length'] == 0
        evidence['checks']['saved_key_isolation'] = 'passed'
        assert call('/api/settings/verify', {})['available'], 'Creation key verification failed'
        evidence['checks']['creation_key_verification'] = 'passed'
        evidence['checks']['text'] = task('text-model')
        evidence['checks']['caption'] = task('caption-model')
        if args.tools_project:
            import requests
            assert mineru_token, 'MinerU token required on standard input line 2'
            call('/api/settings', {'mineru_token': mineru_token}, 'PUT')
            source = call(f'/api/projects/{args.tools_project}')
            page_id = next(p['page_id'] for p in source['pages'] if p.get('generated_image_url'))
            exported = call(f'/api/projects/{args.tools_project}/export/pdf?page_ids={page_id}')
            with urlopen(args.base_url + exported['download_url'], timeout=60) as response:
                pdf = response.read()
            assert pdf.startswith(b'%PDF'), 'Invalid source PDF'
            response = requests.post(args.base_url + '/api/projects/renovation',
                                     headers={'X-User-Token': visitor},
                                     files={'file': ('acceptance.pdf', pdf, 'application/pdf')}, timeout=180)
            assert response.ok, f'Renovation returned HTTP {response.status_code}'
            renovation = response.json()['data']
            project_id = renovation['project_id']
            def wait_tool(task_id):
                deadline = time.monotonic() + 600
                while time.monotonic() < deadline:
                    state = call(f'/api/projects/{project_id}/tasks/{task_id}')
                    if state['status'] == 'COMPLETED':
                        return state
                    if state['status'] == 'FAILED':
                        raise RuntimeError(str(state.get('error_message', 'Tool task failed')))
                    time.sleep(2)
                raise TimeoutError('Document processing')
            wait_tool(renovation['task_id'])
            renovated = call(f'/api/projects/{project_id}')
            assert renovated['pages'][0]['description_content']['text']
            evidence['checks']['renovation'] = {'status': 'passed'}
            call(f'/api/projects/{project_id}', {'export_extractor_method': 'mineru', 'export_inpaint_method': 'generative'}, 'PUT')
            export_task = call(f'/api/projects/{project_id}/export/editable-pptx', {'max_depth': 1, 'max_workers': 1})
            completed = wait_tool(export_task['task_id'])
            download = completed['progress']['download_url']
            with urlopen(args.base_url + download, timeout=60) as response:
                assert response.read(2) == b'PK', 'Invalid PPTX archive'
            evidence['checks']['editable_export'] = {'status': 'passed', 'project_id': project_id}
        if args.image:
            evidence['checks']['image'] = task('image-model')
        if args.flow or args.stream:
            created = call('/api/projects', {'creation_type': 'idea', 'idea_prompt': '只制作一页 PPT。标题：公开版升级验收。三个要点：固定模型、个人密钥、链接分享。不要增加其他页面。', 'template_style': '纯白背景、黑色标题、简洁现代排版'})
            project_id = created['project_id']
            def stream(path):
                req = Request(args.base_url + path, b'{}', headers={'Content-Type': 'application/json', 'X-User-Token': visitor})
                event = ''
                done = None
                with urlopen(req, timeout=180) as response:
                    for raw in response:
                        line = raw.decode().strip()
                        if line.startswith('event: '):
                            event = line[7:]
                        elif line.startswith('data: '):
                            payload = json.loads(line[6:])
                            if event == 'error':
                                raise RuntimeError('Stream failed: ' + str(payload.get('message', 'unknown')))
                            if event == 'done':
                                done = payload
                assert done and done.get('pages'), 'Stream ended without completed pages'
                return done
            outline = stream(f'/api/projects/{project_id}/generate/outline/stream') if args.stream else call(f'/api/projects/{project_id}/generate/outline', {})
            assert outline['pages'], 'No outline pages'
            def await_project_task(task_id):
                deadline = time.monotonic() + 480
                while time.monotonic() < deadline:
                    state = call(f'/api/projects/{project_id}/tasks/{task_id}')
                    if state['status'] == 'COMPLETED':
                        return
                    if state['status'] == 'FAILED':
                        raise RuntimeError(str(state.get('error_message', 'generation failed'))[:500])
                    time.sleep(2)
                raise TimeoutError('project generation')
            if args.stream:
                streamed = stream(f'/api/projects/{project_id}/generate/descriptions/stream')
                assert all(p['description_content']['text'] for p in streamed['pages'])
                evidence['checks']['streaming_generation'] = {'status': 'passed', 'project_id': project_id}
            else:
                descriptions = call(f'/api/projects/{project_id}/generate/descriptions', {'max_workers': 1})
                await_project_task(descriptions['task_id'])
            if args.flow:
                page_id = outline['pages'][0]['page_id']
                images = call(f'/api/projects/{project_id}/generate/images', {'max_workers': 1, 'use_template': False, 'page_ids': [page_id]})
                await_project_task(images['task_id'])
                pptx = call(f'/api/projects/{project_id}/export/pptx?page_ids=' + page_id)
                assert pptx.get('download_url'), 'No PPTX download'
                project = call(f'/api/projects/{project_id}', token=str(uuid.uuid4()))
                assert project['pages'][0]['generated_image_url']
                evidence['checks']['project_flow'] = {'status': 'passed', 'project_id': project_id, 'preview_url': args.base_url.replace(':5487', ':3487') + f'/project/{project_id}/preview', 'pptx_download': True}
        evidence['status'] = 'passed'
    except Exception as e:
        evidence['status'] = 'failed'
        message = str(e).replace(key, '[REDACTED]')
        if mineru_token:
            message = message.replace(mineru_token, '[REDACTED]')
        evidence['error'] = message[:700]
    finally:
        call('/api/settings/reset', {})
        evidence['credentials_cleared'] = call('/api/settings')['api_key_length'] == 0
    print(json.dumps(evidence, ensure_ascii=False, indent=2))
    return 0 if evidence['status'] == 'passed' else 1


if __name__ == '__main__':
    sys.exit(main())
