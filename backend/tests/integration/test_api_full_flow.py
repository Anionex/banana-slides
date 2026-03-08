"""
API Full Flow Integration Test

This test validates the complete API flow without UI:
1. Create project from idea
2. Upload template image
3. Generate outline
4. Generate descriptions  
5. Generate images (using template)
6. Export PPT

Note: 
- This test requires REAL running backend service (not Flask test client)
- This test requires real AI API keys (GOOGLE_API_KEY)
- These tests should only run in the docker-test stage of CI
"""

import pytest
import requests
import time
import os
import io
import hashlib
from pathlib import Path
from PIL import Image


# Skip these tests if service is not running (for backend-integration-test stage)
pytestmark = pytest.mark.skipif(
    os.environ.get('SKIP_SERVICE_TESTS', '').lower() == 'true',
    reason="Skipping tests that require running backend service"
)


FAST_TEST_MODEL = os.environ.get("TEST_GEMINI_MODEL", "gemini-3.1-flash-image-preview")


def _compute_worktree_port(base_port: int) -> int:
    repo_root = Path(__file__).resolve().parents[3]
    basename = repo_root.name
    offset = int(hashlib.md5(basename.encode()).hexdigest()[:8], 16) % 500
    return base_port + offset


BASE_URL = os.environ.get("BACKEND_BASE_URL") or f"http://localhost:{os.environ.get('BACKEND_PORT') or _compute_worktree_port(5000)}"
API_TIMEOUT = 180  # 3 minutes timeout for AI operations


