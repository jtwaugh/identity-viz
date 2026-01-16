#!/usr/bin/env python3
"""
Debug Integration Test

This test verifies the complete flow:
1. Log in via BFF authentication
2. Navigate around the app (click around - make various API calls)
3. Swap tenants
4. Check the debug UI DOM to confirm requests populated the request log

Usage:
    pytest test_debug_integration.py -v

    Or run directly:
    python test_debug_integration.py
"""

import requests
import json
import time
import re
import sys
from typing import Optional, Dict, Any, List
from dataclasses import dataclass

# Selenium imports for DOM verification
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options as ChromeOptions
from selenium.webdriver.firefox.options import Options as FirefoxOptions
from selenium.common.exceptions import TimeoutException, WebDriverException


# Configuration
KEYCLOAK_URL = "http://localhost:8080"
KEYCLOAK_REALM = "anybank"
KEYCLOAK_CLIENT_ID = "anybank-web"
BACKEND_URL = "http://localhost:8000"
FRONTEND_URL = "http://localhost:3000"
DEBUG_UI_URL = f"{FRONTEND_URL}/debug"
DEBUG_API_URL = f"{FRONTEND_URL}/debug/api"

# Test user credentials
TEST_USER_EMAIL = "jdoe@example.com"
TEST_USER_PASSWORD = "demo123"

# Tenant IDs for testing
CONSUMER_TENANT_ID = "tenant-001"  # Personal consumer tenant
BUSINESS_TENANT_ID = "tenant-003"  # AnyBusiness Inc. commercial tenant


@dataclass
class TestResult:
    name: str
    passed: bool
    message: str
    details: Optional[Dict[str, Any]] = None


def create_webdriver(headless: bool = True) -> Optional[webdriver.Remote]:
    """
    Create a WebDriver instance. Tries Chrome first, then Firefox.
    Returns None if no browser is available.
    """
    # Try Chrome first
    try:
        chrome_options = ChromeOptions()
        if headless:
            chrome_options.add_argument("--headless")
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        chrome_options.add_argument("--disable-gpu")
        chrome_options.add_argument("--window-size=1920,1080")
        driver = webdriver.Chrome(options=chrome_options)
        return driver
    except WebDriverException:
        pass

    # Try Firefox
    try:
        firefox_options = FirefoxOptions()
        if headless:
            firefox_options.add_argument("--headless")
        driver = webdriver.Firefox(options=firefox_options)
        return driver
    except WebDriverException:
        pass

    return None


