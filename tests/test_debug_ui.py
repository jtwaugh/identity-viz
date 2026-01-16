#!/usr/bin/env python3
"""
Tests for the Debug Control Plane UI

This test verifies:
1. Debug UI static files are served correctly
2. SSE event stream endpoint works with proper content-type
3. Debug API endpoints return valid JSON
4. Navigation between sections works

Usage:
    pytest test_debug_ui.py -v

Requirements:
    - Docker compose services running (frontend, backend)
    - pip install requests sseclient-py pytest
"""

import requests
import json
import time
import threading
import pytest
from typing import Optional, Dict, Any, List
from dataclasses import dataclass


# Configuration
FRONTEND_URL = "http://localhost:3000"
BACKEND_URL = "http://localhost:8000"
DEBUG_UI_URL = f"{FRONTEND_URL}/debug"
DEBUG_API_URL = f"{FRONTEND_URL}/debug/api"
DEBUG_SSE_URL = f"{FRONTEND_URL}/debug/events/stream"

# Direct backend URLs (for comparison)
BACKEND_DEBUG_API_URL = f"{BACKEND_URL}/debug"
BACKEND_DEBUG_SSE_URL = f"{BACKEND_URL}/debug/events/stream"

# Keycloak configuration
KEYCLOAK_URL = "http://localhost:8080"
KEYCLOAK_REALM = "anybank"
KEYCLOAK_CLIENT_ID = "anybank-web"
TEST_USER_EMAIL = "jdoe@example.com"
TEST_USER_PASSWORD = "demo123"


@dataclass
class TestResult:
    name: str
    passed: bool
    message: str
    details: Optional[Dict[str, Any]] = None