def configure_fast_test_models():
    """Pin the real-service integration test to a low-cost Gemini model."""
    response = requests.put(
        f"{BASE_URL}/api/settings",
        json={
            "text_model": FAST_TEST_MODEL,
            "image_model": FAST_TEST_MODEL,
            "image_caption_model": FAST_TEST_MODEL,
            "image_resolution": "1K",
            "max_description_workers": 1,
            "max_image_workers": 1,
            "enable_text_reasoning": False,
            "enable_image_reasoning": False,
        },
        timeout=30,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True


def wait_for_project_status(project_id: str, expected_status: str, timeout: int = 180):
    """Wait for project to reach expected status with smart retry."""
    start_time = time.time()
    check_interval = 2  # Start with 2 seconds
    max_interval = 10
    consecutive_errors = 0
    max_consecutive_errors = 3
    
    while time.time() - start_time < timeout:
        try:
            response = requests.get(f"{BASE_URL}/api/projects/{project_id}", timeout=10)
            
            if not response.ok:
                consecutive_errors += 1
                if consecutive_errors >= max_consecutive_errors:
                    raise Exception(f"Failed to get project status after {max_consecutive_errors} consecutive errors")
                time.sleep(check_interval * 2)
                continue
            
            consecutive_errors = 0
            data = response.json()
            current_status = data['data']['status']
            
            elapsed = int(time.time() - start_time)
            print(f"[{elapsed}s] Project status: {current_status}, waiting for: {expected_status}")
            
            if current_status == expected_status:
                print(f"✓ Project reached status: {expected_status} (took {elapsed}s)")
                return
            
            if current_status == 'FAILED':
                error_msg = data['data'].get('error', 'Unknown error')
                raise Exception(f"Project generation failed. Expected: {expected_status}, Got: {current_status}. Error: {error_msg}")
            
            # Adaptive interval
            elapsed_time = time.time() - start_time
            if elapsed_time > 30:
                check_interval = min(max_interval, check_interval + 1)
            
            time.sleep(check_interval)
            
        except Exception as e:
            if "Failed to get project status" in str(e) or "Project generation failed" in str(e):
                raise
            consecutive_errors += 1
            if consecutive_errors >= max_consecutive_errors:
                raise Exception(f"Network error: {str(e)}")
            time.sleep(check_interval * 2)
    
    raise Exception(f"Timeout: Project did not reach status {expected_status} within {timeout}s")


def wait_for_task_completion(project_id: str, task_id: str, timeout: int = 120):
    """Wait for task to complete with smart retry."""
    start_time = time.time()
    check_interval = 3
    max_interval = 10
    consecutive_errors = 0
    max_consecutive_errors = 3
    
    while time.time() - start_time < timeout:
        try:
            response = requests.get(
                f"{BASE_URL}/api/projects/{project_id}/tasks/{task_id}",
                timeout=10
            )
            
            if not response.ok:
                consecutive_errors += 1
                if consecutive_errors >= max_consecutive_errors:
                    raise Exception(f"Failed to get task status after {max_consecutive_errors} consecutive errors")
                time.sleep(check_interval * 2)
                continue
            
            consecutive_errors = 0
            data = response.json()
            task_status = data['data']['status']
            
            elapsed = int(time.time() - start_time)
            print(f"[{elapsed}s] Task {task_id[:8]}... status: {task_status}")
            
            if task_status == 'COMPLETED':
                print(f"✓ Task {task_id[:8]}... completed (took {elapsed}s)")
                return
            
            if task_status == 'FAILED':
                error_msg = data['data'].get('error_message', 'Unknown error')
                raise Exception(f"Task {task_id} failed: {error_msg}")
            
            # Adaptive interval
            elapsed_time = time.time() - start_time
            if elapsed_time > 60:
                check_interval = min(max_interval, check_interval + 1)
            
            time.sleep(check_interval)
            
        except Exception as e:
            if "Failed to get task status" in str(e) or "Task" in str(e) and "failed" in str(e):
                raise
            consecutive_errors += 1
            if consecutive_errors >= max_consecutive_errors:
                raise Exception(f"Network error: {str(e)}")
            time.sleep(check_interval * 2)
    
    raise Exception(f"Timeout: Task {task_id} did not complete within {timeout}s")


@pytest.fixture
def project_id():
    """Fixture that creates a project and cleans up after test."""
    created_project_ids = []
    
    def register_project(pid):
        created_project_ids.append(pid)
    
    yield register_project
    
    # Cleanup
    for pid in created_project_ids:
        try:
            requests.delete(f"{BASE_URL}/api/projects/{pid}", timeout=10)
            print(f"✓ Cleaned up project: {pid}")
        except Exception as e:
            print(f"Failed to cleanup project {pid}: {e}")


class TestAPIFullFlow:
    """API Integration Tests - Full workflow from creation to export.
    
    These tests require a running backend service and are designed to run
    in the docker-test stage of CI where services are started.
    """
    
    @pytest.mark.integration
    @pytest.mark.slow
    @pytest.mark.requires_service
    def test_api_full_flow_create_to_export(self, project_id):
        """
        Test complete API flow: Create project → Upload template → Outline → Descriptions → Images (with template) → Export PPT
        
        This test requires real AI API keys and takes 5-10 minutes to complete.
        """
        print('\n' + '=' * 40)
        print('🚀 Starting API full flow integration test')
        print('=' * 40 + '\n')

        print(f'⚙️  Using backend: {BASE_URL}')
        print(f'⚙️  Pinning test model: {FAST_TEST_MODEL}')
        configure_fast_test_models()
        
        # Step 1: Create project
        print('📝 Step 1: Creating project...')
        response = requests.post(
            f"{BASE_URL}/api/projects",
            json={
                'creation_type': 'idea',
                'idea_prompt': '严格只创建2页PPT，主题是人工智能基础入门。第1页讲什么是人工智能，第2页讲人工智能的典型应用。不要生成第3页及以上内容。'
            },
            timeout=30
        )
        
        assert response.status_code in [200, 201]  # 201 Created is also valid
        data = response.json()
        assert data['success'] is True
        assert 'project_id' in data['data']
        
        pid = data['data']['project_id']
        project_id(pid)  # Register for cleanup
        print(f"✓ Project created successfully: {pid}\n")
        
        # Step 1.5: Upload template image
        print('🖼️  Step 1.5: Uploading template image...')
        # Create a simple test template image
        template_img = Image.new('RGB', (1920, 1080), color='lightblue')
        img_bytes = io.BytesIO()
        template_img.save(img_bytes, format='PNG')
        img_bytes.seek(0)
        
        response = requests.post(
            f"{BASE_URL}/api/projects/{pid}/template",
            files={'template_image': ('template.png', img_bytes, 'image/png')},
            timeout=30
        )
        
        assert response.status_code in [200, 201]
        data = response.json()
        assert data['success'] is True
        print('✓ Template image uploaded successfully\n')
        
        # Step 2: Generate outline
        print('📋 Step 2: Triggering outline generation...')
        response = requests.post(
            f"{BASE_URL}/api/projects/{pid}/generate/outline",
            json={},
            timeout=30
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data['success'] is True
        print('✓ Outline generation request submitted\n')
        
        # Step 3: Wait for outline completion
        print('⏳ Step 3: Waiting for outline generation to complete...')
        wait_for_project_status(pid, 'OUTLINE_GENERATED', timeout=API_TIMEOUT)
        
        # Verify pages were created
        response = requests.get(f"{BASE_URL}/api/projects/{pid}", timeout=10)
        data = response.json()
        pages = data['data']['pages']
        
        assert pages is not None
        assert len(pages) >= 2
        print(f"✓ Outline generated successfully, contains {len(pages)} pages\n")
        
        # Step 4: Generate descriptions
        print('✍️  Step 4: Starting to generate page descriptions...')
        response = requests.post(
            f"{BASE_URL}/api/projects/{pid}/generate/descriptions",
            json={},
            timeout=30
        )
        
        assert response.status_code == 202  # 202 Accepted for async operations
        data = response.json()
        assert data['success'] is True
        
        desc_task_id = data['data']['task_id']
        print(f"  Task ID: {desc_task_id}")
        
        # Wait for description generation
        wait_for_task_completion(pid, desc_task_id, timeout=API_TIMEOUT)
        wait_for_project_status(pid, 'DESCRIPTIONS_GENERATED', timeout=10)
        print('✓ All page descriptions generated\n')
        
        # Step 5: Generate images
        print('🎨 Step 5: Starting to generate page images...')
        response = requests.post(
            f"{BASE_URL}/api/projects/{pid}/generate/images",
            json={
                'use_template': True,  # Use the uploaded template
                'max_workers': 1,
                'aspect_ratio': '16:9',
                'resolution': '1K'
            },
            timeout=30
        )
        
        assert response.status_code == 202  # 202 Accepted for async operations
        data = response.json()
        assert data['success'] is True
        
        image_task_id = data['data']['task_id']
        print(f"  Task ID: {image_task_id}")
        
        # Wait for image generation (slower, 5 minutes timeout)
        wait_for_task_completion(pid, image_task_id, timeout=300)
        wait_for_project_status(pid, 'COMPLETED', timeout=10)
        print('✓ All page images generated\n')
        
        # Verify all pages have images
        response = requests.get(f"{BASE_URL}/api/projects/{pid}", timeout=10)
        data = response.json()
        pages = data['data'].get('pages', [])
        
        assert len(pages) > 0
        
        for page in pages:
            assert page.get('generated_image_url') is not None
            assert page.get('status') == 'COMPLETED'
            print(f"  ✓ Page {page['order_index'] + 1}: Image generated")
        print()
        
        # Step 6: Export PPT
        print('📦 Step 6: Exporting PPT file...')
        response = requests.get(
            f"{BASE_URL}/api/projects/{pid}/export/pptx?filename=integration-test.pptx",
            timeout=60
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data['success'] is True
        assert 'download_url' in data['data']
        assert '.pptx' in data['data']['download_url']
        
        print(f"  Export URL: {data['data']['download_url']}")
        
        # Step 7: Verify PPT can be downloaded
        print('📥 Step 7: Verifying PPT file can be downloaded...')
        download_url = data['data']['download_url']
        response = requests.get(f"{BASE_URL}{download_url}", timeout=30)
        
        assert response.status_code == 200
        
        # Verify it's a PPTX file - check Content-Type or file extension
        content_type = response.headers.get('content-type', '').lower()
        is_pptx_content_type = (
            'application/vnd.openxmlformats-officedocument.presentationml.presentation' in content_type or
            'application/octet-stream' in content_type  # Flask may serve as octet-stream
        )
        is_pptx_filename = download_url.endswith('.pptx')
        
        assert is_pptx_content_type or is_pptx_filename, \
            f"Expected PPTX file, got Content-Type: {content_type}, URL: {download_url}"
        
        ppt_data = response.content
        assert len(ppt_data) > 1000  # PPT should be larger than 1KB
        
        print(f"✓ PPT file downloaded successfully, size: {len(ppt_data) / 1024:.2f} KB\n")
        
        print('=' * 40)
        print('✅ API integration test passed!')
        print('=' * 40 + '\n')
    
    @pytest.mark.integration
    @pytest.mark.requires_service
    def test_quick_api_flow_no_ai(self):
        """Quick test: Only verify API endpoints work (skip AI generation).
        
        This test requires a running backend service.
        """
        print('\n🏃 Quick API flow test (skip AI generation)\n')
        
        # Create project
        response = requests.post(
            f"{BASE_URL}/api/projects",
            json={
                'creation_type': 'idea',
                'idea_prompt': 'API test project'
            },
            timeout=30
        )
        
        assert response.status_code in [200, 201]  # 201 Created is also valid
        data = response.json()
        pid = data['data']['project_id']
        print(f"✓ Project created: {pid}")
        
        # Get project info
        response = requests.get(f"{BASE_URL}/api/projects/{pid}", timeout=10)
        assert response.status_code == 200
        print('✓ Project query successful')
        
        # List all projects
        response = requests.get(f"{BASE_URL}/api/projects", timeout=10)
        assert response.status_code == 200
        data = response.json()
        assert 'projects' in data['data']
        print(f"✓ Project list query successful, total {len(data['data']['projects'])} projects")
        
        # Delete project
        response = requests.delete(f"{BASE_URL}/api/projects/{pid}", timeout=10)
        assert response.status_code == 200
        print('✓ Project deleted successfully\n')
