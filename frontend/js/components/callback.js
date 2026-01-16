/**
 * OAuth Callback Component
 * Handles the redirect from Keycloak after authentication
 */

import auth from '../auth.js';
import api from '../api.js';
import state from '../state.js';
import router from '../router.js';
import { showLoading, hideLoading, showToast } from '../ui.js';

// Guard against re-entry (hashchange can trigger multiple renders)
let isProcessing = false;

/**
 * Render the callback page and process the OAuth callback
 */
export async function render() {
    // Prevent re-entry - callback should only process once
    if (isProcessing) {
        console.log('[Callback] Already processing, skipping re-entry');
        return;
    }
    isProcessing = true;

    const app = document.getElementById('app');

    // Show loading state
    app.innerHTML = `
        <div class="min-h-screen flex items-center justify-center bg-gray-50">
            <div class="text-center">
                <div class="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full spinner mx-auto mb-4"></div>
                <h1 class="text-xl font-semibold text-gray-900">Completing Sign In...</h1>
                <p class="text-gray-500 mt-2">Please wait while we verify your credentials</p>
            </div>
        </div>
    `;

    try {
        console.log('[Callback] Starting callback processing...');
        console.log('[Callback] Current URL:', window.location.href);

        // Handle the OAuth callback (fetches user from /bff/auth/me)
        const authResult = await auth.handleCallback();
        console.log('[Callback] Auth result:', authResult);

        // Fetch additional user info and available tenants from /auth/me
        console.log('[Callback] Fetching user data from API...');
        await fetchUserData();

        // Check available tenants
        const tenants = state.get('availableTenants');

        if (tenants.length === 0) {
            // No tenants available - shouldn't happen for demo users
            showToast('No organizations available for your account.', 'error');
            isProcessing = false;
            router.navigate('/login', { replace: true });
            return;
        }

        if (tenants.length === 1) {
            // Single tenant - auto-select
            isProcessing = false;
            await selectTenant(tenants[0]);
        } else {
            // Multiple tenants - show selector
            isProcessing = false;
            router.navigate('/select-organization', { replace: true });
        }
    } catch (error) {
        console.error('[Callback] Processing failed:', error);
        console.error('[Callback] Error details:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });
        showToast(`Authentication failed: ${error.message}`, 'error');
        isProcessing = false;
        router.navigate('/login', { replace: true });
    }
}

/**
 * Fetch user data and available tenants from the API
 * With BFF pattern, user info comes from /bff/auth/me (session-based)
 */
async function fetchUserData() {
    try {
        console.log('[Callback] Calling api.getMe() (BFF endpoint)...');
        // Get user info from BFF endpoint (uses session cookies)
        const response = await api.getMe();
        console.log('[Callback] api.getMe() response:', response);

        // BFF returns flat format: {authenticated, sub, email, name, ...}
        if (response.authenticated && response.sub) {
            const user = {
                id: response.sub,
                email: response.email,
                name: response.name || response.preferred_username || response.email,
                avatarUrl: null
            };
            state.set('user', user);
            console.log('[Callback] User set in state:', user.email);

            // For now, generate mock tenants since BFF doesn't return tenants yet
            // TODO: Add /bff/auth/tenants endpoint for real tenant data
            const mockTenants = generateMockTenants(response.email);
            state.set('availableTenants', mockTenants);
            console.log('[Callback] Mock tenants set:', mockTenants.length);
        }

        state.persist();
    } catch (error) {
        console.warn('[Callback] Failed to fetch user data from BFF, using existing state:', error);

        // Fall back to user data already in state (from auth.handleCallback)
        const user = state.get('user');
        if (user) {
            console.log('[Callback] Using existing user from state:', user.email);
            // Generate mock tenants based on user email
            const mockTenants = generateMockTenants(user.email);
            state.set('availableTenants', mockTenants);
            state.persist();
        }
    }
}

/**
 * Generate mock tenants for demo purposes
 * @param {string} email - User's email
 * @returns {Array} Mock tenant data
 */
function generateMockTenants(email) {
    const tenants = [];

    // Personal tenant for all users
    const userName = email.split('@')[0].replace('.', ' ');
    const displayName = userName.split(' ').map(n => n.charAt(0).toUpperCase() + n.slice(1)).join(' ');

    tenants.push({
        id: 'tenant-001',
        name: displayName,
        type: 'CONSUMER',
        role: 'OWNER',
        status: 'ACTIVE'
    });

    // Business tenant for John Doe
    if (email.toLowerCase().includes('jdoe')) {
        tenants.push({
            id: 'tenant-003',
            name: 'AnyBusiness Inc.',
            type: 'COMMERCIAL',
            role: 'OWNER',
            status: 'ACTIVE'
        });
    }

    // Admin user gets all tenants
    if (email.toLowerCase().includes('admin')) {
        tenants.length = 0; // Clear and rebuild
        tenants.push({
            id: 'tenant-001',
            name: 'John Doe',
            type: 'CONSUMER',
            role: 'ADMIN',
            status: 'ACTIVE'
        });
        tenants.push({
            id: 'tenant-002',
            name: 'Jane Smith',
            type: 'CONSUMER',
            role: 'ADMIN',
            status: 'ACTIVE'
        });
        tenants.push({
            id: 'tenant-003',
            name: 'AnyBusiness Inc.',
            type: 'COMMERCIAL',
            role: 'ADMIN',
            status: 'ACTIVE'
        });
    }

    return tenants;
}

/**
 * Select a tenant and perform token exchange
 * @param {Object} tenant - Tenant to select
 */
async function selectTenant(tenant) {
    try {
        showLoading(`Switching to ${tenant.name}...`);

        // Try token exchange via BFF API (tokens stay server-side)
        const response = await api.exchangeToken(tenant.id);
        console.log('[Callback] Token exchange response:', response);

        // BFF returns {success, tenant_id, expires_in} - tokens stay server-side
        if (response.success) {
            // In BFF pattern, we don't store access tokens client-side
            // Just record the expiry for UI purposes
            state.update({
                'tokens.expiresAt': Date.now() + (response.expires_in * 1000)
            });
        }

        auth.setCurrentTenant({
            id: tenant.id,
            name: tenant.name,
            type: tenant.type,
            role: tenant.role
        });

        hideLoading();
        router.navigate('/dashboard', { replace: true });
    } catch (error) {
        console.warn('[Callback] Token exchange failed, using fallback:', error);

        // Fallback: set tenant context without token exchange
        auth.setCurrentTenant({
            id: tenant.id,
            name: tenant.name,
            type: tenant.type,
            role: tenant.role
        });

        // Set a default expiry for UI purposes
        auth.setAccessToken(auth.getIdentityToken(), 3600);

        hideLoading();
        router.navigate('/dashboard', { replace: true });
    }
}

export default { render };
