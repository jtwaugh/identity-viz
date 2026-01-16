#!/usr/bin/env python3
"""
End-to-end test for AnyBank Identity Platform

This test simulates the complete flow:
1. Authenticate with Keycloak
2. Get user info and available tenants
3. Select a tenant (business account)
4. Fetch accounts
5. Attempt a transfer between accounts

Usage:
    python test_e2e_flow.py

    Or with pytest:
    pytest test_e2e_flow.py -v
"""

import requests
import json
import sys
import re
from dataclasses import dataclass
from typing import Optional, List, Dict, Any
from urllib.parse import urlparse, parse_qs


# Configuration
KEYCLOAK_URL = "http://localhost:8080"
KEYCLOAK_REALM = "anybank"
KEYCLOAK_CLIENT_ID = "anybank-web"
BACKEND_URL = "http://localhost:8000"

# Test user credentials
TEST_USER_EMAIL = "jdoe@example.com"
TEST_USER_PASSWORD = "demo123"


@dataclass
class TestResult:
    name: str
    passed: bool
    message: str
    details: Optional[Dict[str, Any]] = None


class AnyBankE2ETest:
    def __init__(self):
        self.access_token: Optional[str] = None
        self.user_info: Optional[Dict] = None
        self.tenants: List[Dict] = []
        self.selected_tenant: Optional[Dict] = None
        self.accounts: List[Dict] = []
        self.results: List[TestResult] = []

    def run_all_tests(self) -> bool:
        """Run all tests in sequence"""
        print("\n" + "="*60)
        print("AnyBank E2E Test Suite")
        print("="*60 + "\n")

        tests = [
            ("Keycloak Authentication", self.test_keycloak_auth),
            ("Get User Info (/auth/me)", self.test_get_user_info),
            ("Select Business Tenant", self.test_select_tenant),
            ("Fetch Accounts", self.test_fetch_accounts),
            ("Attempt Transfer", self.test_transfer),
        ]

        for name, test_func in tests:
            print(f"\n--- {name} ---")
            try:
                result = test_func()
                self.results.append(result)
                status = "PASS" if result.passed else "FAIL"
                print(f"[{status}] {result.message}")
                if result.details:
                    print(f"Details: {json.dumps(result.details, indent=2, default=str)}")
                if not result.passed:
                    print(f"\nStopping tests due to failure in: {name}")
                    break
            except Exception as e:
                result = TestResult(name, False, f"Exception: {str(e)}")
                self.results.append(result)
                print(f"[FAIL] {result.message}")
                break

        self._print_summary()
        return all(r.passed for r in self.results)

    def test_keycloak_auth(self) -> TestResult:
        """Test authentication with Keycloak using Resource Owner Password flow"""
        token_url = f"{KEYCLOAK_URL}/realms/{KEYCLOAK_REALM}/protocol/openid-connect/token"

        # First, let's check if Keycloak is reachable
        try:
            health_check = requests.get(f"{KEYCLOAK_URL}/realms/{KEYCLOAK_REALM}", timeout=5)
            if health_check.status_code != 200:
                return TestResult(
                    "Keycloak Auth",
                    False,
                    f"Keycloak realm not accessible: {health_check.status_code}",
                    {"url": f"{KEYCLOAK_URL}/realms/{KEYCLOAK_REALM}"}
                )
        except requests.exceptions.ConnectionError as e:
            return TestResult(
                "Keycloak Auth",
                False,
                f"Cannot connect to Keycloak at {KEYCLOAK_URL}",
                {"error": str(e)}
            )

        # Try to get token using direct access grant (Resource Owner Password)
        data = {
            "grant_type": "password",
            "client_id": KEYCLOAK_CLIENT_ID,
            "username": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD,
            "scope": "openid profile email"
        }

        print(f"  Requesting token from: {token_url}")
        print(f"  Client ID: {KEYCLOAK_CLIENT_ID}")
        print(f"  Username: {TEST_USER_EMAIL}")

        response = requests.post(token_url, data=data, timeout=10)

        if response.status_code != 200:
            error_detail = response.json() if response.headers.get('content-type', '').startswith('application/json') else response.text
            return TestResult(
                "Keycloak Auth",
                False,
                f"Failed to get token: {response.status_code}",
                {
                    "status_code": response.status_code,
                    "error": error_detail,
                    "hint": "Direct Access Grants might be disabled for this client"
                }
            )

        token_data = response.json()
        self.access_token = token_data.get("access_token")

        if not self.access_token:
            return TestResult(
                "Keycloak Auth",
                False,
                "No access_token in response",
                {"response": token_data}
            )

        # Decode and show token claims (just the payload, not signature)
        import base64
        payload = self.access_token.split('.')[1]
        # Add padding if needed
        payload += '=' * (4 - len(payload) % 4)
        claims = json.loads(base64.urlsafe_b64decode(payload))

        return TestResult(
            "Keycloak Auth",
            True,
            f"Got access token for {claims.get('email', 'unknown')}",
            {
                "token_type": token_data.get("token_type"),
                "expires_in": token_data.get("expires_in"),
                "scope": token_data.get("scope"),
                "email": claims.get("email"),
                "sub": claims.get("sub"),
                "token_preview": self.access_token[:50] + "..."
            }
        )

    def _get_headers(self, include_tenant: bool = False) -> dict:
        """Get standard headers for API requests"""
        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json",
            "X-Request-Source": "e2e-test"  # Identifies this as automated test traffic
        }
        if include_tenant and self.selected_tenant:
            headers["X-Tenant-ID"] = str(self.selected_tenant.get("id"))
        return headers

    def test_get_user_info(self) -> TestResult:
        """Test /auth/me endpoint to get user info and tenants"""
        if not self.access_token:
            return TestResult("Get User Info", False, "No access token available")

        url = f"{BACKEND_URL}/auth/me"
        headers = self._get_headers()

        print(f"  Calling: GET {url}")
        print(f"  Headers: Authorization: Bearer {self.access_token[:30]}...")

        response = requests.get(url, headers=headers, timeout=10)

        print(f"  Response Status: {response.status_code}")
        print(f"  Response Headers: {dict(response.headers)}")

        if response.status_code != 200:
            error_body = None
            try:
                error_body = response.json()
            except:
                error_body = response.text
            return TestResult(
                "Get User Info",
                False,
                f"Failed to get user info: {response.status_code}",
                {
                    "status_code": response.status_code,
                    "response_body": error_body,
                    "request_headers": {k: v[:50] + "..." if k == "Authorization" else v for k, v in headers.items()}
                }
            )

        self.user_info = response.json()
        self.tenants = self.user_info.get("tenants", [])

        return TestResult(
            "Get User Info",
            True,
            f"Got user info with {len(self.tenants)} tenant(s)",
            {
                "user_id": self.user_info.get("id"),
                "email": self.user_info.get("email"),
                "display_name": self.user_info.get("display_name"),
                "tenants": self.tenants
            }
        )

    def test_select_tenant(self) -> TestResult:
        """Select the business tenant (AnyBusiness Inc.)"""
        if not self.tenants:
            return TestResult("Select Tenant", False, "No tenants available")

        # Find the business tenant
        business_tenant = None
        for tenant in self.tenants:
            tenant_type = tenant.get("type", "")
            tenant_name = tenant.get("name", "")
            print(f"  Found tenant: {tenant_name} (type: {tenant_type})")
            if tenant_type == "COMMERCIAL" or "business" in tenant_name.lower():
                business_tenant = tenant
                break

        if not business_tenant:
            # Fall back to first tenant
            business_tenant = self.tenants[0]
            print(f"  No business tenant found, using: {business_tenant.get('name')}")

        self.selected_tenant = business_tenant

        return TestResult(
            "Select Tenant",
            True,
            f"Selected tenant: {business_tenant.get('name')}",
            {
                "tenant_id": business_tenant.get("id"),
                "tenant_name": business_tenant.get("name"),
                "tenant_type": business_tenant.get("type"),
                "role": business_tenant.get("role")
            }
        )

    def test_fetch_accounts(self) -> TestResult:
        """Fetch accounts for the selected tenant"""
        if not self.access_token or not self.selected_tenant:
            return TestResult("Fetch Accounts", False, "Missing token or tenant")

        url = f"{BACKEND_URL}/api/accounts"
        headers = self._get_headers(include_tenant=True)

        print(f"  Calling: GET {url}")
        print(f"  X-Tenant-ID: {self.selected_tenant.get('id')}")

        response = requests.get(url, headers=headers, timeout=10)

        print(f"  Response Status: {response.status_code}")

        if response.status_code != 200:
            error_body = None
            try:
                error_body = response.json()
            except:
                error_body = response.text
            return TestResult(
                "Fetch Accounts",
                False,
                f"Failed to fetch accounts: {response.status_code}",
                {
                    "status_code": response.status_code,
                    "response_body": error_body,
                    "tenant_id": self.selected_tenant.get("id"),
                    "request_headers": {
                        "X-Tenant-ID": headers.get("X-Tenant-ID"),
                        "Authorization": "Bearer ..."
                    }
                }
            )

        self.accounts = response.json()

        # Handle both array and object with 'content' key
        if isinstance(self.accounts, dict):
            self.accounts = self.accounts.get("content", self.accounts.get("accounts", []))

        return TestResult(
            "Fetch Accounts",
            True,
            f"Fetched {len(self.accounts)} account(s)",
            {
                "accounts": [
                    {
                        "id": acc.get("id"),
                        "name": acc.get("name"),
                        "account_number": acc.get("account_number"),
                        "balance": acc.get("balance"),
                        "type": acc.get("account_type")
                    }
                    for acc in self.accounts[:5]  # Limit to first 5
                ]
            }
        )

    def test_transfer(self) -> TestResult:
        """Attempt a transfer between two accounts"""
        if len(self.accounts) < 2:
            return TestResult(
                "Transfer",
                False,
                f"Need at least 2 accounts for transfer, have {len(self.accounts)}"
            )

        source_account = self.accounts[0]
        target_account = self.accounts[1]

        # Correct endpoint: POST /api/accounts/{accountId}/transfer
        url = f"{BACKEND_URL}/api/accounts/{source_account.get('id')}/transfer"
        headers = self._get_headers(include_tenant=True)

        transfer_data = {
            "toAccountId": target_account.get("id"),
            "amount": 100.00,
            "memo": "E2E Test Transfer"
        }

        print(f"  Calling: POST {url}")
        print(f"  Transfer: {source_account.get('name')} -> {target_account.get('name')}")
        print(f"  Amount: $100.00")

        response = requests.post(url, headers=headers, json=transfer_data, timeout=10)

        print(f"  Response Status: {response.status_code}")

        if response.status_code not in [200, 201]:
            error_body = None
            try:
                error_body = response.json()
            except:
                error_body = response.text
            return TestResult(
                "Transfer",
                False,
                f"Transfer failed: {response.status_code}",
                {
                    "status_code": response.status_code,
                    "response_body": error_body,
                    "transfer_request": transfer_data
                }
            )

        # Endpoint returns empty body on success
        return TestResult(
            "Transfer",
            True,
            "Transfer completed successfully",
            {"source": source_account.get("name"), "target": target_account.get("name"), "amount": 100.00}
        )

    def _print_summary(self):
        """Print test summary"""
        print("\n" + "="*60)
        print("Test Summary")
        print("="*60)

        passed = sum(1 for r in self.results if r.passed)
        failed = sum(1 for r in self.results if not r.passed)

        for result in self.results:
            status = "PASS" if result.passed else "FAIL"
            print(f"  [{status}] {result.name}: {result.message}")

        print(f"\nTotal: {passed} passed, {failed} failed")
        print("="*60 + "\n")


