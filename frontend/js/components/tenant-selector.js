/**
 * Tenant Selector Component
 * Organization picker screen after authentication
 */

import auth from '../auth.js';
import api from '../api.js';
import state from '../state.js';
import router from '../router.js';
import { showLoading, hideLoading, showToast, getTenantTypeInfo, getRoleInfo, escapeHtml } from '../ui.js';

/**
 * Render the tenant selector page
 */
export async function render() {
    const app = document.getElementById('app');
    const user = state.get('user');
    const tenants = state.get('availableTenants');

    if (!user) {
        router.navigate('/login', { replace: true });
        return;
    }

    app.innerHTML = `
        <div class="min-h-screen bg-gray-50">
            <!-- Header -->
            <header class="bg-white border-b border-gray-200">
                <div class="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
                            <i data-lucide="landmark" class="w-5 h-5 text-white"></i>
                        </div>
                        <span class="text-xl font-bold text-gray-900">AnyBank</span>
                    </div>
                    <div class="flex items-center gap-3">
                        <div class="avatar" title="${escapeHtml(user.name)}">
                            ${auth.getInitials(user.name)}
                        </div>
                        <div class="text-right hide-mobile">
                            <p class="text-sm font-medium text-gray-900">${escapeHtml(user.name)}</p>
                            <p class="text-xs text-gray-500">${escapeHtml(user.email)}</p>
                        </div>
                    </div>
                </div>
            </header>

            <!-- Main Content -->
            <main class="max-w-5xl mx-auto px-4 py-8">
                <div class="text-center mb-8">
                    <h1 class="text-2xl font-bold text-gray-900">Select an Organization</h1>
                    <p class="text-gray-500 mt-2">Choose which account context you want to manage</p>
                </div>

                <!-- Tenant Cards Grid -->
                <div id="tenant-grid" class="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl mx-auto">
                    ${tenants.map(tenant => renderTenantCard(tenant)).join('')}
                </div>

                <!-- Sign Out Link -->
                <div class="text-center mt-8">
                    <button id="signout-btn" class="text-sm text-gray-500 hover:text-gray-700 hover:underline">
                        Sign Out
                    </button>
                </div>
            </main>
        </div>
    `;

    // Initialize icons
    if (window.lucide) {
        lucide.createIcons();
    }

    // Attach event handlers
    attachEventHandlers();
}

/**
 * Render a single tenant card
 * @param {Object} tenant - Tenant data
 * @returns {string} HTML string
 */
function renderTenantCard(tenant) {
    const typeInfo = getTenantTypeInfo(tenant.type);
    const roleInfo = getRoleInfo(tenant.role);

    return `
        <div class="card card-hover p-6 cursor-pointer tenant-card" data-tenant-id="${tenant.id}">
            <div class="flex items-start gap-4">
                <!-- Icon -->
                <div class="w-12 h-12 rounded-xl bg-${typeInfo.color}-100 flex items-center justify-center flex-shrink-0">
                    <i data-lucide="${typeInfo.icon}" class="w-6 h-6 text-${typeInfo.color}-600"></i>
                </div>

                <!-- Content -->
                <div class="flex-1 min-w-0">
                    <h3 class="text-lg font-semibold text-gray-900 truncate">${escapeHtml(tenant.name)}</h3>
                    <div class="flex items-center gap-2 mt-1">
                        <span class="badge badge-${typeInfo.color}">${typeInfo.label}</span>
                        <span class="badge badge-${roleInfo.color}">${roleInfo.label}</span>
                    </div>
                </div>

                <!-- Arrow -->
                <div class="flex items-center">
                    <i data-lucide="chevron-right" class="w-5 h-5 text-gray-400"></i>
                </div>
            </div>
        </div>
    `;
}

/**
 * Attach event handlers
 */
function attachEventHandlers() {
    // Tenant card clicks
    document.querySelectorAll('.tenant-card').forEach(card => {
        card.addEventListener('click', () => {
            const tenantId = card.dataset.tenantId;
            handleSelectTenant(tenantId);
        });
    });

    // Sign out button
    document.getElementById('signout-btn').addEventListener('click', handleSignOut);
}

/**
 * Handle tenant selection
 * @param {string} tenantId - Selected tenant ID
 */
async function handleSelectTenant(tenantId) {
    const tenants = state.get('availableTenants');
    const tenant = tenants.find(t => t.id === tenantId);

    if (!tenant) {
        showToast('Tenant not found', 'error');
        return;
    }

    // Disable all cards during loading
    document.querySelectorAll('.tenant-card').forEach(card => {
        card.style.pointerEvents = 'none';
        card.style.opacity = '0.7';
    });

    showLoading(`Switching to ${tenant.name}...`);

    try {
        // Attempt token exchange via API
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
        console.warn('Token exchange failed, using mock context:', error);

        // For demo purposes when API is not available
        auth.setCurrentTenant({
            id: tenant.id,
            name: tenant.name,
            type: tenant.type,
            role: tenant.role
        });

        // Use identity token as mock access token
        auth.setAccessToken(auth.getIdentityToken(), 3600);

        hideLoading();
        router.navigate('/dashboard', { replace: true });
    }
}

/**
 * Handle sign out
 */
async function handleSignOut() {
    showLoading('Signing out...');
    await auth.logout();
}

export default { render };