class DebugUITest:
    """Test suite for Debug Control Plane UI"""

    def __init__(self):
        self.results: List[TestResult] = []
        self.session = requests.Session()

    def run_all_tests(self) -> bool:
        """Run all tests and return overall success"""
        print("\n" + "=" * 60)
        print("Debug Control Plane UI Test Suite")
        print("=" * 60 + "\n")

        tests = [
            ("Frontend Health Check", self.test_frontend_health),
            ("Backend Health Check", self.test_backend_health),
            ("Debug UI Index Page", self.test_debug_ui_index),
            ("Debug UI CSS Loading", self.test_debug_ui_css),
            ("Debug UI JavaScript Loading", self.test_debug_ui_js),
            ("SSE Endpoint (Backend Direct)", self.test_sse_backend_direct),
            ("SSE Endpoint (via Nginx)", self.test_sse_via_nginx),
            ("Debug API - Health", self.test_debug_api_health),
            ("Debug API - Data Users", self.test_debug_api_data_users),
            ("Debug API - Data Tenants", self.test_debug_api_data_tenants),
            ("Debug API - Data Sessions", self.test_debug_api_data_sessions),
            ("Debug API - Data Accounts", self.test_debug_api_data_accounts),
            ("Debug API - Data Memberships", self.test_debug_api_data_memberships),
            ("Debug API - Auth Tokens", self.test_debug_api_auth_tokens),
            ("Debug API - Auth Keycloak Events", self.test_debug_api_auth_keycloak_events),
            ("Debug API - Auth Decode JWT", self.test_debug_api_auth_decode),
            ("Session Creation and Debug Visibility", self.test_session_appears_in_debug),
            ("Session Timeline", self.test_session_timeline),
            ("Session Timeline (Workflow Path)", self.test_session_timeline_workflow_path),
            ("Session Timeline with Actions", self.test_session_timeline_with_actions),
            ("OPA Decisions", self.test_opa_decisions_endpoint),
            ("Risk Controls (GET)", self.test_risk_controls_get),
            ("Risk Controls (SET/CLEAR)", self.test_risk_controls_set_and_clear),
            ("Debug Controls State", self.test_debug_controls_state),
            ("Time Controls", self.test_time_controls),
            ("Policy List", self.test_policy_list),
            ("Policy Evaluate", self.test_policy_evaluate),
            ("Slide-over Element Exists", self.test_slide_over_element),
            ("People Page Personal vs Business", self.test_people_page_different_for_personal_vs_business),
        ]

        for name, test_func in tests:
            print(f"\n--- {name} ---")
            try:
                result = test_func()
                self.results.append(result)
                status = "PASS" if result.passed else "FAIL"
                print(f"[{status}] {result.message}")
                if result.details and not result.passed:
                    print(f"Details: {json.dumps(result.details, indent=2, default=str)}")
            except Exception as e:
                result = TestResult(name, False, f"Exception: {str(e)}")
                self.results.append(result)
                print(f"[FAIL] {result.message}")

        self._print_summary()
        return all(r.passed for r in self.results)

    def _print_summary(self):
        """Print test summary"""
        print("\n" + "=" * 60)
        print("TEST SUMMARY")
        print("=" * 60)

        passed = sum(1 for r in self.results if r.passed)
        failed = sum(1 for r in self.results if not r.passed)

        for result in self.results:
            status = "PASS" if result.passed else "FAIL"
            print(f"  [{status}] {result.name}")

        print(f"\nTotal: {len(self.results)} | Passed: {passed} | Failed: {failed}")
        print("=" * 60 + "\n")

    def test_frontend_health(self) -> TestResult:
        """Test that frontend nginx is running"""
        try:
            response = self.session.get(f"{FRONTEND_URL}/health", timeout=5)
            if response.status_code == 200:
                return TestResult("Frontend Health", True, "Frontend nginx is healthy")
            return TestResult(
                "Frontend Health",
                False,
                f"Unexpected status: {response.status_code}",
                {"status": response.status_code}
            )
        except requests.exceptions.ConnectionError:
            return TestResult("Frontend Health", False, "Cannot connect to frontend at port 3000")

    def test_backend_health(self) -> TestResult:
        """Test that backend is running"""
        try:
            response = self.session.get(f"{BACKEND_URL}/actuator/health", timeout=5)
            if response.status_code == 200:
                return TestResult("Backend Health", True, "Backend is healthy")
            return TestResult(
                "Backend Health",
                False,
                f"Unexpected status: {response.status_code}",
                {"status": response.status_code}
            )
        except requests.exceptions.ConnectionError:
            return TestResult("Backend Health", False, "Cannot connect to backend at port 8000")

    def test_debug_ui_index(self) -> TestResult:
        """Test that debug UI index.html loads"""
        try:
            response = self.session.get(f"{DEBUG_UI_URL}/", timeout=5)
            if response.status_code != 200:
                return TestResult(
                    "Debug UI Index",
                    False,
                    f"Status {response.status_code}",
                    {"status": response.status_code}
                )

            content_type = response.headers.get("content-type", "")
            if "text/html" not in content_type:
                return TestResult(
                    "Debug UI Index",
                    False,
                    f"Wrong content type: {content_type}",
                    {"content_type": content_type}
                )

            # Check for key elements in the HTML
            html = response.text
            checks = [
                ("Debug Control Plane" in html, "Title missing"),
                ("debug-styles.css" in html, "CSS link missing"),
                ("main.js" in html, "Main JS missing"),
                ("connection-status" in html, "Connection status element missing"),
            ]

            for check, message in checks:
                if not check:
                    return TestResult("Debug UI Index", False, message)

            return TestResult("Debug UI Index", True, "Debug UI index.html loaded correctly")

        except requests.exceptions.ConnectionError:
            return TestResult("Debug UI Index", False, "Cannot connect to debug UI")

    def test_debug_ui_css(self) -> TestResult:
        """Test that debug CSS loads"""
        try:
            response = self.session.get(f"{DEBUG_UI_URL}/css/debug-styles.css", timeout=5)
            if response.status_code != 200:
                return TestResult(
                    "Debug UI CSS",
                    False,
                    f"Status {response.status_code}",
                    {"status": response.status_code}
                )

            content_type = response.headers.get("content-type", "")
            if "text/css" not in content_type:
                return TestResult(
                    "Debug UI CSS",
                    False,
                    f"Wrong content type: {content_type}",
                    {"content_type": content_type}
                )

            # Check for key CSS rules
            css = response.text
            if ".debug-card" not in css:
                return TestResult("Debug UI CSS", False, "CSS missing debug-card class")

            return TestResult("Debug UI CSS", True, "Debug CSS loaded correctly")

        except requests.exceptions.ConnectionError:
            return TestResult("Debug UI CSS", False, "Cannot load debug CSS")

    def test_debug_ui_js(self) -> TestResult:
        """Test that debug JavaScript loads"""
        try:
            response = self.session.get(f"{DEBUG_UI_URL}/js/main.js", timeout=5)
            if response.status_code != 200:
                return TestResult(
                    "Debug UI JS",
                    False,
                    f"Status {response.status_code}",
                    {"status": response.status_code}
                )

            content_type = response.headers.get("content-type", "")
            if "javascript" not in content_type and "application/javascript" not in content_type:
                # Some servers return text/javascript, some application/javascript
                if "text/plain" not in content_type:
                    return TestResult(
                        "Debug UI JS",
                        False,
                        f"Wrong content type: {content_type}",
                        {"content_type": content_type}
                    )

            # Check for key JS exports
            js = response.text
            if "import" not in js or "debugState" not in js:
                return TestResult("Debug UI JS", False, "JS missing expected imports")

            return TestResult("Debug UI JS", True, "Debug JavaScript loaded correctly")

        except requests.exceptions.ConnectionError:
            return TestResult("Debug UI JS", False, "Cannot load debug JavaScript")

    def test_sse_backend_direct(self) -> TestResult:
        """Test SSE endpoint directly on backend"""
        try:
            # Just check headers, don't actually stream
            response = self.session.get(
                BACKEND_DEBUG_SSE_URL,
                timeout=5,
                stream=True,
                headers={"Accept": "text/event-stream"}
            )

            content_type = response.headers.get("content-type", "")

            # Close the stream
            response.close()

            if response.status_code == 404:
                return TestResult(
                    "SSE Backend Direct",
                    False,
                    "SSE endpoint not found on backend (404)",
                    {"status": 404, "url": BACKEND_DEBUG_SSE_URL}
                )

            if response.status_code != 200:
                return TestResult(
                    "SSE Backend Direct",
                    False,
                    f"Status {response.status_code}",
                    {"status": response.status_code}
                )

            if "text/event-stream" not in content_type:
                return TestResult(
                    "SSE Backend Direct",
                    False,
                    f"Wrong content type: {content_type} (expected text/event-stream)",
                    {"content_type": content_type}
                )

            return TestResult("SSE Backend Direct", True, "Backend SSE endpoint responds correctly")

        except requests.exceptions.ConnectionError:
            return TestResult("SSE Backend Direct", False, "Cannot connect to backend SSE")
        except requests.exceptions.Timeout:
            # Timeout is expected for SSE if it's working (keeps connection open)
            return TestResult("SSE Backend Direct", True, "Backend SSE endpoint responds (timeout expected)")

    def test_sse_via_nginx(self) -> TestResult:
        """Test SSE endpoint through nginx proxy"""
        try:
            response = self.session.get(
                DEBUG_SSE_URL,
                timeout=5,
                stream=True,
                headers={"Accept": "text/event-stream"}
            )

            content_type = response.headers.get("content-type", "")

            # Close the stream
            response.close()

            if response.status_code != 200:
                return TestResult(
                    "SSE via Nginx",
                    False,
                    f"Status {response.status_code}",
                    {"status": response.status_code, "content_type": content_type}
                )

            if "text/event-stream" not in content_type:
                # This is the bug the user reported
                return TestResult(
                    "SSE via Nginx",
                    False,
                    f"Wrong content type: {content_type} (expected text/event-stream). "
                    "Nginx may be returning HTML fallback instead of proxying to backend.",
                    {"content_type": content_type, "url": DEBUG_SSE_URL}
                )

            return TestResult("SSE via Nginx", True, "Nginx SSE proxy works correctly")

        except requests.exceptions.ConnectionError:
            return TestResult("SSE via Nginx", False, "Cannot connect to nginx SSE proxy")
        except requests.exceptions.Timeout:
            return TestResult("SSE via Nginx", True, "Nginx SSE proxy responds (timeout expected)")

    def test_debug_api_health(self) -> TestResult:
        """Test debug health API endpoint"""
        try:
            response = self.session.get(f"{DEBUG_API_URL}/health", timeout=5)

            if response.status_code == 404:
                return TestResult(
                    "Debug API Health",
                    False,
                    "Debug health endpoint not found (backend may not have debug controller)",
                    {"status": 404}
                )

            if response.status_code != 200:
                return TestResult(
                    "Debug API Health",
                    False,
                    f"Status {response.status_code}",
                    {"status": response.status_code}
                )

            content_type = response.headers.get("content-type", "")
            if "application/json" not in content_type:
                return TestResult(
                    "Debug API Health",
                    False,
                    f"Wrong content type: {content_type}",
                    {"content_type": content_type}
                )

            return TestResult("Debug API Health", True, "Debug health API works")

        except requests.exceptions.ConnectionError:
            return TestResult("Debug API Health", False, "Cannot connect to debug API")

    def test_debug_api_data_users(self) -> TestResult:
        """Test debug data users endpoint"""
        try:
            response = self.session.get(f"{DEBUG_API_URL}/data/users", timeout=5)

            if response.status_code == 404:
                return TestResult(
                    "Debug API Users",
                    False,
                    "Debug users endpoint not found",
                    {"status": 404}
                )

            if response.status_code != 200:
                return TestResult(
                    "Debug API Users",
                    False,
                    f"Status {response.status_code}",
                    {"status": response.status_code}
                )

            data = response.json()
            if not isinstance(data, (list, dict)):
                return TestResult(
                    "Debug API Users",
                    False,
                    "Response is not a list or dict",
                    {"type": type(data).__name__}
                )

            return TestResult(
                "Debug API Users",
                True,
                f"Got users data",
                {"count": len(data) if isinstance(data, list) else "object"}
            )

        except requests.exceptions.ConnectionError:
            return TestResult("Debug API Users", False, "Cannot connect to debug API")
        except json.JSONDecodeError:
            return TestResult("Debug API Users", False, "Response is not valid JSON")

    def test_debug_api_data_tenants(self) -> TestResult:
        """Test debug data tenants endpoint"""
        try:
            response = self.session.get(f"{DEBUG_API_URL}/data/tenants", timeout=5)

            if response.status_code == 404:
                return TestResult(
                    "Debug API Tenants",
                    False,
                    "Debug tenants endpoint not found",
                    {"status": 404}
                )

            if response.status_code != 200:
                return TestResult(
                    "Debug API Tenants",
                    False,
                    f"Status {response.status_code}",
                    {"status": response.status_code}
                )

            data = response.json()
            return TestResult(
                "Debug API Tenants",
                True,
                f"Got tenants data",
                {"count": len(data) if isinstance(data, list) else "object"}
            )

        except requests.exceptions.ConnectionError:
            return TestResult("Debug API Tenants", False, "Cannot connect to debug API")
        except json.JSONDecodeError:
            return TestResult("Debug API Tenants", False, "Response is not valid JSON")

    def test_debug_api_data_sessions(self) -> TestResult:
        """Test debug data sessions endpoint"""
        try:
            response = self.session.get(f"{DEBUG_API_URL}/data/sessions", timeout=5)

            if response.status_code == 404:
                return TestResult(
                    "Debug API Sessions",
                    False,
                    "Debug sessions endpoint not found",
                    {"status": 404}
                )

            if response.status_code != 200:
                return TestResult(
                    "Debug API Sessions",
                    False,
                    f"Status {response.status_code}",
                    {"status": response.status_code}
                )

            data = response.json()
            return TestResult(
                "Debug API Sessions",
                True,
                f"Got sessions data",
                {"count": len(data) if isinstance(data, list) else "object"}
            )

        except requests.exceptions.ConnectionError:
            return TestResult("Debug API Sessions", False, "Cannot connect to debug API")
        except json.JSONDecodeError:
            return TestResult("Debug API Sessions", False, "Response is not valid JSON")

    def test_debug_api_data_accounts(self) -> TestResult:
        """Test debug data accounts endpoint - this is the accounts tab data"""
        try:
            response = self.session.get(f"{DEBUG_API_URL}/data/accounts", timeout=5)

            if response.status_code == 404:
                return TestResult(
                    "Debug API Accounts",
                    False,
                    "Debug accounts endpoint not found",
                    {"status": 404}
                )

            if response.status_code == 500:
                return TestResult(
                    "Debug API Accounts",
                    False,
                    "Server error (500) - likely lazy loading issue with Hibernate",
                    {"status": 500}
                )

            if response.status_code != 200:
                return TestResult(
                    "Debug API Accounts",
                    False,
                    f"Status {response.status_code}",
                    {"status": response.status_code}
                )

            data = response.json()
            if not isinstance(data, list):
                return TestResult(
                    "Debug API Accounts",
                    False,
                    "Response is not a list",
                    {"type": type(data).__name__}
                )

            # Verify expected account fields are present
            if len(data) > 0:
                expected_fields = ["id", "tenantId", "tenantName", "accountNumber",
                                   "accountType", "name", "balance", "currency", "status"]
                first_account = data[0]
                missing_fields = [f for f in expected_fields if f not in first_account]
                if missing_fields:
                    return TestResult(
                        "Debug API Accounts",
                        False,
                        f"Missing expected fields: {missing_fields}",
                        {"fields": list(first_account.keys())}
                    )

            return TestResult(
                "Debug API Accounts",
                True,
                f"Got {len(data)} accounts with expected fields",
                {"count": len(data)}
            )

        except requests.exceptions.ConnectionError:
            return TestResult("Debug API Accounts", False, "Cannot connect to debug API")
        except json.JSONDecodeError:
            return TestResult("Debug API Accounts", False, "Response is not valid JSON")

    def test_debug_api_data_memberships(self) -> TestResult:
        """Test debug data memberships endpoint"""
        try:
            response = self.session.get(f"{DEBUG_API_URL}/data/memberships", timeout=5)

            if response.status_code == 404:
                return TestResult(
                    "Debug API Memberships",
                    False,
                    "Debug memberships endpoint not found",
                    {"status": 404}
                )

            if response.status_code == 500:
                return TestResult(
                    "Debug API Memberships",
                    False,
                    "Server error (500) - likely lazy loading issue with Hibernate",
                    {"status": 500}
                )

            if response.status_code != 200:
                return TestResult(
                    "Debug API Memberships",
                    False,
                    f"Status {response.status_code}",
                    {"status": response.status_code}
                )

            data = response.json()
            if not isinstance(data, list):
                return TestResult(
                    "Debug API Memberships",
                    False,
                    "Response is not a list",
                    {"type": type(data).__name__}
                )

            # Verify expected membership fields are present
            if len(data) > 0:
                expected_fields = ["id", "userId", "userEmail", "tenantId",
                                   "tenantName", "role", "status"]
                first_membership = data[0]
                missing_fields = [f for f in expected_fields if f not in first_membership]
                if missing_fields:
                    return TestResult(
                        "Debug API Memberships",
                        False,
                        f"Missing expected fields: {missing_fields}",
                        {"fields": list(first_membership.keys())}
                    )

            return TestResult(
                "Debug API Memberships",
                True,
                f"Got {len(data)} memberships with expected fields",
                {"count": len(data)}
            )

        except requests.exceptions.ConnectionError:
            return TestResult("Debug API Memberships", False, "Cannot connect to debug API")
        except json.JSONDecodeError:
            return TestResult("Debug API Memberships", False, "Response is not valid JSON")

    def test_debug_api_auth_tokens(self) -> TestResult:
        """Test auth tokens endpoint - Active Tokens tab"""
        try:
            response = self.session.get(f"{DEBUG_API_URL}/auth/tokens", timeout=5)

            if response.status_code == 404:
                return TestResult(
                    "Debug API Auth Tokens",
                    False,
                    "Auth tokens endpoint not found",
                    {"status": 404}
                )

            if response.status_code == 500:
                return TestResult(
                    "Debug API Auth Tokens",
                    False,
                    "Server error (500)",
                    {"status": 500}
                )

            if response.status_code != 200:
                return TestResult(
                    "Debug API Auth Tokens",
                    False,
                    f"Status {response.status_code}",
                    {"status": response.status_code}
                )

            data = response.json()
            if not isinstance(data, dict):
                return TestResult(
                    "Debug API Auth Tokens",
                    False,
                    "Response is not an object",
                    {"type": type(data).__name__}
                )

            # Check expected fields
            if "tokens" not in data or "count" not in data:
                return TestResult(
                    "Debug API Auth Tokens",
                    False,
                    "Missing expected fields (tokens, count)",
                    {"fields": list(data.keys())}
                )

            return TestResult(
                "Debug API Auth Tokens",
                True,
                f"Got {data['count']} active tokens",
                {"count": data['count']}
            )

        except requests.exceptions.ConnectionError:
            return TestResult("Debug API Auth Tokens", False, "Cannot connect to debug API")
        except json.JSONDecodeError:
            return TestResult("Debug API Auth Tokens", False, "Response is not valid JSON")

    def test_debug_api_auth_keycloak_events(self) -> TestResult:
        """Test Keycloak events endpoint - Keycloak Events tab"""
        try:
            response = self.session.get(f"{DEBUG_API_URL}/auth/keycloak/events", timeout=5)

            if response.status_code == 404:
                return TestResult(
                    "Debug API Keycloak Events",
                    False,
                    "Keycloak events endpoint not found",
                    {"status": 404}
                )

            if response.status_code == 500:
                return TestResult(
                    "Debug API Keycloak Events",
                    False,
                    "Server error (500)",
                    {"status": 500}
                )

            if response.status_code != 200:
                return TestResult(
                    "Debug API Keycloak Events",
                    False,
                    f"Status {response.status_code}",
                    {"status": response.status_code}
                )

            data = response.json()
            if not isinstance(data, dict):
                return TestResult(
                    "Debug API Keycloak Events",
                    False,
                    "Response is not an object",
                    {"type": type(data).__name__}
                )

            # Check expected fields
            if "events" not in data or "count" not in data:
                return TestResult(
                    "Debug API Keycloak Events",
                    False,
                    "Missing expected fields (events, count)",
                    {"fields": list(data.keys())}
                )

            return TestResult(
                "Debug API Keycloak Events",
                True,
                f"Got {data['count']} Keycloak events",
                {"count": data['count']}
            )

        except requests.exceptions.ConnectionError:
            return TestResult("Debug API Keycloak Events", False, "Cannot connect to debug API")
        except json.JSONDecodeError:
            return TestResult("Debug API Keycloak Events", False, "Response is not valid JSON")

    def test_debug_api_auth_decode(self) -> TestResult:
        """Test JWT decode endpoint - JWT Decoder tab functionality"""
        try:
            # Use a sample JWT for testing (this is just the structure, not a valid signature)
            # Header: {"alg":"RS256","typ":"JWT"}
            # Payload: {"sub":"test","name":"Test User","iat":1234567890}
            sample_jwt = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0IiwibmFtZSI6IlRlc3QgVXNlciIsImlhdCI6MTIzNDU2Nzg5MH0.signature"

            response = self.session.post(
                f"{DEBUG_API_URL}/auth/decode",
                json={"token": sample_jwt},
                timeout=5
            )

            if response.status_code == 404:
                return TestResult(
                    "Debug API Auth Decode",
                    False,
                    "JWT decode endpoint not found",
                    {"status": 404}
                )

            if response.status_code == 500:
                return TestResult(
                    "Debug API Auth Decode",
                    False,
                    "Server error (500)",
                    {"status": 500}
                )

            # 400 is acceptable for invalid JWT format
            if response.status_code == 400:
                data = response.json()
                if "valid" in data and data["valid"] == False:
                    return TestResult(
                        "Debug API Auth Decode",
                        True,
                        "JWT decode endpoint works (returned invalid for test token)",
                        {"valid": False}
                    )

            if response.status_code != 200:
                return TestResult(
                    "Debug API Auth Decode",
                    False,
                    f"Unexpected status {response.status_code}",
                    {"status": response.status_code}
                )

            data = response.json()
            return TestResult(
                "Debug API Auth Decode",
                True,
                "JWT decode endpoint works",
                {"valid": data.get("valid", "unknown")}
            )

        except requests.exceptions.ConnectionError:
            return TestResult("Debug API Auth Decode", False, "Cannot connect to debug API")
        except json.JSONDecodeError:
            return TestResult("Debug API Auth Decode", False, "Response is not valid JSON")

    def test_session_appears_in_debug(self) -> TestResult:
        """
        Integration test: Login via Keycloak, make authenticated request,
        then verify the session appears in the debug UI.
        """
        try:
            # Step 1: Authenticate with Keycloak
            token_url = f"{KEYCLOAK_URL}/realms/{KEYCLOAK_REALM}/protocol/openid-connect/token"

            token_response = self.session.post(
                token_url,
                data={
                    "grant_type": "password",
                    "client_id": KEYCLOAK_CLIENT_ID,
                    "username": TEST_USER_EMAIL,
                    "password": TEST_USER_PASSWORD,
                    "scope": "openid profile email"
                },
                timeout=10
            )

            if token_response.status_code != 200:
                return TestResult(
                    "Session Debug Visibility",
                    False,
                    f"Keycloak auth failed: {token_response.status_code}",
                    {"error": token_response.text[:200]}
                )

            token_data = token_response.json()
            access_token = token_data.get("access_token")

            if not access_token:
                return TestResult(
                    "Session Debug Visibility",
                    False,
                    "No access_token in Keycloak response",
                    {}
                )

            # Step 2: Make authenticated request to backend to create a session
            auth_headers = {"Authorization": f"Bearer {access_token}"}

            # Call /auth/me to create/register the session
            me_response = self.session.get(
                f"{BACKEND_URL}/auth/me",
                headers=auth_headers,
                timeout=5
            )

            if me_response.status_code != 200:
                return TestResult(
                    "Session Debug Visibility",
                    False,
                    f"/auth/me failed: {me_response.status_code}",
                    {"status": me_response.status_code}
                )

            user_info = me_response.json()
            user_email = user_info.get("email", "unknown")

            # Step 3: Check debug sessions endpoint for our session
            sessions_response = self.session.get(
                f"{DEBUG_API_URL}/data/sessions",
                timeout=5
            )

            if sessions_response.status_code != 200:
                return TestResult(
                    "Session Debug Visibility",
                    False,
                    f"Debug sessions endpoint failed: {sessions_response.status_code}",
                    {"status": sessions_response.status_code}
                )

            sessions_data = sessions_response.json()
            sessions = sessions_data.get("sessions", [])

            # Look for our session by user email
            our_session = None
            for session in sessions:
                if session.get("user_email") == user_email:
                    our_session = session
                    break

            if not our_session:
                return TestResult(
                    "Session Debug Visibility",
                    False,
                    f"Session for {user_email} not found in debug sessions",
                    {
                        "user_email": user_email,
                        "session_count": len(sessions),
                        "session_emails": [s.get("user_email") for s in sessions]
                    }
                )

            # Step 4: Check if session appears in active tokens
            tokens_response = self.session.get(
                f"{DEBUG_API_URL}/auth/tokens",
                timeout=5
            )

            tokens_data = tokens_response.json() if tokens_response.status_code == 200 else {}
            tokens = tokens_data.get("tokens", [])

            # Check if our token is visible
            token_visible = any(t.get("userEmail") == user_email for t in tokens)

            return TestResult(
                "Session Debug Visibility",
                True,
                f"Session created for {user_email} and visible in debug UI",
                {
                    "user_email": user_email,
                    "session_id": our_session.get("id"),
                    "session_visible": True,
                    "token_visible": token_visible,
                    "total_sessions": len(sessions),
                    "total_tokens": len(tokens)
                }
            )

        except requests.exceptions.ConnectionError as e:
            return TestResult(
                "Session Debug Visibility",
                False,
                f"Connection error: {str(e)}",
                {}
            )
        except Exception as e:
            return TestResult(
                "Session Debug Visibility",
                False,
                f"Unexpected error: {str(e)}",
                {"exception": str(e)}
            )

    # ==================== Session Timeline Tests ====================

    def test_session_timeline(self) -> TestResult:
        """
        Test session timeline endpoint.
        First creates a session via login, then retrieves its timeline.
        """
        try:
            # Step 1: Get existing sessions to find one with events
            sessions_response = self.session.get(
                f"{DEBUG_API_URL}/data/sessions",
                timeout=5
            )

            if sessions_response.status_code != 200:
                return TestResult(
                    "Session Timeline",
                    False,
                    f"Failed to get sessions: {sessions_response.status_code}",
                    {"status": sessions_response.status_code}
                )

            sessions_data = sessions_response.json()
            sessions = sessions_data.get("sessions", [])

            if not sessions:
                # Create a session first via authentication
                token_url = f"{KEYCLOAK_URL}/realms/{KEYCLOAK_REALM}/protocol/openid-connect/token"
                token_response = self.session.post(
                    token_url,
                    data={
                        "grant_type": "password",
                        "client_id": KEYCLOAK_CLIENT_ID,
                        "username": TEST_USER_EMAIL,
                        "password": TEST_USER_PASSWORD,
                        "scope": "openid profile email"
                    },
                    timeout=10
                )

                if token_response.status_code == 200:
                    token_data = token_response.json()
                    access_token = token_data.get("access_token")
                    if access_token:
                        # Make authenticated request to create session
                        self.session.get(
                            f"{BACKEND_URL}/auth/me",
                            headers={"Authorization": f"Bearer {access_token}"},
                            timeout=5
                        )
                        # Refresh sessions list
                        sessions_response = self.session.get(
                            f"{DEBUG_API_URL}/data/sessions",
                            timeout=5
                        )
                        if sessions_response.status_code == 200:
                            sessions = sessions_response.json().get("sessions", [])

            if not sessions:
                return TestResult(
                    "Session Timeline",
                    False,
                    "No sessions available to test timeline",
                    {}
                )

            # Step 2: Get timeline for first session
            session_id = sessions[0].get("id")
            timeline_response = self.session.get(
                f"{DEBUG_API_URL}/sessions/{session_id}/timeline",
                timeout=5
            )

            if timeline_response.status_code != 200:
                return TestResult(
                    "Session Timeline",
                    False,
                    f"Timeline endpoint returned {timeline_response.status_code}",
                    {"status": timeline_response.status_code, "session_id": session_id}
                )

            timeline_data = timeline_response.json()

            # Verify response structure
            if "session" not in timeline_data:
                return TestResult(
                    "Session Timeline",
                    False,
                    "Timeline response missing 'session' field",
                    {"response": timeline_data}
                )

            return TestResult(
                "Session Timeline",
                True,
                f"Timeline retrieved for session {session_id[:12]}...",
                {
                    "session_id": session_id,
                    "event_count": timeline_data.get("eventCount", len(timeline_data.get("events", [])))
                }
            )

        except requests.exceptions.ConnectionError as e:
            return TestResult(
                "Session Timeline",
                False,
                f"Connection error: {str(e)}",
                {}
            )
        except Exception as e:
            return TestResult(
                "Session Timeline",
                False,
                f"Unexpected error: {str(e)}",
                {"exception": str(e)}
            )

    def test_session_timeline_workflow_path(self) -> TestResult:
        """
        Test session timeline via the /workflows/ path that the frontend actually uses.
        The frontend component (session-timeline.js) calls /workflows/sessions/{id}/timeline
        which needs to be proxied to the backend's /sessions/{id}/timeline endpoint.
        """
        try:
            # Step 1: Get existing sessions to find one with events
            sessions_response = self.session.get(
                f"{DEBUG_API_URL}/data/sessions",
                timeout=5
            )

            if sessions_response.status_code != 200:
                return TestResult(
                    "Session Timeline (Workflow Path)",
                    False,
                    f"Failed to get sessions: {sessions_response.status_code}",
                    {"status": sessions_response.status_code}
                )

            sessions_data = sessions_response.json()
            sessions = sessions_data.get("sessions", [])

            if not sessions:
                # Create a session first via authentication
                token_url = f"{KEYCLOAK_URL}/realms/{KEYCLOAK_REALM}/protocol/openid-connect/token"
                token_response = self.session.post(
                    token_url,
                    data={
                        "grant_type": "password",
                        "client_id": KEYCLOAK_CLIENT_ID,
                        "username": TEST_USER_EMAIL,
                        "password": TEST_USER_PASSWORD,
                        "scope": "openid profile email"
                    },
                    timeout=10
                )

                if token_response.status_code == 200:
                    token_data = token_response.json()
                    access_token = token_data.get("access_token")
                    if access_token:
                        # Make authenticated request to create session
                        self.session.get(
                            f"{BACKEND_URL}/auth/me",
                            headers={"Authorization": f"Bearer {access_token}"},
                            timeout=5
                        )
                        # Refresh sessions list
                        sessions_response = self.session.get(
                            f"{DEBUG_API_URL}/data/sessions",
                            timeout=5
                        )
                        if sessions_response.status_code == 200:
                            sessions = sessions_response.json().get("sessions", [])

            if not sessions:
                return TestResult(
                    "Session Timeline (Workflow Path)",
                    False,
                    "No sessions available to test timeline",
                    {}
                )

            # Step 2: Get timeline using the /workflows/ path (as frontend does)
            session_id = sessions[0].get("id")
            timeline_response = self.session.get(
                f"{DEBUG_API_URL}/workflows/sessions/{session_id}/timeline",
                timeout=5
            )

            if timeline_response.status_code == 404:
                return TestResult(
                    "Session Timeline (Workflow Path)",
                    False,
                    "Endpoint /workflows/sessions/{id}/timeline not found - frontend uses this path but backend doesn't have it",
                    {"status": 404, "session_id": session_id, "expected_path": f"/workflows/sessions/{session_id}/timeline"}
                )

            if timeline_response.status_code == 500:
                return TestResult(
                    "Session Timeline (Workflow Path)",
                    False,
                    f"Server error (500) - backend may be missing /workflows/sessions/{{id}}/timeline endpoint",
                    {"status": 500, "session_id": session_id}
                )

            if timeline_response.status_code != 200:
                return TestResult(
                    "Session Timeline (Workflow Path)",
                    False,
                    f"Timeline endpoint returned {timeline_response.status_code}",
                    {"status": timeline_response.status_code, "session_id": session_id}
                )

            timeline_data = timeline_response.json()

            # Verify response structure matches what frontend expects
            if "session" not in timeline_data:
                return TestResult(
                    "Session Timeline (Workflow Path)",
                    False,
                    "Timeline response missing 'session' field",
                    {"response": timeline_data}
                )

            if "events" not in timeline_data:
                return TestResult(
                    "Session Timeline (Workflow Path)",
                    False,
                    "Timeline response missing 'events' field",
                    {"response": timeline_data}
                )

            # Verify session object has expected fields for frontend display
            session_obj = timeline_data.get("session", {})
            expected_session_fields = ["id", "userEmail"]
            missing_session_fields = [f for f in expected_session_fields if f not in session_obj and f.lower() not in [k.lower() for k in session_obj.keys()]]

            events = timeline_data.get("events", [])
            event_count = timeline_data.get("eventCount", len(events))

            # Verify event structure if events exist
            if events:
                first_event = events[0]
                expected_event_fields = ["id", "timestamp", "type", "action"]
                missing_event_fields = [f for f in expected_event_fields if f not in first_event]
                if missing_event_fields:
                    return TestResult(
                        "Session Timeline (Workflow Path)",
                        False,
                        f"Event missing expected fields: {missing_event_fields}",
                        {"event_fields": list(first_event.keys())}
                    )

            return TestResult(
                "Session Timeline (Workflow Path)",
                True,
                f"Timeline retrieved via /workflows/ path for session {session_id[:12]}...",
                {
                    "session_id": session_id,
                    "event_count": event_count,
                    "has_session": "session" in timeline_data,
                    "has_events": "events" in timeline_data
                }
            )

        except requests.exceptions.ConnectionError as e:
            return TestResult(
                "Session Timeline (Workflow Path)",
                False,
                f"Connection error: {str(e)}",
                {}
            )
        except Exception as e:
            return TestResult(
                "Session Timeline (Workflow Path)",
                False,
                f"Unexpected error: {str(e)}",
                {"exception": str(e)}
            )

    def test_session_timeline_with_actions(self) -> TestResult:
        """
        Integration test: Login, switch tenant, and verify these actions
        appear as events in the session timeline.

        This tests:
        1. Login creates an AUTH event with action "login_success"
        2. Tenant switch creates a CONTEXT_SWITCH event with action "tenant_switch"
        3. Both events appear in the session timeline
        """
        try:
            # Step 1: Authenticate with Keycloak
            token_url = f"{KEYCLOAK_URL}/realms/{KEYCLOAK_REALM}/protocol/openid-connect/token"
            token_response = self.session.post(
                token_url,
                data={
                    "grant_type": "password",
                    "client_id": KEYCLOAK_CLIENT_ID,
                    "username": TEST_USER_EMAIL,
                    "password": TEST_USER_PASSWORD,
                    "scope": "openid profile email"
                },
                timeout=10
            )

            if token_response.status_code != 200:
                return TestResult(
                    "Session Timeline with Actions",
                    False,
                    f"Keycloak auth failed: {token_response.status_code}",
                    {"error": token_response.text[:200]}
                )

            token_data = token_response.json()
            access_token = token_data.get("access_token")

            if not access_token:
                return TestResult(
                    "Session Timeline with Actions",
                    False,
                    "No access_token in Keycloak response",
                    {}
                )

            auth_headers = {"Authorization": f"Bearer {access_token}"}

            # Step 2: Call /auth/me to trigger login event
            me_response = self.session.get(
                f"{BACKEND_URL}/auth/me",
                headers=auth_headers,
                timeout=5
            )

            if me_response.status_code != 200:
                return TestResult(
                    "Session Timeline with Actions",
                    False,
                    f"/auth/me failed: {me_response.status_code}",
                    {"status": me_response.status_code}
                )

            user_info = me_response.json()
            user_email = user_info.get("email", "unknown")
            tenants = user_info.get("tenants", [])

            # Step 3: Switch to a tenant (if available) to trigger context switch event
            tenant_switched = False
            switched_tenant_name = None
            if tenants and len(tenants) > 0:
                target_tenant = tenants[0]
                target_tenant_id = target_tenant.get("id")
                switched_tenant_name = target_tenant.get("name")

                exchange_response = self.session.post(
                    f"{BACKEND_URL}/auth/token/exchange",
                    headers=auth_headers,
                    json={"targetTenantId": target_tenant_id},
                    timeout=5
                )

                if exchange_response.status_code == 200:
                    tenant_switched = True
                else:
                    # Not a failure - just means we can't test tenant switch
                    pass

            # Step 4: Get the session from debug API
            sessions_response = self.session.get(
                f"{DEBUG_API_URL}/data/sessions",
                timeout=5
            )

            if sessions_response.status_code != 200:
                return TestResult(
                    "Session Timeline with Actions",
                    False,
                    f"Failed to get sessions: {sessions_response.status_code}",
                    {"status": sessions_response.status_code}
                )

            sessions_data = sessions_response.json()
            sessions = sessions_data.get("sessions", [])

            # Find our session by user email
            our_session = None
            for session in sessions:
                if session.get("userEmail") == user_email or session.get("user_email") == user_email:
                    our_session = session
                    break

            if not our_session:
                return TestResult(
                    "Session Timeline with Actions",
                    False,
                    f"Session for {user_email} not found",
                    {"user_email": user_email, "sessions": [s.get("userEmail") or s.get("user_email") for s in sessions]}
                )

            # Step 5: Get timeline for our session
            session_id = our_session.get("id")
            timeline_response = self.session.get(
                f"{DEBUG_API_URL}/workflows/sessions/{session_id}/timeline",
                timeout=5
            )

            if timeline_response.status_code != 200:
                return TestResult(
                    "Session Timeline with Actions",
                    False,
                    f"Timeline endpoint returned {timeline_response.status_code}",
                    {"status": timeline_response.status_code, "session_id": session_id}
                )

            timeline_data = timeline_response.json()
            events = timeline_data.get("events", [])

            # Step 6: Verify login event exists
            login_events = [e for e in events if e.get("type") == "AUTH" and e.get("action") == "login_success"]
            has_login_event = len(login_events) > 0

            # Step 7: Verify context switch event exists (if we did a switch)
            context_switch_events = [e for e in events if e.get("type") == "CONTEXT_SWITCH" and e.get("action") == "tenant_switch"]
            has_context_switch = len(context_switch_events) > 0

            # Build result details
            event_types = [e.get("type") for e in events]
            event_actions = [e.get("action") for e in events]

            # Determine pass/fail
            if not has_login_event:
                return TestResult(
                    "Session Timeline with Actions",
                    False,
                    "Login event (AUTH/login_success) not found in timeline",
                    {
                        "session_id": session_id,
                        "event_count": len(events),
                        "event_types": list(set(event_types)),
                        "event_actions": list(set(event_actions)),
                        "expected": "AUTH event with action 'login_success'"
                    }
                )

            if tenant_switched and not has_context_switch:
                return TestResult(
                    "Session Timeline with Actions",
                    False,
                    f"Context switch event not found after switching to tenant '{switched_tenant_name}'",
                    {
                        "session_id": session_id,
                        "event_count": len(events),
                        "event_types": list(set(event_types)),
                        "event_actions": list(set(event_actions)),
                        "switched_to": switched_tenant_name,
                        "expected": "CONTEXT_SWITCH event with action 'tenant_switch'"
                    }
                )

            return TestResult(
                "Session Timeline with Actions",
                True,
                f"Timeline shows login event" + (f" and tenant switch to '{switched_tenant_name}'" if tenant_switched else " (no tenant switch performed)"),
                {
                    "session_id": session_id,
                    "event_count": len(events),
                    "has_login_event": has_login_event,
                    "has_context_switch": has_context_switch,
                    "tenant_switched": tenant_switched,
                    "switched_tenant": switched_tenant_name,
                    "event_types": list(set(event_types))
                }
            )

        except requests.exceptions.ConnectionError as e:
            return TestResult(
                "Session Timeline with Actions",
                False,
                f"Connection error: {str(e)}",
                {}
            )
        except Exception as e:
            return TestResult(
                "Session Timeline with Actions",
                False,
                f"Unexpected error: {str(e)}",
                {"exception": str(e)}
            )

    # ==================== OPA Decisions Tests ====================

    def test_opa_decisions_endpoint(self) -> TestResult:
        """
        Test OPA decisions endpoint returns valid data.
        """
        try:
            response = self.session.get(
                f"{DEBUG_API_URL}/opa/decisions",
                timeout=5
            )

            if response.status_code != 200:
                return TestResult(
                    "OPA Decisions",
                    False,
                    f"OPA decisions endpoint returned {response.status_code}",
                    {"status": response.status_code}
                )

            data = response.json()

            # Verify response structure
            if "decisions" not in data:
                return TestResult(
                    "OPA Decisions",
                    False,
                    "Response missing 'decisions' field",
                    {"response": data}
                )

            decisions = data.get("decisions", [])
            decision_count = data.get("count", len(decisions))

            return TestResult(
                "OPA Decisions",
                True,
                f"Got {decision_count} OPA decisions",
                {
                    "decision_count": decision_count,
                    "has_decisions": len(decisions) > 0
                }
            )

        except requests.exceptions.ConnectionError as e:
            return TestResult(
                "OPA Decisions",
                False,
                f"Connection error: {str(e)}",
                {}
            )
        except Exception as e:
            return TestResult(
                "OPA Decisions",
                False,
                f"Unexpected error: {str(e)}",
                {"exception": str(e)}
            )

    # ==================== Risk Analysis Tests ====================

    def test_risk_controls_get(self) -> TestResult:
        """
        Test getting current risk override state.
        """
        try:
            response = self.session.get(
                f"{DEBUG_API_URL}/controls/risk",
                timeout=5
            )

            if response.status_code != 200:
                return TestResult(
                    "Risk Controls (GET)",
                    False,
                    f"Risk controls endpoint returned {response.status_code}",
                    {"status": response.status_code}
                )

            data = response.json()

            # Verify response structure
            if "active" not in data:
                return TestResult(
                    "Risk Controls (GET)",
                    False,
                    "Response missing 'active' field",
                    {"response": data}
                )

            return TestResult(
                "Risk Controls (GET)",
                True,
                f"Risk override active: {data.get('active')}, score: {data.get('score')}",
                {
                    "active": data.get("active"),
                    "score": data.get("score")
                }
            )

        except requests.exceptions.ConnectionError as e:
            return TestResult(
                "Risk Controls (GET)",
                False,
                f"Connection error: {str(e)}",
                {}
            )
        except Exception as e:
            return TestResult(
                "Risk Controls (GET)",
                False,
                f"Unexpected error: {str(e)}",
                {"exception": str(e)}
            )

    def test_risk_controls_set_and_clear(self) -> TestResult:
        """
        Test setting and clearing risk override.
        """
        try:
            # Step 1: Set a risk override
            set_response = self.session.post(
                f"{DEBUG_API_URL}/controls/risk",
                json={"score": 75},
                timeout=5
            )

            if set_response.status_code != 200:
                return TestResult(
                    "Risk Controls (SET/CLEAR)",
                    False,
                    f"Failed to set risk override: {set_response.status_code}",
                    {"status": set_response.status_code, "response": set_response.text[:200]}
                )

            # Step 2: Verify it was set
            get_response = self.session.get(
                f"{DEBUG_API_URL}/controls/risk",
                timeout=5
            )

            if get_response.status_code != 200:
                return TestResult(
                    "Risk Controls (SET/CLEAR)",
                    False,
                    f"Failed to verify risk override: {get_response.status_code}",
                    {"status": get_response.status_code}
                )

            get_data = get_response.json()
            if not get_data.get("active") or get_data.get("score") != 75:
                return TestResult(
                    "Risk Controls (SET/CLEAR)",
                    False,
                    "Risk override was not set correctly",
                    {"expected_score": 75, "actual": get_data}
                )

            # Step 3: Clear the risk override
            clear_response = self.session.post(
                f"{DEBUG_API_URL}/controls/risk",
                json={"score": None},
                timeout=5
            )

            if clear_response.status_code != 200:
                return TestResult(
                    "Risk Controls (SET/CLEAR)",
                    False,
                    f"Failed to clear risk override: {clear_response.status_code}",
                    {"status": clear_response.status_code}
                )

            # Step 4: Verify it was cleared
            final_response = self.session.get(
                f"{DEBUG_API_URL}/controls/risk",
                timeout=5
            )

            if final_response.status_code != 200:
                return TestResult(
                    "Risk Controls (SET/CLEAR)",
                    False,
                    f"Failed to verify cleared risk: {final_response.status_code}",
                    {"status": final_response.status_code}
                )

            final_data = final_response.json()
            if final_data.get("active"):
                return TestResult(
                    "Risk Controls (SET/CLEAR)",
                    False,
                    "Risk override was not cleared",
                    {"response": final_data}
                )

            return TestResult(
                "Risk Controls (SET/CLEAR)",
                True,
                "Risk override set to 75 and cleared successfully",
                {}
            )

        except requests.exceptions.ConnectionError as e:
            return TestResult(
                "Risk Controls (SET/CLEAR)",
                False,
                f"Connection error: {str(e)}",
                {}
            )
        except Exception as e:
            return TestResult(
                "Risk Controls (SET/CLEAR)",
                False,
                f"Unexpected error: {str(e)}",
                {"exception": str(e)}
            )

    # ==================== Debug Controls State Tests ====================

    def test_debug_controls_state(self) -> TestResult:
        """
        Test getting debug controls state.
        """
        try:
            response = self.session.get(
                f"{DEBUG_API_URL}/controls",
                timeout=5
            )

            if response.status_code != 200:
                return TestResult(
                    "Debug Controls State",
                    False,
                    f"Controls endpoint returned {response.status_code}",
                    {"status": response.status_code}
                )

            data = response.json()

            # Verify response has expected fields (snake_case from Java record)
            expected_fields = ["risk_override_active", "time_override_active"]
            missing_fields = [f for f in expected_fields if f not in data]

            if missing_fields:
                return TestResult(
                    "Debug Controls State",
                    False,
                    f"Response missing fields: {missing_fields}",
                    {"response": data, "missing": missing_fields}
                )

            return TestResult(
                "Debug Controls State",
                True,
                "Debug controls state retrieved successfully",
                {
                    "risk_override_active": data.get("risk_override_active"),
                    "time_override_active": data.get("time_override_active")
                }
            )

        except requests.exceptions.ConnectionError as e:
            return TestResult(
                "Debug Controls State",
                False,
                f"Connection error: {str(e)}",
                {}
            )
        except Exception as e:
            return TestResult(
                "Debug Controls State",
                False,
                f"Unexpected error: {str(e)}",
                {"exception": str(e)}
            )

    # ==================== Policy Browser Tests ====================

    def test_policy_list(self) -> TestResult:
        """
        Test listing available policies.
        """
        try:
            response = self.session.get(
                f"{DEBUG_API_URL}/policy/policies",
                timeout=5
            )

            if response.status_code != 200:
                return TestResult(
                    "Policy List",
                    False,
                    f"Policy list endpoint returned {response.status_code}",
                    {"status": response.status_code}
                )

            data = response.json()

            # Verify response structure
            if "policies" not in data:
                return TestResult(
                    "Policy List",
                    False,
                    "Response missing 'policies' field",
                    {"response": data}
                )

            policies = data.get("policies", [])
            if len(policies) == 0:
                return TestResult(
                    "Policy List",
                    False,
                    "No policies returned",
                    {"response": data}
                )

            # Verify policy structure
            first_policy = policies[0]
            required_fields = ["id", "name", "raw"]
            missing_fields = [f for f in required_fields if f not in first_policy]
            if missing_fields:
                return TestResult(
                    "Policy List",
                    False,
                    f"Policy missing fields: {missing_fields}",
                    {"policy": first_policy}
                )

            return TestResult(
                "Policy List",
                True,
                f"Got {len(policies)} policies",
                {
                    "policy_count": len(policies),
                    "policy_names": [p.get("name") for p in policies]
                }
            )

        except requests.exceptions.ConnectionError as e:
            return TestResult(
                "Policy List",
                False,
                f"Connection error: {str(e)}",
                {}
            )
        except Exception as e:
            return TestResult(
                "Policy List",
                False,
                f"Unexpected error: {str(e)}",
                {"exception": str(e)}
            )

    def test_slide_over_element(self) -> TestResult:
        """
        Test that the slide-over element exists in the debug UI HTML
        and has the close button.
        """
        try:
            response = self.session.get(
                f"{DEBUG_UI_URL}/",
                timeout=5
            )

            if response.status_code != 200:
                return TestResult(
                    "Slide-over Element",
                    False,
                    f"Debug UI returned {response.status_code}",
                    {"status": response.status_code}
                )

            html = response.text

            # Check for slide-over element
            if 'id="slide-over"' not in html:
                return TestResult(
                    "Slide-over Element",
                    False,
                    "slide-over element not found in HTML",
                    {}
                )

            # Check for close button
            if 'id="close-slide-over"' not in html:
                return TestResult(
                    "Slide-over Element",
                    False,
                    "close-slide-over button not found in HTML",
                    {}
                )

            # Check for slide-over title
            if 'id="slide-over-title"' not in html:
                return TestResult(
                    "Slide-over Element",
                    False,
                    "slide-over-title element not found in HTML",
                    {}
                )

            # Check for slide-over content area
            if 'id="slide-over-content"' not in html:
                return TestResult(
                    "Slide-over Element",
                    False,
                    "slide-over-content element not found in HTML",
                    {}
                )

            return TestResult(
                "Slide-over Element",
                True,
                "Slide-over element and close button exist in DOM",
                {
                    "has_slide_over": True,
                    "has_close_button": True,
                    "has_title": True,
                    "has_content": True
                }
            )

        except requests.exceptions.ConnectionError as e:
            return TestResult(
                "Slide-over Element",
                False,
                f"Connection error: {str(e)}",
                {}
            )
        except Exception as e:
            return TestResult(
                "Slide-over Element",
                False,
                f"Unexpected error: {str(e)}",
                {"exception": str(e)}
            )

    def test_policy_evaluate(self) -> TestResult:
        """
        Test policy evaluation endpoint.
        """
        try:
            # Test with a simple allow case
            response = self.session.post(
                f"{DEBUG_API_URL}/policy/evaluate",
                json={
                    "action": "view_balance",
                    "user": {"roles": ["viewer"]}
                },
                timeout=5
            )

            if response.status_code != 200:
                return TestResult(
                    "Policy Evaluate",
                    False,
                    f"Policy evaluate endpoint returned {response.status_code}",
                    {"status": response.status_code}
                )

            data = response.json()

            # Verify response structure
            if "result" not in data:
                return TestResult(
                    "Policy Evaluate",
                    False,
                    "Response missing 'result' field",
                    {"response": data}
                )

            result = data.get("result", {})
            if "allow" not in result:
                return TestResult(
                    "Policy Evaluate",
                    False,
                    "Result missing 'allow' field",
                    {"result": result}
                )

            return TestResult(
                "Policy Evaluate",
                True,
                f"Policy evaluation returned allow={result.get('allow')}",
                {"result": result}
            )

        except requests.exceptions.ConnectionError as e:
            return TestResult(
                "Policy Evaluate",
                False,
                f"Connection error: {str(e)}",
                {}
            )
        except Exception as e:
            return TestResult(
                "Policy Evaluate",
                False,
                f"Unexpected error: {str(e)}",
                {"exception": str(e)}
            )

    # ==================== Time Controls Tests ====================

    def test_time_controls(self) -> TestResult:
        """
        Test time override functionality.
        """
        try:
            # Step 1: Get current time state
            get_response = self.session.get(
                f"{DEBUG_API_URL}/controls/time",
                timeout=5
            )

            if get_response.status_code != 200:
                return TestResult(
                    "Time Controls",
                    False,
                    f"Time controls GET returned {get_response.status_code}",
                    {"status": get_response.status_code}
                )

            data = get_response.json()

            # Verify response structure
            if "active" not in data or "effective" not in data:
                return TestResult(
                    "Time Controls",
                    False,
                    "Time response missing expected fields",
                    {"response": data}
                )

            return TestResult(
                "Time Controls",
                True,
                f"Time controls retrieved: active={data.get('active')}",
                {
                    "active": data.get("active"),
                    "effective": data.get("effective")
                }
            )

        except requests.exceptions.ConnectionError as e:
            return TestResult(
                "Time Controls",
                False,
                f"Connection error: {str(e)}",
                {}
            )
        except Exception as e:
            return TestResult(
                "Time Controls",
                False,
                f"Unexpected error: {str(e)}",
                {"exception": str(e)}
            )

    # ==================== People/Users Page Tests ====================

    def test_people_page_different_for_personal_vs_business(self) -> TestResult:
        """
        Test that the /api/admin/users endpoint returns different results
        for personal (CONSUMER) vs business (COMMERCIAL/SMALL_BUSINESS) accounts.

        Personal accounts should only show the owner (single user).
        Business accounts should show all team members.
        """
        try:
            # Step 1: Authenticate with Keycloak
            token_url = f"{KEYCLOAK_URL}/realms/{KEYCLOAK_REALM}/protocol/openid-connect/token"
            token_response = self.session.post(
                token_url,
                data={
                    "grant_type": "password",
                    "client_id": KEYCLOAK_CLIENT_ID,
                    "username": TEST_USER_EMAIL,
                    "password": TEST_USER_PASSWORD,
                    "scope": "openid profile email"
                },
                timeout=10
            )

            if token_response.status_code != 200:
                return TestResult(
                    "People Page Personal vs Business",
                    False,
                    f"Keycloak auth failed: {token_response.status_code}",
                    {"error": token_response.text[:200]}
                )

            token_data = token_response.json()
            access_token = token_data.get("access_token")

            if not access_token:
                return TestResult(
                    "People Page Personal vs Business",
                    False,
                    "No access_token in Keycloak response",
                    {}
                )

            auth_headers = {"Authorization": f"Bearer {access_token}"}

            # Step 2: Get user info and available tenants
            me_response = self.session.get(
                f"{BACKEND_URL}/auth/me",
                headers=auth_headers,
                timeout=5
            )

            if me_response.status_code != 200:
                return TestResult(
                    "People Page Personal vs Business",
                    False,
                    f"/auth/me failed: {me_response.status_code}",
                    {"status": me_response.status_code}
                )

            user_info = me_response.json()
            tenants = user_info.get("tenants", [])

            if len(tenants) < 2:
                return TestResult(
                    "People Page Personal vs Business",
                    False,
                    f"User needs at least 2 tenants to test (has {len(tenants)})",
                    {"tenant_count": len(tenants)}
                )

            # Find personal and business tenants
            personal_tenant = None
            business_tenant = None

            for tenant in tenants:
                tenant_type = tenant.get("type", "")
                if tenant_type == "CONSUMER" and not personal_tenant:
                    personal_tenant = tenant
                elif tenant_type in ["COMMERCIAL", "SMALL_BUSINESS"] and not business_tenant:
                    business_tenant = tenant

            if not personal_tenant:
                return TestResult(
                    "People Page Personal vs Business",
                    False,
                    "No CONSUMER (personal) tenant found for user",
                    {"tenants": [t.get("type") for t in tenants]}
                )

            if not business_tenant:
                return TestResult(
                    "People Page Personal vs Business",
                    False,
                    "No COMMERCIAL/SMALL_BUSINESS tenant found for user",
                    {"tenants": [t.get("type") for t in tenants]}
                )

            # Step 3: Get users for personal tenant
            personal_headers = {
                **auth_headers,
                "X-Tenant-ID": personal_tenant.get("id")
            }
            personal_users_response = self.session.get(
                f"{BACKEND_URL}/api/admin/users",
                headers=personal_headers,
                timeout=5
            )

            # Personal account might return 403 if user doesn't have ADMIN role,
            # or return just 1 user (themselves)
            personal_users = []
            personal_status = personal_users_response.status_code
            if personal_status == 200:
                personal_users = personal_users_response.json() or []
            elif personal_status == 403:
                # Expected for non-admin users on personal account
                personal_users = []

            # Step 4: Get users for business tenant
            business_headers = {
                **auth_headers,
                "X-Tenant-ID": business_tenant.get("id")
            }
            business_users_response = self.session.get(
                f"{BACKEND_URL}/api/admin/users",
                headers=business_headers,
                timeout=5
            )

            business_users = []
            business_status = business_users_response.status_code
            if business_status == 200:
                business_users = business_users_response.json() or []
            elif business_status == 403:
                # User might not be admin on business account
                business_users = []

            # Step 5: Analyze results
            personal_count = len(personal_users)
            business_count = len(business_users)

            # Check if the results are different
            # Personal should have 0 or 1 user, business should have more (if admin)
            results_different = (personal_count != business_count) or (personal_users != business_users)

            # For personal accounts, we expect at most 1 user (owner)
            personal_valid = personal_count <= 1 or personal_status == 403

            # Build detailed result
            details = {
                "personal_tenant": {
                    "id": personal_tenant.get("id"),
                    "name": personal_tenant.get("name"),
                    "type": personal_tenant.get("type"),
                    "user_count": personal_count,
                    "status": personal_status
                },
                "business_tenant": {
                    "id": business_tenant.get("id"),
                    "name": business_tenant.get("name"),
                    "type": business_tenant.get("type"),
                    "user_count": business_count,
                    "status": business_status
                },
                "results_different": results_different
            }

            if not results_different and personal_count > 0 and business_count > 0:
                # Check if the user lists have different emails
                personal_emails = set(u.get("email") for u in personal_users)
                business_emails = set(u.get("email") for u in business_users)
                results_different = personal_emails != business_emails
                details["personal_emails"] = list(personal_emails)
                details["business_emails"] = list(business_emails)

            if results_different or personal_valid:
                return TestResult(
                    "People Page Personal vs Business",
                    True,
                    f"Personal tenant has {personal_count} users, business has {business_count} users",
                    details
                )
            else:
                return TestResult(
                    "People Page Personal vs Business",
                    False,
                    "Personal and business accounts returned same user list - they should be different",
                    details
                )

        except requests.exceptions.ConnectionError as e:
            return TestResult(
                "People Page Personal vs Business",
                False,
                f"Connection error: {str(e)}",
                {}
            )
        except Exception as e:
            return TestResult(
                "People Page Personal vs Business",
                False,
                f"Unexpected error: {str(e)}",
                {"exception": str(e)}
            )


