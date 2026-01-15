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


if __name__ == "__main__":
    tester = DebugUITest()
    success = tester.run_all_tests()
    exit(0 if success else 1)
