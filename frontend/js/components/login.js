/**
 * Login Component
 * Login page with Keycloak OIDC redirect
 */

import auth from '../auth.js';
import { showLoading, hideLoading, showToast } from '../ui.js';

/**
 * Render the login page
 */
export async function render() {
    const app = document.getElementById('app');

    app.innerHTML = `
        <div class="min-h-screen login-bg flex items-center justify-center p-4">
            <div class="w-full max-w-md">
                <!-- Login Card -->
                <div class="card p-8">
                    <!-- Logo -->
                    <div class="text-center mb-8">
                        <div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 mb-4">
                            <i data-lucide="landmark" class="w-8 h-8 text-white"></i>
                        </div>
                        <h1 class="text-2xl font-bold text-gray-900">Welcome to AnyBank</h1>
                        <p class="text-gray-500 mt-2">Sign in to access all your accounts</p>
                    </div>

                    <!-- Sign In Button -->
                    <button id="login-btn" class="btn btn-primary w-full text-base py-3">
                        <i data-lucide="log-in" class="w-5 h-5"></i>
                        Sign In with AnyBank ID
                    </button>

                    <!-- Divider -->
                    <div class="separator my-6"></div>

                    <!-- Info Text -->
                    <p class="text-sm text-gray-500 text-center">
                        Access your personal and business accounts with a single sign-in.
                    </p>
                </div>

                <!-- Footer -->
                <div class="mt-8 text-center">
                    <div class="flex items-center justify-center gap-4 mb-4">
                        <div class="flex items-center gap-1 text-sm text-gray-500">
                            <i data-lucide="shield-check" class="w-4 h-4"></i>
                            <span>256-bit Encryption</span>
                        </div>
                        <div class="flex items-center gap-1 text-sm text-gray-500">
                            <i data-lucide="lock" class="w-4 h-4"></i>
                            <span>FDIC Insured</span>
                        </div>
                    </div>
                    <p class="text-xs text-gray-400">
                        By signing in, you agree to our
                        <a href="#" class="text-blue-600 hover:underline">Terms of Service</a>
                        and
                        <a href="#" class="text-blue-600 hover:underline">Privacy Policy</a>
                    </p>
                </div>
            </div>
        </div>
    `;

    // Initialize Lucide icons
    if (window.lucide) {
        lucide.createIcons();
    }

    // Attach login handler
    const loginBtn = document.getElementById('login-btn');
    loginBtn.addEventListener('click', handleLogin);
}

/**
 * Handle login button click
 */
async function handleLogin() {
    const loginBtn = document.getElementById('login-btn');
    loginBtn.disabled = true;
    loginBtn.innerHTML = `
        <div class="w-5 h-5 border-2 border-white border-t-transparent rounded-full spinner"></div>
        Redirecting...
    `;

    try {
        await auth.login();
    } catch (error) {
        console.error('Login failed:', error);
        showToast('Failed to initiate login. Please try again.', 'error');

        // Reset button
        loginBtn.disabled = false;
        loginBtn.innerHTML = `
            <i data-lucide="log-in" class="w-5 h-5"></i>
            Sign In with AnyBank ID
        `;
        if (window.lucide) {
            lucide.createIcons({ nodes: [loginBtn] });
        }
    }
}

export default { render };