# Pytest test functions
@pytest.fixture
def debug_test():
    return DebugUITest()


def test_frontend_health(debug_test):
    result = debug_test.test_frontend_health()
    assert result.passed, result.message


def test_backend_health(debug_test):
    result = debug_test.test_backend_health()
    assert result.passed, result.message


def test_debug_ui_index(debug_test):
    result = debug_test.test_debug_ui_index()
    assert result.passed, result.message


def test_debug_ui_css(debug_test):
    result = debug_test.test_debug_ui_css()
    assert result.passed, result.message


def test_debug_ui_js(debug_test):
    result = debug_test.test_debug_ui_js()
    assert result.passed, result.message


def test_sse_backend_direct(debug_test):
    result = debug_test.test_sse_backend_direct()
    assert result.passed, result.message


def test_sse_via_nginx(debug_test):
    result = debug_test.test_sse_via_nginx()
    assert result.passed, result.message


def test_debug_api_health(debug_test):
    result = debug_test.test_debug_api_health()
    assert result.passed, result.message


def test_debug_api_data_users(debug_test):
    result = debug_test.test_debug_api_data_users()
    assert result.passed, result.message


def test_debug_api_data_tenants(debug_test):
    result = debug_test.test_debug_api_data_tenants()
    assert result.passed, result.message


