#!/usr/bin/env python
"""
Banana Slides - API Testing Script
===================================
Script tự động test tất cả API endpoints của Banana Slides.

Cách sử dụng:
    # Chạy tất cả tests
    python tests/test_api_manual.py

    # Chạy với base URL khác
    python tests/test_api_manual.py --base-url http://192.168.1.100:5000

    # Chỉ test health check và settings
    python tests/test_api_manual.py --quick

    # Verbose mode
    python tests/test_api_manual.py -v
"""

import argparse
import json
import sys
import time
from dataclasses import dataclass
from typing import Any
from pathlib import Path

try:
    import requests
except ImportError:
    print("ERROR: Package 'requests' chưa được cài đặt.")
    print("Chạy: pip install requests")
    sys.exit(1)


# =============================================================================
# Configuration
# =============================================================================

DEFAULT_BASE_URL = "http://localhost:5000"
REQUEST_TIMEOUT = 30  # seconds


@dataclass
class TestResult:
    """Result of a single test"""
    name: str
    passed: bool
    message: str
    response_time: float = 0.0
    details: dict = None


class Colors:
    """ANSI color codes for terminal output"""
    GREEN = "\033[92m"
    RED = "\033[91m"
    YELLOW = "\033[93m"
    BLUE = "\033[94m"
    CYAN = "\033[96m"
    RESET = "\033[0m"
    BOLD = "\033[1m"


def colored(text: str, color: str) -> str:
    """Apply color to text"""
    return f"{color}{text}{Colors.RESET}"


# =============================================================================
# API Test Client
# =============================================================================