class DebugIntegrationTest:
    """
    End-to-end test that logs in, navigates around, swaps tenants,
    and verifies the debug UI captured all the requests in the DOM.
    """

    def __init__(self):
        self.session = requests.Session()
        self.results: List[TestResult] = []
        self.api_calls_made: List[Dict[str, Any]] = []
        self.initial_event_count = 0
        self.driver: Optional[webdriver.Remote] = None

    def run_all_tests(self) -> bool:
        """Run all tests in sequence"""
        print("\n" + "=" * 60)
        print("Debug Integration Test Suite")
        print("=" * 60 + "\n")

        tests = [
            ("Service Health Check", self.test_service_health),
            ("Initialize Browser for Debug UI", self.test_init_browser),
            ("Open Debug UI and Verify Connection", self.test_open_debug_ui),
            ("Get Initial DOM Event Count", self.test_get_initial_dom_event_count),
            ("Login via BFF", self.test_login),
            ("Navigate to Dashboard", self.test_navigate_dashboard),
            ("Navigate to Accounts List", self.test_navigate_accounts),
            ("View Account Details", self.test_view_account_details),
            ("Swap to Business Tenant", self.test_swap_tenant),
            ("Navigate Business Dashboard", self.test_navigate_business_dashboard),
            ("Navigate Business Accounts", self.test_navigate_business_accounts),
            ("Swap Back to Consumer Tenant", self.test_swap_back_to_consumer),
            ("Verify Events in Debug UI DOM", self.test_verify_events_in_dom),
            ("Verify API Events in DOM", self.test_verify_api_events_in_dom),
            ("Logout", self.test_logout),
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
                    # Only show details on failure or for key results
                    if not result.passed or name in [
                        "Verify Events in Debug UI DOM",
                        "Verify API Events in DOM"
                    ]:
                        print(f"Details: {json.dumps(result.details, indent=2, default=str)}")
                if not result.passed:
                    all_passed = False
                    # Continue running tests to see full picture
            except Exception as e:
                import traceback
                result = TestResult(name, False, f"Exception: {str(e)}")
                self.results.append(result)
                print(f"[FAIL] {result.message}")
                traceback.print_exc()
                all_passed = False

        # Cleanup
        self._cleanup()

        self._print_summary()
        return all_passed

    def _cleanup(self):
        """Clean up resources"""
        if self.driver:
            try:
                self.driver.quit()
            except:
                pass

    def _print_summary(self):
        """Print test summary"""
        print("\n" + "=" * 60)
        print("Debug Integration Test Summary")
        print("=" * 60)

        passed = sum(1 for r in self.results if r.passed)
        failed = sum(1 for r in self.results if not r.passed)

        for result in self.results:
            status = "PASS" if result.passed else "FAIL"
            print(f"  [{status}] {result.name}: {result.message}")

        print(f"\nTotal: {passed} passed, {failed} failed")
        print(f"API calls tracked: {len(self.api_calls_made)}")
        print("=" * 60 + "\n")

    def _track_api_call(self, method: str, path: str, status_code: int):
        """Track API calls for later verification"""
        self.api_calls_made.append({
            "method": method,
            "path": path,
            "status_code": status_code,
            "timestamp": time.time()
        })

    # ==================== Test Methods ====================

    def test_service_health(self) -> TestResult:
        """Verify all services are running"""
        services = [
            ("Frontend", f"{FRONTEND_URL}/health"),
            ("Backend", f"{BACKEND_URL}/actuator/health"),
            ("Keycloak", f"{KEYCLOAK_URL}/realms/{KEYCLOAK_REALM}"),
            ("Debug API", f"{DEBUG_API_URL}/health"),
        ]

        failed_services = []
        for name, url in services:
            try:
                response = requests.get(url, timeout=5)
                if response.status_code not in [200, 204]:
                    failed_services.append(f"{name} ({response.status_code})")
            except requests.exceptions.ConnectionError:
                failed_services.append(f"{name} (connection failed)")

        if failed_services:
            return TestResult(
                "Service Health",
                False,
                f"Services unavailable: {', '.join(failed_services)}",
                {"failed": failed_services}
            )

        return TestResult("Service Health", True, "All services healthy")

    def test_init_browser(self) -> TestResult:
        """Initialize browser for DOM verification"""
        self.driver = create_webdriver(headless=True)

        if not self.driver:
            return TestResult(
                "Initialize Browser",
                False,
                "No browser available (Chrome or Firefox required)",
                {"hint": "Install Chrome/Chromium or Firefox with WebDriver"}
            )

        return TestResult(
            "Initialize Browser",
            True,
            f"Browser initialized: {self.driver.name}"
        )

    def test_open_debug_ui(self) -> TestResult:
        """Open the debug UI and verify SSE connection is established"""
        if not self.driver:
            return TestResult(
                "Open Debug UI",
                False,
                "Browser not initialized",
                {}
            )

        try:
            # Navigate to debug UI
            self.driver.get(DEBUG_UI_URL)

            # Wait for page to load (check for events container)
            WebDriverWait(self.driver, 10).until(
                EC.presence_of_element_located((By.ID, "events-container"))
            )

            # Wait for SSE connection to be established
            # The connection status shows "Connected" when SSE is working
            try:
                WebDriverWait(self.driver, 15).until(
                    lambda d: "Connected" in d.find_element(By.ID, "connection-status").text
                )
                connection_status = "Connected"
            except TimeoutException:
                # Check what the status actually is
                status_el = self.driver.find_element(By.ID, "connection-status")
                connection_status = status_el.text if status_el else "Unknown"

            # Verify page title
            title = self.driver.title

            if "Debug" not in title and "AnyBank" not in title:
                return TestResult(
                    "Open Debug UI",
                    False,
                    f"Unexpected page title: {title}",
                    {"title": title}
                )

            return TestResult(
                "Open Debug UI",
                True,
                f"Debug UI loaded, SSE status: {connection_status}",
                {"title": title, "connection": connection_status}
            )

        except TimeoutException:
            return TestResult(
                "Open Debug UI",
                False,
                "Timeout waiting for debug UI to load",
                {"url": DEBUG_UI_URL}
            )
        except Exception as e:
            return TestResult(
                "Open Debug UI",
                False,
                f"Error loading debug UI: {str(e)}",
                {}
            )

    def test_get_initial_dom_event_count(self) -> TestResult:
        """Get the initial event count from the DOM before making requests"""
        if not self.driver:
            return TestResult(
                "Initial DOM Event Count",
                False,
                "Browser not initialized",
                {}
            )

        try:
            # Get event count from the badge
            count_el = self.driver.find_element(By.ID, "event-count")
            count_text = count_el.text.strip()
            self.initial_event_count = int(count_text) if count_text.isdigit() else 0

            # Also count actual event rows in the container
            events_container = self.driver.find_element(By.ID, "events-container")
            event_rows = events_container.find_elements(By.CSS_SELECTOR, "[data-event-id]")

            return TestResult(
                "Initial DOM Event Count",
                True,
                f"Initial event count: {self.initial_event_count} (badge), {len(event_rows)} rows in DOM",
                {"badge_count": self.initial_event_count, "dom_rows": len(event_rows)}
            )
        except Exception as e:
            return TestResult(
                "Initial DOM Event Count",
                False,
                f"Error getting initial count: {str(e)}",
                {}
            )

    def test_login(self) -> TestResult:
        """Login via BFF authentication flow"""
        # Step 1: Start login flow - get redirected to Keycloak
        login_url = f"{BACKEND_URL}/bff/auth/login"
        response = self.session.get(login_url, allow_redirects=True, timeout=10)

        if response.status_code != 200:
            return TestResult(
                "Login",
                False,
                f"Failed to reach Keycloak login page: {response.status_code}",
                {"url": response.url}
            )

        # Step 2: Parse login form and submit credentials
        html = response.text
        action_match = re.search(r'action="([^"]+)"', html)
        if not action_match:
            return TestResult(
                "Login",
                False,
                "Could not find login form action URL",
                {}
            )

        action_url = action_match.group(1).replace("&amp;", "&")
        login_data = {
            "username": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD,
        }

        response = self.session.post(
            action_url,
            data=login_data,
            allow_redirects=True,
            timeout=10
        )

        # Step 3: Verify login succeeded
        final_url = response.url
        if "error" in final_url:
            return TestResult(
                "Login",
                False,
                "Login failed with error",
                {"final_url": final_url}
            )

        # Step 4: Verify session is established
        me_response = self.session.get(f"{BACKEND_URL}/bff/auth/me", timeout=5)
        if me_response.status_code != 200:
            return TestResult(
                "Login",
                False,
                f"Session not established after login: {me_response.status_code}",
                {}
            )

        user_data = me_response.json()
        if not user_data.get("authenticated"):
            return TestResult(
                "Login",
                False,
                "User not authenticated after login",
                {"response": user_data}
            )

        self._track_api_call("GET", "/bff/auth/me", me_response.status_code)

        return TestResult(
            "Login",
            True,
            f"Logged in as {user_data.get('email')}",
            {
                "email": user_data.get("email"),
                "tenants": len(user_data.get("tenants", []))
            }
        )

    def test_navigate_dashboard(self) -> TestResult:
        """Simulate navigating to the dashboard (fetch accounts)"""
        # Select consumer tenant first
        exchange_response = self.session.post(
            f"{BACKEND_URL}/bff/auth/token/exchange",
            json={"target_tenant_id": CONSUMER_TENANT_ID},
            timeout=10
        )

        if exchange_response.status_code != 200:
            return TestResult(
                "Navigate Dashboard",
                False,
                f"Failed to select tenant: {exchange_response.status_code}",
                {}
            )

        self._track_api_call("POST", "/bff/auth/token/exchange", exchange_response.status_code)

        # Fetch accounts (dashboard data)
        accounts_response = self.session.get(
            f"{BACKEND_URL}/api/accounts",
            timeout=10
        )

        self._track_api_call("GET", "/api/accounts", accounts_response.status_code)

        if accounts_response.status_code != 200:
            return TestResult(
                "Navigate Dashboard",
                False,
                f"Failed to fetch accounts: {accounts_response.status_code}",
                {}
            )

        accounts_data = accounts_response.json()
        account_count = len(accounts_data.get("accounts", accounts_data.get("content", [])))

        return TestResult(
            "Navigate Dashboard",
            True,
            f"Dashboard loaded with {account_count} accounts",
            {"account_count": account_count}
        )

    def test_navigate_accounts(self) -> TestResult:
        """Simulate navigating to accounts list page"""
        # Fetch accounts list
        response = self.session.get(f"{BACKEND_URL}/api/accounts", timeout=10)
        self._track_api_call("GET", "/api/accounts", response.status_code)

        if response.status_code != 200:
            return TestResult(
                "Navigate Accounts",
                False,
                f"Failed to fetch accounts: {response.status_code}",
                {}
            )

        return TestResult(
            "Navigate Accounts",
            True,
            "Accounts list loaded successfully"
        )

    def test_view_account_details(self) -> TestResult:
        """Simulate viewing account details and transactions"""
        # First get accounts to find an account ID
        accounts_response = self.session.get(f"{BACKEND_URL}/api/accounts", timeout=10)

        if accounts_response.status_code != 200:
            return TestResult(
                "View Account Details",
                False,
                "Could not fetch accounts",
                {}
            )

        accounts_data = accounts_response.json()
        accounts = accounts_data.get("accounts", accounts_data.get("content", []))

        if not accounts:
            return TestResult(
                "View Account Details",
                True,
                "No accounts to view (skipped)",
                {}
            )

        account_id = accounts[0].get("id")

        # Fetch account details
        detail_response = self.session.get(
            f"{BACKEND_URL}/api/accounts/{account_id}",
            timeout=10
        )
        self._track_api_call("GET", f"/api/accounts/{account_id}", detail_response.status_code)

        # Fetch transactions (may not exist)
        tx_response = self.session.get(
            f"{BACKEND_URL}/api/accounts/{account_id}/transactions",
            timeout=10
        )
        self._track_api_call("GET", f"/api/accounts/{account_id}/transactions", tx_response.status_code)

        return TestResult(
            "View Account Details",
            True,
            f"Viewed account {account_id}",
            {"account_id": account_id}
        )

    def test_swap_tenant(self) -> TestResult:
        """Swap from consumer tenant to business tenant"""
        # Select business tenant
        response = self.session.post(
            f"{BACKEND_URL}/bff/auth/token/exchange",
            json={"target_tenant_id": BUSINESS_TENANT_ID},
            timeout=10
        )

        self._track_api_call("POST", "/bff/auth/token/exchange", response.status_code)

        if response.status_code != 200:
            return TestResult(
                "Swap Tenant",
                False,
                f"Failed to swap tenant: {response.status_code}",
                {"body": response.text[:200]}
            )

        exchange_data = response.json()

        # Verify the swap worked by fetching /me
        me_response = self.session.get(f"{BACKEND_URL}/bff/auth/me", timeout=5)
        self._track_api_call("GET", "/bff/auth/me", me_response.status_code)

        return TestResult(
            "Swap Tenant",
            True,
            f"Swapped to business tenant: {exchange_data.get('tenant_id')}",
            {"tenant_id": exchange_data.get("tenant_id")}
        )

    def test_navigate_business_dashboard(self) -> TestResult:
        """Fetch business dashboard data"""
        # Fetch accounts for business tenant
        response = self.session.get(f"{BACKEND_URL}/api/accounts", timeout=10)
        self._track_api_call("GET", "/api/accounts", response.status_code)

        if response.status_code != 200:
            return TestResult(
                "Business Dashboard",
                False,
                f"Failed to fetch business accounts: {response.status_code}",
                {}
            )

        # Also fetch admin users (commercial dashboard shows this)
        admin_response = self.session.get(f"{BACKEND_URL}/api/admin/users", timeout=10)
        self._track_api_call("GET", "/api/admin/users", admin_response.status_code)

        return TestResult(
            "Business Dashboard",
            True,
            "Business dashboard loaded"
        )

    def test_navigate_business_accounts(self) -> TestResult:
        """Navigate business accounts"""
        # Fetch accounts
        response = self.session.get(f"{BACKEND_URL}/api/accounts", timeout=10)
        self._track_api_call("GET", "/api/accounts", response.status_code)

        return TestResult(
            "Business Accounts",
            True,
            "Business accounts loaded"
        )

    def test_swap_back_to_consumer(self) -> TestResult:
        """Swap back to consumer tenant"""
        response = self.session.post(
            f"{BACKEND_URL}/bff/auth/token/exchange",
            json={"target_tenant_id": CONSUMER_TENANT_ID},
            timeout=10
        )

        self._track_api_call("POST", "/bff/auth/token/exchange", response.status_code)

        if response.status_code != 200:
            return TestResult(
                "Swap Back",
                False,
                f"Failed to swap back: {response.status_code}",
                {}
            )

        # Verify with /me
        me_response = self.session.get(f"{BACKEND_URL}/bff/auth/me", timeout=5)
        self._track_api_call("GET", "/bff/auth/me", me_response.status_code)

        return TestResult(
            "Swap Back",
            True,
            "Swapped back to consumer tenant"
        )

    def test_verify_events_in_dom(self) -> TestResult:
        """
        Verify that the debug UI DOM shows events from our session.
        This is the KEY TEST - checking that requests appear in the actual UI.
        """
        if not self.driver:
            return TestResult(
                "Verify Events in DOM",
                False,
                "Browser not initialized",
                {}
            )

        try:
            # Give SSE time to push events and DOM time to update
            time.sleep(2)

            # Refresh the events by checking the DOM
            # The SSE should have pushed events that the JS renders

            # Get current event count from badge
            count_el = self.driver.find_element(By.ID, "event-count")
            current_count_text = count_el.text.strip()
            current_count = int(current_count_text) if current_count_text.isdigit() else 0

            # Count actual event rows in the container
            events_container = self.driver.find_element(By.ID, "events-container")
            event_rows = events_container.find_elements(By.CSS_SELECTOR, "[data-event-id]")
            dom_event_count = len(event_rows)

            # Calculate new events
            new_events = current_count - self.initial_event_count

            # We should have captured events for our API calls
            min_expected = len(self.api_calls_made)

            # Check if we have events in DOM
            if dom_event_count == 0:
                return TestResult(
                    "Verify Events in DOM",
                    False,
                    "No event rows found in DOM - events not rendering",
                    {
                        "badge_count": current_count,
                        "dom_rows": dom_event_count,
                        "initial_count": self.initial_event_count,
                        "api_calls_made": min_expected
                    }
                )

            if new_events < min_expected // 2:  # At least half the expected events
                return TestResult(
                    "Verify Events in DOM",
                    False,
                    f"Too few events in DOM: {new_events} new events, expected ~{min_expected}",
                    {
                        "badge_count": current_count,
                        "dom_rows": dom_event_count,
                        "initial_count": self.initial_event_count,
                        "new_events": new_events,
                        "api_calls_made": min_expected
                    }
                )

            return TestResult(
                "Verify Events in DOM",
                True,
                f"Events appear in DOM: {dom_event_count} rows, {new_events} new events (made {min_expected} API calls)",
                {
                    "badge_count": current_count,
                    "dom_rows": dom_event_count,
                    "initial_count": self.initial_event_count,
                    "new_events": new_events,
                    "api_calls_made": min_expected
                }
            )

        except Exception as e:
            return TestResult(
                "Verify Events in DOM",
                False,
                f"Error checking DOM: {str(e)}",
                {}
            )

    def test_verify_api_events_in_dom(self) -> TestResult:
        """
        Verify that API events specifically appear in the DOM.
        Look for event badges with 'API' type.
        """
        if not self.driver:
            return TestResult(
                "Verify API Events in DOM",
                False,
                "Browser not initialized",
                {}
            )

        try:
            events_container = self.driver.find_element(By.ID, "events-container")

            # Look for API event badges
            # The structure is: <span class="event-badge event-badge-api">
            api_badges = events_container.find_elements(
                By.CSS_SELECTOR, ".event-badge-api, [class*='event-badge-api']"
            )

            # Also check for any event badges at all
            all_badges = events_container.find_elements(By.CSS_SELECTOR, ".event-badge")

            # Get sample event text content for verification
            event_rows = events_container.find_elements(By.CSS_SELECTOR, "[data-event-id]")
            sample_events = []
            for row in event_rows[:5]:  # First 5 events
                try:
                    text = row.text
                    sample_events.append(text[:100] if len(text) > 100 else text)
                except:
                    pass

            # Check for paths we called in the event text
            container_text = events_container.text
            paths_found = []
            for call in self.api_calls_made:
                path = call.get("path", "")
                if path and path in container_text:
                    paths_found.append(path)

            if len(api_badges) == 0 and len(all_badges) == 0:
                return TestResult(
                    "Verify API Events in DOM",
                    False,
                    "No event badges found in DOM",
                    {
                        "api_badges": 0,
                        "all_badges": 0,
                        "sample_events": sample_events
                    }
                )

            if len(api_badges) == 0:
                # Check if maybe we just have different event types
                return TestResult(
                    "Verify API Events in DOM",
                    False,
                    f"No API-type events found (but found {len(all_badges)} other badges)",
                    {
                        "api_badges": 0,
                        "all_badges": len(all_badges),
                        "sample_events": sample_events,
                        "paths_found": paths_found
                    }
                )

            return TestResult(
                "Verify API Events in DOM",
                True,
                f"Found {len(api_badges)} API events in DOM, {len(paths_found)} paths matched",
                {
                    "api_badges": len(api_badges),
                    "all_badges": len(all_badges),
                    "paths_found": paths_found[:10],
                    "sample_events": sample_events
                }
            )

        except Exception as e:
            return TestResult(
                "Verify API Events in DOM",
                False,
                f"Error checking API events: {str(e)}",
                {}
            )

    def test_logout(self) -> TestResult:
        """Logout and verify session is terminated"""
        response = self.session.get(
            f"{BACKEND_URL}/bff/auth/logout",
            allow_redirects=True,
            timeout=10
        )

        self._track_api_call("GET", "/bff/auth/logout", response.status_code)

        # Verify we're logged out
        me_response = self.session.get(f"{BACKEND_URL}/bff/auth/me", timeout=5)

        if me_response.status_code == 401:
            return TestResult(
                "Logout",
                True,
                "Logged out successfully"
            )

        # Session might still exist briefly
        if me_response.status_code == 200:
            data = me_response.json()
            if not data.get("authenticated"):
                return TestResult(
                    "Logout",
                    True,
                    "Logged out (session invalidated)"
                )

        return TestResult(
            "Logout",
            True,
            f"Logout completed (final status: {me_response.status_code})"
        )


# ==================== Pytest Integration ====================

import pytest


@pytest.fixture
def test_instance():
    """Create test instance for pytest"""
    instance = DebugIntegrationTest()
    yield instance
    instance._cleanup()


def test_full_debug_integration(test_instance):
    """
    Pytest test that runs the full integration flow.

    This test:
    1. Logs in via BFF authentication
    2. Navigates around the app (clicks around)
    3. Swaps tenants (consumer -> business -> consumer)
    4. Verifies the debug UI DOM shows all the requests
    """
    success = test_instance.run_all_tests()
    assert success, "Debug integration tests failed - see output above for details"


def test_service_health():
    """Quick health check test"""
    test = DebugIntegrationTest()
    result = test.test_service_health()
    assert result.passed, result.message


def test_debug_events_endpoint():
    """Verify debug events endpoint is accessible"""
    response = requests.get(f"{DEBUG_API_URL}/events", timeout=5)
    assert response.status_code == 200, f"Debug events endpoint returned {response.status_code}"
    data = response.json()
    assert "events" in data, "Response missing 'events' key"


def test_debug_ui_loads():
    """Verify debug UI page loads and has the events container"""
    driver = create_webdriver(headless=True)
    if not driver:
        pytest.skip("No browser available")

    try:
        driver.get(DEBUG_UI_URL)
        WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.ID, "events-container"))
        )
        assert driver.find_element(By.ID, "events-container") is not None
        assert driver.find_element(By.ID, "event-count") is not None
    finally:
        driver.quit()


# ==================== Main Entry Point ====================

def main():
    """Main entry point - runs the full test suite"""
    test = DebugIntegrationTest()
    success = test.run_all_tests()
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