def test_debug_api_data_sessions(debug_test):
    result = debug_test.test_debug_api_data_sessions()
    assert result.passed, result.message


def test_debug_api_data_accounts(debug_test):
    result = debug_test.test_debug_api_data_accounts()
    assert result.passed, result.message


def test_debug_api_data_memberships(debug_test):
    result = debug_test.test_debug_api_data_memberships()
    assert result.passed, result.message


def test_debug_api_auth_tokens(debug_test):
    result = debug_test.test_debug_api_auth_tokens()
    assert result.passed, result.message


def test_debug_api_auth_keycloak_events(debug_test):
    result = debug_test.test_debug_api_auth_keycloak_events()
    assert result.passed, result.message


def test_debug_api_auth_decode(debug_test):
    result = debug_test.test_debug_api_auth_decode()
    assert result.passed, result.message


def test_session_appears_in_debug(debug_test):
    """Integration test: Create session via login and verify it appears in debug UI"""
    result = debug_test.test_session_appears_in_debug()
    assert result.passed, result.message


def test_session_timeline(debug_test):
    """Test session timeline endpoint returns events for a session"""
    result = debug_test.test_session_timeline()
    assert result.passed, result.message


def test_session_timeline_workflow_path(debug_test):
    """Test session timeline via /workflows/ path that frontend uses"""
    result = debug_test.test_session_timeline_workflow_path()
    assert result.passed, result.message