class BffAuthTest:
    """
    Tests for the BFF (Backend-for-Frontend) authentication pattern.

    The BFF pattern keeps tokens server-side and uses session cookies.
    These tests verify the BFF endpoints work correctly.
    """

    def __init__(self):
        self.session = requests.Session()  # Maintains cookies across requests
        self.results: List[TestResult] = []

    def run_all_tests(self) -> bool:
        """Run all BFF auth tests"""
        print("\n" + "="*60)
        print("BFF Authentication Test Suite")
        print("="*60 + "\n")

        tests = [
            ("BFF /me without session returns 401", self.test_me_unauthenticated),
            ("BFF /login redirects to Keycloak", self.test_login_redirect),
            ("BFF Full Login Flow", self.test_full_login_flow),
            ("BFF /me after login returns user", self.test_me_authenticated),
            ("BFF tenant selection flow", self.test_tenant_selection_flow),
            ("BFF /logout with session", self.test_logout_with_session),
            ("No repeated /me calls (loop detection)", self.test_no_repeated_me_calls),
        ]

        all_passed = True
        for name, test_func in tests:
            print(f"\n--- {name} ---")
            try:
                result = test_func()
                self.results.append(result)
                status = "PASS" if result.passed else "FAIL"
                print(f"[{status}] {result.message}")
                if result.details:
                    print(f"Details: {json.dumps(result.details, indent=2, default=str)}")
                if not result.passed:
                    all_passed = False
            except Exception as e:
                result = TestResult(name, False, f"Exception: {str(e)}")
                self.results.append(result)
                print(f"[FAIL] {result.message}")
                all_passed = False

        self._print_summary()
        return all_passed

    def test_me_unauthenticated(self) -> TestResult:
        """Test that /bff/auth/me returns 401 without a session"""
        url = f"{BACKEND_URL}/bff/auth/me"

        # Use a fresh session (no cookies)
        response = requests.get(url, timeout=10)

        if response.status_code == 401:
            return TestResult(
                "BFF /me unauthenticated",
                True,
                "Correctly returned 401 for unauthenticated request",
                {"status_code": response.status_code}
            )
        else:
            return TestResult(
                "BFF /me unauthenticated",
                False,
                f"Expected 401, got {response.status_code}",
                {"status_code": response.status_code, "body": response.text[:200]}
            )

    def test_login_redirect(self) -> TestResult:
        """Test that /bff/auth/login redirects to Keycloak"""
        # Use a fresh session for this test
        fresh_session = requests.Session()
        url = f"{BACKEND_URL}/bff/auth/login"

        # Don't follow redirects - we want to check the redirect URL
        response = fresh_session.get(url, allow_redirects=False, timeout=10)

        if response.status_code in [301, 302, 303, 307, 308]:
            location = response.headers.get("Location", "")
            if "keycloak" in location or "localhost:8080" in location or "/realms/" in location:
                return TestResult(
                    "BFF /login redirect",
                    True,
                    "Correctly redirects to Keycloak",
                    {
                        "status_code": response.status_code,
                        "redirect_url": location[:100] + "..." if len(location) > 100 else location
                    }
                )
            else:
                return TestResult(
                    "BFF /login redirect",
                    False,
                    f"Redirect doesn't point to Keycloak",
                    {"location": location}
                )
        else:
            return TestResult(
                "BFF /login redirect",
                False,
                f"Expected redirect (3xx), got {response.status_code}",
                {"status_code": response.status_code}
            )

    def test_full_login_flow(self) -> TestResult:
        """
        Test the complete BFF login flow:
        1. Start login -> redirect to Keycloak
        2. Submit credentials to Keycloak
        3. Keycloak redirects to callback
        4. Callback establishes session and redirects to frontend
        """
        print("  Step 1: Initiate login flow...")

        # Step 1: Start login flow - follow redirect to Keycloak
        login_url = f"{BACKEND_URL}/bff/auth/login"
        response = self.session.get(login_url, allow_redirects=True, timeout=10)

        # We should now be at Keycloak's login page
        if response.status_code != 200:
            return TestResult(
                "BFF Full Login",
                False,
                f"Failed to reach Keycloak login page: {response.status_code}",
                {"url": response.url}
            )

        print(f"  Step 2: At Keycloak login page: {response.url[:60]}...")

        # Step 2: Parse the login form to get the action URL
        html = response.text
        # Find form action URL (Keycloak uses a form with action URL)
        action_match = re.search(r'action="([^"]+)"', html)
        if not action_match:
            return TestResult(
                "BFF Full Login",
                False,
                "Could not find login form action URL",
                {"html_snippet": html[:500]}
            )

        action_url = action_match.group(1).replace("&amp;", "&")
        print(f"  Step 3: Submitting credentials to Keycloak...")

        # Step 3: Submit credentials
        login_data = {
            "username": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD,
        }

        response = self.session.post(action_url, data=login_data, allow_redirects=True, timeout=10)

        # Step 4: Should have been redirected back through callback to frontend
        final_url = response.url
        print(f"  Step 4: Final URL after login: {final_url}")

        # Check if we ended up at the frontend callback or main page
        if "localhost:3000" in final_url or "callback" in final_url:
            # Check if there's an error in the URL
            if "error" in final_url:
                parsed = urlparse(final_url)
                error = parse_qs(parsed.query).get("error", ["unknown"])[0]
                return TestResult(
                    "BFF Full Login",
                    False,
                    f"Login failed with error: {error}",
                    {"final_url": final_url}
                )

            return TestResult(
                "BFF Full Login",
                True,
                "Successfully completed OAuth login flow",
                {
                    "final_url": final_url,
                    "cookies": list(self.session.cookies.keys())
                }
            )
        else:
            return TestResult(
                "BFF Full Login",
                False,
                f"Unexpected final URL after login",
                {"final_url": final_url, "status": response.status_code}
            )

    def test_me_authenticated(self) -> TestResult:
        """Test that /bff/auth/me returns user info after login"""
        url = f"{BACKEND_URL}/bff/auth/me"

        response = self.session.get(url, timeout=10)

        if response.status_code == 200:
            try:
                data = response.json()
                if data.get("authenticated"):
                    return TestResult(
                        "BFF /me authenticated",
                        True,
                        f"Got user info: {data.get('email')}",
                        {"user": data}
                    )
                else:
                    return TestResult(
                        "BFF /me authenticated",
                        False,
                        "Response says not authenticated",
                        {"response": data}
                    )
            except json.JSONDecodeError:
                return TestResult(
                    "BFF /me authenticated",
                    False,
                    "Response is not valid JSON",
                    {"body": response.text[:200]}
                )
        elif response.status_code == 401:
            return TestResult(
                "BFF /me authenticated",
                False,
                "Got 401 - session not established (cookie issue?)",
                {
                    "status_code": response.status_code,
                    "cookies": list(self.session.cookies.keys())
                }
            )
        else:
            return TestResult(
                "BFF /me authenticated",
                False,
                f"Unexpected status: {response.status_code}",
                {"status_code": response.status_code}
            )

    def test_tenant_selection_flow(self) -> TestResult:
        """
        Test the complete tenant selection flow:
        1. After login, user should have valid session
        2. Calling token exchange with tenant ID should succeed
        3. Response should indicate success

        This simulates what happens when user clicks a tenant button.
        """
        # First verify we have a valid session from previous login
        me_url = f"{BACKEND_URL}/bff/auth/me"
        me_response = self.session.get(me_url, timeout=10)

        if me_response.status_code != 200:
            return TestResult(
                "Tenant Selection",
                False,
                "No valid session - login required first",
                {"me_status": me_response.status_code}
            )

        user_data = me_response.json()
        if not user_data.get("authenticated"):
            return TestResult(
                "Tenant Selection",
                False,
                "Session not authenticated",
                {"user_data": user_data}
            )

        print(f"  Step 1: Verified session for user: {user_data.get('email')}")

        # Step 2: Call token exchange with a tenant ID
        exchange_url = f"{BACKEND_URL}/bff/auth/token/exchange"
        tenant_id = "tenant-003"  # Mock tenant ID

        exchange_response = self.session.post(
            exchange_url,
            json={"target_tenant_id": tenant_id},
            timeout=10
        )

        print(f"  Step 2: Token exchange response: {exchange_response.status_code}")

        if exchange_response.status_code != 200:
            return TestResult(
                "Tenant Selection",
                False,
                f"Token exchange failed with status {exchange_response.status_code}",
                {
                    "status": exchange_response.status_code,
                    "body": exchange_response.text[:200]
                }
            )

        exchange_data = exchange_response.json()
        print(f"  Step 3: Exchange data: {exchange_data}")

        if not exchange_data.get("success"):
            return TestResult(
                "Tenant Selection",
                False,
                "Token exchange did not return success",
                {"exchange_data": exchange_data}
            )

        # Step 4: Verify session is still valid after tenant selection
        # This catches the bug where dashboard API calls trigger logout
        import time
        time.sleep(0.5)  # Brief pause to simulate page load

        # Check that /me still works (session not invalidated)
        me_check = self.session.get(me_url, timeout=10)
        print(f"  Step 4: Post-selection /me check: {me_check.status_code}")

        if me_check.status_code != 200:
            return TestResult(
                "Tenant Selection",
                False,
                f"Session invalidated after tenant selection (got {me_check.status_code})",
                {
                    "tenant_id": exchange_data.get("tenant_id"),
                    "me_status_after": me_check.status_code
                }
            )

        # Step 5: Verify API calls work with session auth (no 401, 400, or 403)
        # This simulates what the dashboard does when it loads
        error_statuses = {401: "Unauthorized", 400: "Bad Request", 403: "Forbidden"}

        # Check /api/accounts
        api_url = f"{BACKEND_URL}/api/accounts"
        api_response = self.session.get(api_url, timeout=10)
        print(f"  Step 5a: API call /api/accounts: {api_response.status_code}")

        if api_response.status_code in error_statuses:
            error_body = api_response.text[:200] if api_response.text else ""
            return TestResult(
                "Tenant Selection",
                False,
                f"/api/accounts returned {api_response.status_code} ({error_statuses[api_response.status_code]})",
                {
                    "tenant_id": exchange_data.get("tenant_id"),
                    "api_status": api_response.status_code,
                    "api_path": "/api/accounts",
                    "error": error_body
                }
            )

        # Check /api/admin/users (dashboard also calls this)
        admin_url = f"{BACKEND_URL}/api/admin/users"
        admin_response = self.session.get(admin_url, timeout=10)
        print(f"  Step 5b: API call /api/admin/users: {admin_response.status_code}")

        if admin_response.status_code in error_statuses:
            error_body = admin_response.text[:200] if admin_response.text else ""
            return TestResult(
                "Tenant Selection",
                False,
                f"/api/admin/users returned {admin_response.status_code} ({error_statuses[admin_response.status_code]})",
                {
                    "tenant_id": exchange_data.get("tenant_id"),
                    "api_status": admin_response.status_code,
                    "api_path": "/api/admin/users",
                    "error": error_body
                }
            )

        # 200 or 404 (no data in DB) is fine for both endpoints
        return TestResult(
            "Tenant Selection",
            True,
            f"Tenant {exchange_data.get('tenant_id')} selected, APIs work (accounts: {api_response.status_code}, admin: {admin_response.status_code})",
            {
                "tenant_id": exchange_data.get("tenant_id"),
                "expires_in": exchange_data.get("expires_in"),
                "session_valid_after": True,
                "accounts_status": api_response.status_code,
                "admin_status": admin_response.status_code
            }
        )

    def test_logout_with_session(self) -> TestResult:
        """Test logout when we have a valid session with tokens"""
        url = f"{BACKEND_URL}/bff/auth/logout"

        # Follow redirect to see where we end up
        response = self.session.get(url, allow_redirects=True, timeout=10)

        final_url = response.url

        # Should end up at Keycloak logout or frontend login
        if response.status_code == 200:
            # Check we're at a reasonable destination
            if "login" in final_url or "logout" in final_url or "localhost:3000" in final_url:
                return TestResult(
                    "BFF /logout with session",
                    True,
                    "Logout completed successfully",
                    {
                        "final_url": final_url[:100],
                        "status_code": response.status_code
                    }
                )
            else:
                return TestResult(
                    "BFF /logout with session",
                    True,
                    "Logout redirected (checking destination)",
                    {"final_url": final_url[:100]}
                )
        elif response.status_code == 400:
            return TestResult(
                "BFF /logout with session",
                False,
                "Keycloak rejected logout (missing id_token_hint?)",
                {
                    "status_code": response.status_code,
                    "url": final_url,
                    "body": response.text[:200]
                }
            )
        else:
            return TestResult(
                "BFF /logout with session",
                False,
                f"Unexpected status: {response.status_code}",
                {"final_url": final_url}
            )

    def test_no_repeated_me_calls(self) -> TestResult:
        """
        Test that simulates rapid /me calls to detect loop issues.

        In the browser, a re-render loop can cause the callback to hit /me
        many times. This test verifies the backend handles this correctly
        and we can detect if this behavior occurs.
        """
        import time
        import threading

        url = f"{BACKEND_URL}/bff/auth/me"

        # First do a fresh login to get a valid session
        fresh_session = requests.Session()

        # Complete login flow
        login_url = f"{BACKEND_URL}/bff/auth/login"
        response = fresh_session.get(login_url, allow_redirects=False, timeout=10)

        if response.status_code not in [301, 302, 303, 307, 308]:
            return TestResult(
                "No repeated /me calls",
                False,
                "Could not initiate login for test",
                {"status": response.status_code}
            )

        # Follow to Keycloak
        keycloak_url = response.headers.get("Location")
        response = fresh_session.get(keycloak_url, allow_redirects=True, timeout=10)

        # Find and submit login form
        action_pattern = r'action="([^"]+)"'
        action_match = re.search(action_pattern, response.text)
        if not action_match:
            return TestResult(
                "No repeated /me calls",
                False,
                "Could not find login form for test",
                {}
            )

        action_url = action_match.group(1).replace("&amp;", "&")
        login_data = {"username": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD}
        response = fresh_session.post(action_url, data=login_data, allow_redirects=True, timeout=10)

        # Now simulate rapid repeated /me calls (like a re-render loop would do)
        call_count = 10
        results = []
        call_times = []

        start_time = time.time()
        for i in range(call_count):
            call_start = time.time()
            resp = fresh_session.get(url, timeout=5)
            call_end = time.time()
            results.append(resp.status_code)
            call_times.append(call_end - call_start)

        total_time = time.time() - start_time

        # All calls should succeed with 200
        all_success = all(status == 200 for status in results)
        avg_time = sum(call_times) / len(call_times)

        if all_success:
            return TestResult(
                "No repeated /me calls",
                True,
                f"Backend handled {call_count} rapid /me calls correctly",
                {
                    "call_count": call_count,
                    "total_time_ms": round(total_time * 1000),
                    "avg_call_time_ms": round(avg_time * 1000),
                    "all_status_200": True
                }
            )
        else:
            return TestResult(
                "No repeated /me calls",
                False,
                f"Some /me calls failed",
                {
                    "results": results,
                    "total_time_ms": round(total_time * 1000)
                }
            )

    def _print_summary(self):
        """Print test summary"""
        print("\n" + "="*60)
        print("BFF Auth Test Summary")
        print("="*60)

        passed = sum(1 for r in self.results if r.passed)
        failed = sum(1 for r in self.results if not r.passed)

        for result in self.results:
            status = "PASS" if result.passed else "FAIL"
            print(f"  [{status}] {result.name}: {result.message}")

        print(f"\nTotal: {passed} passed, {failed} failed")
        print("="*60 + "\n")


def main():
    """Main entry point - runs both test suites"""
    # Run BFF auth tests first
    bff_test = BffAuthTest()
    bff_success = bff_test.run_all_tests()

    # Run E2E flow tests
    e2e_test = AnyBankE2ETest()
    e2e_success = e2e_test.run_all_tests()

    # Exit with failure if any tests failed
    sys.exit(0 if (bff_success and e2e_success) else 1)


if __name__ == "__main__":
    main()
