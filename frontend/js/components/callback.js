/**
 * OAuth Callback Component
 * Handles the redirect from Keycloak after authentication
 */

import auth from '../auth.js';
import api from '../api.js';
import state from '../state.js';
import router from '../router.js';
import { showLoading, hideLoading, showToast } from '../ui.js';

/**
 * Render the callback page and process the OAuth callback
 */
export async function render() {
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
        // Handle the OAuth callback
        await auth.handleCallback();

        // Fetch user info and available tenants
        await fetchUserData();

        // Check available tenants
        const tenants = state.get('availableTenants');

        if (tenants.length === 0) {
            // No tenants available - shouldn't happen for demo users
            showToast('No organizations available for your account.', 'error');
            router.navigate('/login', { replace: true });
            return;
        }

        if (tenants.length === 1) {
            // Single tenant - auto-select
            await selectTenant(tenants[0]);
        } else {
            // Multiple tenants - show selector
            router.navigate('/select-organization', { replace: true });
        }
    } catch (error) {
        console.error('Callback processing failed:', error);
        showToast('Authentication failed. Please try again.', 'error');
        router.navigate('/login', { replace: true });
    }
}

/**
 * Fetch user data and available tenants from the API
 */
async function fetchUserData() {
    try {
        // Try to get user info from API
        const response = await api.getMe();

        if (response.user) {
            state.set('user', {
                id: response.user.id,
                email: response.user.email,
                name: response.user.display_name || response.user.email,
                avatarUrl: null
            });
        }

        if (response.tenants) {
            state.set('availableTenants', response.tenants);
        }

        state.persist();
    } catch (error) {
        console.warn('Failed to fetch user data from API, using mock data:', error);

        // Use mock data for demo when API is not available
        const user = state.get('user');
        if (user) {
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

        // Try token exchange via API
        const response = await api.exchangeToken(tenant.id);

        if (response.access_token) {
            auth.setAccessToken(response.access_token, response.expires_in || 3600);
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
        console.warn('Token exchange failed, using mock token:', error);

        // For demo purposes, create a mock access token scenario
        auth.setCurrentTenant({
            id: tenant.id,
            name: tenant.name,
            type: tenant.type,
            role: tenant.role
        });

        // Set mock access token (in real scenario this would come from the server)
        auth.setAccessToken(auth.getIdentityToken(), 3600);

        hideLoading();
        router.navigate('/dashboard', { replace: true });
    }
}

export default { render };