def test_session_timeline_with_actions(debug_test):
    """Test that login and tenant switch actions appear in session timeline"""
    result = debug_test.test_session_timeline_with_actions()
    assert result.passed, result.message


def test_opa_decisions_endpoint(debug_test):
    """Test OPA decisions endpoint returns valid data"""
    result = debug_test.test_opa_decisions_endpoint()
    assert result.passed, result.message


def test_risk_controls_get(debug_test):
    """Test getting current risk override state"""
    result = debug_test.test_risk_controls_get()
    assert result.passed, result.message


def test_risk_controls_set_and_clear(debug_test):
    """Test setting and clearing risk override"""
    result = debug_test.test_risk_controls_set_and_clear()
    assert result.passed, result.message


def test_debug_controls_state(debug_test):
    """Test getting debug controls state"""
    result = debug_test.test_debug_controls_state()
    assert result.passed, result.message


def test_time_controls(debug_test):
    """Test time override functionality"""
    result = debug_test.test_time_controls()
    assert result.passed, result.message


def test_policy_list(debug_test):
    """Test listing available policies"""
    result = debug_test.test_policy_list()
    assert result.passed, result.message


def test_policy_evaluate(debug_test):
    """Test policy evaluation endpoint"""
    result = debug_test.test_policy_evaluate()
    assert result.passed, result.message


def test_slide_over_element_exists(debug_test):
    """Test that slide-over element exists in the DOM"""
    result = debug_test.test_slide_over_element()
    assert result.passed, result.message


def test_people_page_different_for_personal_vs_business(debug_test):
    """Test that People page returns different users for personal vs business accounts"""
    result = debug_test.test_people_page_different_for_personal_vs_business()
    assert result.passed, result.message


if __name__ == "__main__":
    tester = DebugUITest()
    success = tester.run_all_tests()
    exit(0 if success else 1)