class BananaSlidesTestClient:
    """Test client for Banana Slides API"""

    def __init__(self, base_url: str = DEFAULT_BASE_URL, verbose: bool = False):
        self.base_url = base_url.rstrip("/")
        self.verbose = verbose
        self.results: list[TestResult] = []
        self.test_project_id: str | None = None
        self.test_page_id: str | None = None

    def log(self, message: str):
        """Log message if verbose mode is enabled"""
        if self.verbose:
            print(f"  {colored('[DEBUG]', Colors.CYAN)} {message}")

    def request(
        self,
        method: str,
        endpoint: str,
        json_data: dict = None,
        files: dict = None,
        expected_status: int = 200
    ) -> tuple[bool, Any, float]:
        """
        Make HTTP request and return (success, response_data, response_time)
        """
        url = f"{self.base_url}{endpoint}"
        start_time = time.time()

        try:
            if method.upper() == "GET":
                resp = requests.get(url, timeout=REQUEST_TIMEOUT)
            elif method.upper() == "POST":
                if files:
                    resp = requests.post(url, files=files, timeout=REQUEST_TIMEOUT)
                else:
                    resp = requests.post(url, json=json_data, timeout=REQUEST_TIMEOUT)
            elif method.upper() == "PUT":
                resp = requests.put(url, json=json_data, timeout=REQUEST_TIMEOUT)
            elif method.upper() == "DELETE":
                resp = requests.delete(url, timeout=REQUEST_TIMEOUT)
            else:
                return False, {"error": f"Unknown method: {method}"}, 0.0

            elapsed = time.time() - start_time

            self.log(f"{method} {endpoint} -> {resp.status_code} ({elapsed:.2f}s)")

            if resp.status_code != expected_status:
                return False, {
                    "error": f"Expected status {expected_status}, got {resp.status_code}",
                    "body": resp.text[:500]
                }, elapsed

            try:
                data = resp.json()
            except json.JSONDecodeError:
                data = {"raw": resp.text[:500]}

            return True, data, elapsed

        except requests.exceptions.ConnectionError:
            return False, {"error": "Connection refused - Is the server running?"}, 0.0
        except requests.exceptions.Timeout:
            return False, {"error": f"Request timeout after {REQUEST_TIMEOUT}s"}, REQUEST_TIMEOUT
        except Exception as e:
            return False, {"error": str(e)}, 0.0

    def add_result(self, name: str, passed: bool, message: str,
                   response_time: float = 0.0, details: dict = None):
        """Add test result"""
        self.results.append(TestResult(
            name=name,
            passed=passed,
            message=message,
            response_time=response_time,
            details=details
        ))

        # Print result immediately
        status = colored("PASS", Colors.GREEN) if passed else colored("FAIL", Colors.RED)
        time_str = f" ({response_time:.2f}s)" if response_time > 0 else ""
        print(f"  [{status}] {name}{time_str}")
        if not passed and details:
            print(f"         Error: {details.get('error', message)}")

    # -------------------------------------------------------------------------
    # Health & Basic Tests
    # -------------------------------------------------------------------------

    def test_health_check(self):
        """Test GET /health"""
        success, data, elapsed = self.request("GET", "/health")

        if success and data.get("status") == "ok":
            self.add_result(
                "Health Check",
                True,
                "API is running",
                elapsed
            )
        else:
            self.add_result(
                "Health Check",
                False,
                "Health check failed",
                elapsed,
                data
            )

    def test_root_endpoint(self):
        """Test GET /"""
        success, data, elapsed = self.request("GET", "/")

        if success and "name" in data and data["name"] == "Banana Slides API":
            self.add_result(
                "Root Endpoint",
                True,
                "Root endpoint working",
                elapsed
            )
        else:
            self.add_result(
                "Root Endpoint",
                False,
                "Root endpoint failed",
                elapsed,
                data
            )

    # -------------------------------------------------------------------------
    # Settings API Tests
    # -------------------------------------------------------------------------

    def test_get_settings(self):
        """Test GET /api/settings"""
        success, data, elapsed = self.request("GET", "/api/settings")

        if success and "data" in data:
            settings = data.get("data", {})
            has_required = all(k in settings for k in [
                "ai_provider_format",
                "image_resolution",
                "max_image_workers"
            ])

            if has_required:
                self.add_result(
                    "Get Settings",
                    True,
                    f"Provider: {settings.get('ai_provider_format')}",
                    elapsed
                )
                return settings

        self.add_result(
            "Get Settings",
            False,
            "Missing required settings fields",
            elapsed,
            data
        )
        return None

    def test_update_settings(self):
        """Test PUT /api/settings"""
        # Get current settings first
        success, current, _ = self.request("GET", "/api/settings")
        if not success:
            self.add_result(
                "Update Settings",
                False,
                "Could not get current settings",
                details=current
            )
            return

        # Update output language
        update_data = {
            "output_language": "vi"
        }

        success, data, elapsed = self.request("PUT", "/api/settings", update_data)

        if success and data.get("data", {}).get("output_language") == "vi":
            self.add_result(
                "Update Settings",
                True,
                "Settings updated successfully",
                elapsed
            )

            # Restore original
            original_lang = current.get("data", {}).get("output_language", "zh")
            self.request("PUT", "/api/settings", {"output_language": original_lang})
        else:
            self.add_result(
                "Update Settings",
                False,
                "Failed to update settings",
                elapsed,
                data
            )

    def test_get_output_language(self):
        """Test GET /api/output-language"""
        success, data, elapsed = self.request("GET", "/api/output-language")

        if success and "data" in data and "language" in data["data"]:
            self.add_result(
                "Get Output Language",
                True,
                f"Language: {data['data']['language']}",
                elapsed
            )
        else:
            self.add_result(
                "Get Output Language",
                False,
                "Failed to get output language",
                elapsed,
                data
            )

    # -------------------------------------------------------------------------
    # Projects API Tests
    # -------------------------------------------------------------------------

    def test_list_projects(self):
        """Test GET /api/projects"""
        success, data, elapsed = self.request("GET", "/api/projects")

        if success and "data" in data:
            projects = data.get("data", [])
            self.add_result(
                "List Projects",
                True,
                f"Found {len(projects)} projects",
                elapsed
            )
        else:
            self.add_result(
                "List Projects",
                False,
                "Failed to list projects",
                elapsed,
                data
            )

    def test_create_project(self):
        """Test POST /api/projects"""
        project_data = {
            "creation_type": "idea",
            "idea_prompt": "Test project for API testing - can be deleted"
        }

        success, data, elapsed = self.request("POST", "/api/projects", project_data, expected_status=201)

        if success and "data" in data and "project_id" in data["data"]:
            self.test_project_id = data["data"]["project_id"]
            self.add_result(
                "Create Project",
                True,
                f"Created project: {self.test_project_id[:8]}...",
                elapsed
            )
        else:
            self.add_result(
                "Create Project",
                False,
                "Failed to create project",
                elapsed,
                data
            )

    def test_get_project(self):
        """Test GET /api/projects/{id}"""
        if not self.test_project_id:
            self.add_result(
                "Get Project",
                False,
                "No test project available"
            )
            return

        success, data, elapsed = self.request(
            "GET", f"/api/projects/{self.test_project_id}"
        )

        if success and "data" in data:
            project = data["data"]
            # Store first page ID if available
            pages = project.get("pages", [])
            if pages:
                self.test_page_id = pages[0].get("id")

            self.add_result(
                "Get Project",
                True,
                f"Project has {len(pages)} pages",
                elapsed
            )
        else:
            self.add_result(
                "Get Project",
                False,
                "Failed to get project",
                elapsed,
                data
            )

    def test_update_project(self):
        """Test PUT /api/projects/{id}"""
        if not self.test_project_id:
            self.add_result(
                "Update Project",
                False,
                "No test project available"
            )
            return

        update_data = {
            "title": "[TEST] Updated API Test Project"
        }

        success, data, elapsed = self.request(
            "PUT",
            f"/api/projects/{self.test_project_id}",
            update_data
        )

        if success:
            self.add_result(
                "Update Project",
                True,
                "Project updated successfully",
                elapsed
            )
        else:
            self.add_result(
                "Update Project",
                False,
                "Failed to update project",
                elapsed,
                data
            )

    def test_delete_project(self):
        """Test DELETE /api/projects/{id}"""
        if not self.test_project_id:
            self.add_result(
                "Delete Project",
                False,
                "No test project available"
            )
            return

        success, data, elapsed = self.request(
            "DELETE",
            f"/api/projects/{self.test_project_id}"
        )

        if success:
            self.add_result(
                "Delete Project",
                True,
                "Project deleted successfully",
                elapsed
            )
            self.test_project_id = None
        else:
            self.add_result(
                "Delete Project",
                False,
                "Failed to delete project",
                elapsed,
                data
            )

    # -------------------------------------------------------------------------
    # Templates API Tests
    # -------------------------------------------------------------------------

    def test_list_system_templates(self):
        """Test GET /api/projects/templates"""
        success, data, elapsed = self.request("GET", "/api/projects/templates")

        if success and "data" in data:
            templates = data.get("data", [])
            self.add_result(
                "List System Templates",
                True,
                f"Found {len(templates)} system templates",
                elapsed
            )
        else:
            self.add_result(
                "List System Templates",
                False,
                "Failed to list templates",
                elapsed,
                data
            )

    def test_list_user_templates(self):
        """Test GET /api/user-templates"""
        success, data, elapsed = self.request("GET", "/api/user-templates")

        if success and "data" in data:
            templates = data.get("data", [])
            self.add_result(
                "List User Templates",
                True,
                f"Found {len(templates)} user templates",
                elapsed
            )
        else:
            self.add_result(
                "List User Templates",
                False,
                "Failed to list user templates",
                elapsed,
                data
            )

    # -------------------------------------------------------------------------
    # Materials API Tests
    # -------------------------------------------------------------------------

    def test_list_materials(self):
        """Test GET /api/materials"""
        success, data, elapsed = self.request("GET", "/api/materials")

        if success and "data" in data:
            materials = data.get("data", [])
            self.add_result(
                "List Global Materials",
                True,
                f"Found {len(materials)} materials",
                elapsed
            )
        else:
            self.add_result(
                "List Global Materials",
                False,
                "Failed to list materials",
                elapsed,
                data
            )

    # -------------------------------------------------------------------------
    # Run Tests
    # -------------------------------------------------------------------------

    def run_quick_tests(self):
        """Run quick tests (health check and settings only)"""
        print(colored("\n=== Quick Tests ===\n", Colors.BOLD))

        self.test_health_check()
        self.test_root_endpoint()
        self.test_get_settings()
        self.test_get_output_language()

    def run_all_tests(self):
        """Run all API tests"""
        print(colored("\n=== Health & Basic ===\n", Colors.BOLD))
        self.test_health_check()
        self.test_root_endpoint()

        print(colored("\n=== Settings API ===\n", Colors.BOLD))
        self.test_get_settings()
        self.test_update_settings()
        self.test_get_output_language()

        print(colored("\n=== Projects API ===\n", Colors.BOLD))
        self.test_list_projects()
        self.test_create_project()
        self.test_get_project()
        self.test_update_project()

        print(colored("\n=== Templates API ===\n", Colors.BOLD))
        self.test_list_system_templates()
        self.test_list_user_templates()

        print(colored("\n=== Materials API ===\n", Colors.BOLD))
        self.test_list_materials()

        print(colored("\n=== Cleanup ===\n", Colors.BOLD))
        self.test_delete_project()

    def print_summary(self):
        """Print test summary"""
        total = len(self.results)
        passed = sum(1 for r in self.results if r.passed)
        failed = total - passed

        print(colored("\n" + "=" * 60, Colors.BOLD))
        print(colored("TEST SUMMARY", Colors.BOLD))
        print("=" * 60)

        print(f"\nTotal Tests:  {total}")
        print(f"Passed:       {colored(str(passed), Colors.GREEN)}")
        print(f"Failed:       {colored(str(failed), Colors.RED) if failed > 0 else '0'}")

        total_time = sum(r.response_time for r in self.results)
        print(f"Total Time:   {total_time:.2f}s")

        if failed > 0:
            print(colored("\nFailed Tests:", Colors.RED))
            for r in self.results:
                if not r.passed:
                    print(f"  - {r.name}: {r.message}")

        print()

        return failed == 0


# =============================================================================
# Main
# =============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="Banana Slides API Testing Script"
    )
    parser.add_argument(
        "--base-url",
        default=DEFAULT_BASE_URL,
        help=f"Base URL of the API (default: {DEFAULT_BASE_URL})"
    )
    parser.add_argument(
        "--quick", "-q",
        action="store_true",
        help="Run quick tests only (health check and settings)"
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Enable verbose output"
    )

    args = parser.parse_args()

    print(colored("\n" + "=" * 60, Colors.BOLD))
    print(colored("  BANANA SLIDES API TEST SUITE", Colors.YELLOW))
    print(colored("=" * 60, Colors.BOLD))
    print(f"\nTarget: {colored(args.base_url, Colors.CYAN)}")
    print(f"Mode:   {colored('Quick' if args.quick else 'Full', Colors.CYAN)}")

    client = BananaSlidesTestClient(
        base_url=args.base_url,
        verbose=args.verbose
    )

    try:
        if args.quick:
            client.run_quick_tests()
        else:
            client.run_all_tests()
    except KeyboardInterrupt:
        print(colored("\n\nTest interrupted by user", Colors.YELLOW))

    success = client.print_summary()

    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
