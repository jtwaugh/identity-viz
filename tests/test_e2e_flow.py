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
from dataclasses import dataclass
from typing import Optional, List, Dict, Any


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

    def test_get_user_info(self) -> TestResult:
        """Test /auth/me endpoint to get user info and tenants"""
        if not self.access_token:
            return TestResult("Get User Info", False, "No access token available")

        url = f"{BACKEND_URL}/auth/me"
        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json"
        }

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
        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json",
            "X-Tenant-ID": str(self.selected_tenant.get("id"))
        }

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
        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json",
            "X-Tenant-ID": str(self.selected_tenant.get("id"))
        }

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


def main():
    """Main entry point"""
    test = AnyBankE2ETest()
    success = test.run_all_tests()
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
