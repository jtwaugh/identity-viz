/**
 * Header Component
 * Navigation header with context switcher
 */

import auth from '../auth.js';
import api from '../api.js';
import state from '../state.js';
import router from '../router.js';
import { showLoading, hideLoading, showToast, getTenantTypeInfo, getRoleInfo, escapeHtml } from '../ui.js';

/**
 * Render the header component
 * @returns {string} HTML string
 */
export function render() {
    const user = state.get('user');
    const currentTenant = state.get('currentTenant');
    const currentPath = router.getCurrentPath();

    if (!user || !currentTenant) {
        return '';
    }

    const typeInfo = getTenantTypeInfo(currentTenant.type);
    const navItems = getNavItems(currentTenant.type, currentTenant.role);

    return `
        <!-- Main Header -->
        <header class="bg-white border-b border-gray-200 sticky top-0 z-30">
            <div class="max-w-7xl mx-auto px-4">
                <div class="flex items-center justify-between h-16">
                    <!-- Left: Logo + Context Switcher -->
                    <div class="flex items-center gap-6">
                        <!-- Logo -->
                        <div class="flex items-center gap-2">
                            <div class="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center">
                                <i data-lucide="landmark" class="w-5 h-5 text-white"></i>
                            </div>
                            <span class="text-lg font-bold text-gray-900 hide-mobile">AnyBank</span>
                        </div>

                        <!-- Context Switcher -->
                        <div class="dropdown" id="context-dropdown">
                            <button class="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors" id="context-trigger">
                                <div class="w-8 h-8 rounded-lg bg-${typeInfo.color}-100 flex items-center justify-center">
                                    <i data-lucide="${typeInfo.icon}" class="w-4 h-4 text-${typeInfo.color}-600"></i>
                                </div>
                                <div class="text-left hide-mobile">
                                    <p class="text-sm font-medium text-gray-900">${escapeHtml(currentTenant.name)}</p>
                                    <p class="text-xs text-gray-500">${typeInfo.label}</p>
                                </div>
                                <i data-lucide="chevron-down" class="w-4 h-4 text-gray-400 hide-mobile"></i>
                            </button>

                            <!-- Dropdown Menu -->
                            <div class="dropdown-menu" id="context-menu">
                                <div class="px-3 py-2 text-xs font-medium text-gray-500 uppercase">Switch Organization</div>
                                <div id="context-tenants"></div>
                                <div class="dropdown-divider"></div>
                                <button class="dropdown-item" id="manage-orgs-btn">
                                    <i data-lucide="settings" class="w-4 h-4"></i>
                                    Manage Organizations
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Center: Navigation -->
                    <nav class="hidden md:flex items-center gap-1">
                        ${navItems.map(item => `
                            <a href="#${item.path}" class="px-4 py-2 rounded-lg text-sm font-medium transition-colors ${currentPath === item.path ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'}">
                                ${item.label}
                            </a>
                        `).join('')}
                    </nav>

                    <!-- Right: User Menu -->
                    <div class="dropdown" id="user-dropdown">
                        <button class="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-100 transition-colors" id="user-trigger">
                            <div class="avatar avatar-sm bg-${typeInfo.color}-100 text-${typeInfo.color}-700">
                                ${auth.getInitials(user.name)}
                            </div>
                            <i data-lucide="chevron-down" class="w-4 h-4 text-gray-400 hide-mobile"></i>
                        </button>

                        <!-- User Dropdown -->
                        <div class="dropdown-menu" id="user-menu">
                            <div class="px-3 py-2 border-b border-gray-100">
                                <p class="text-sm font-medium text-gray-900">${escapeHtml(user.name)}</p>
                                <p class="text-xs text-gray-500">${escapeHtml(user.email)}</p>
                            </div>
                            <a href="#/settings" class="dropdown-item">
                                <i data-lucide="settings" class="w-4 h-4"></i>
                                Settings
                            </a>
                            <a href="#/help" class="dropdown-item">
                                <i data-lucide="help-circle" class="w-4 h-4"></i>
                                Help & Support
                            </a>
                            <div class="dropdown-divider"></div>
                            <button class="dropdown-item text-red-600" id="logout-btn">
                                <i data-lucide="log-out" class="w-4 h-4"></i>
                                Sign Out
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </header>

        <!-- Context Banner -->
        <div class="context-banner context-banner-${typeInfo.color.toLowerCase()}">
            <div class="max-w-7xl mx-auto px-4 flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <span class="font-medium">${typeInfo.label} Banking</span>
                    <span class="text-current/70">&bull;</span>
                    <span>${escapeHtml(currentTenant.name)}</span>
                </div>
                <button class="btn btn-sm btn-ghost" id="switch-org-banner-btn">
                    <i data-lucide="repeat" class="w-4 h-4"></i>
                    <span class="hide-mobile">Switch Organization</span>
                </button>
            </div>
        </div>
    `;
}

/**
 * Get navigation items based on tenant type and user role
 * @param {string} tenantType - Tenant type
 * @param {string} role - User role
 * @returns {Array} Navigation items
 */
function getNavItems(tenantType, role) {
    const baseItems = [
        { path: '/dashboard', label: 'Dashboard' },
        { path: '/accounts', label: 'Accounts' },
        { path: '/transfers/new', label: 'Transfers' }
    ];

    // Add type-specific items
    if (tenantType === 'COMMERCIAL' || tenantType === 'SMALL_BUSINESS') {
        baseItems.push({ path: '/payroll', label: 'Payroll' });
        baseItems.push({ path: '/reports', label: 'Reports' });
    }

    // Add admin items for ADMIN+ roles
    if (role === 'ADMIN' || role === 'OWNER') {
        baseItems.push({ path: '/admin/users', label: 'Users' });
    }

    return baseItems;
}

/**
 * Initialize header interactivity
 */
export function init() {
    // Context dropdown
    setupDropdown('context-dropdown', 'context-trigger');

    // User dropdown
    setupDropdown('user-dropdown', 'user-trigger');

    // Populate tenant list in context switcher
    populateTenantSwitcher();

    // Logout button
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }

    // Switch org buttons
    const switchOrgBannerBtn = document.getElementById('switch-org-banner-btn');
    if (switchOrgBannerBtn) {
        switchOrgBannerBtn.addEventListener('click', () => {
            router.navigate('/select-organization');
        });
    }

    const manageOrgsBtn = document.getElementById('manage-orgs-btn');
    if (manageOrgsBtn) {
        manageOrgsBtn.addEventListener('click', () => {
            closeAllDropdowns();
            router.navigate('/select-organization');
        });
    }

    // Close dropdowns when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.dropdown')) {
            closeAllDropdowns();
        }
    });
}

/**
 * Setup dropdown toggle functionality
 * @param {string} dropdownId - Dropdown container ID
 * @param {string} triggerId - Trigger button ID
 */
function setupDropdown(dropdownId, triggerId) {
    const dropdown = document.getElementById(dropdownId);
    const trigger = document.getElementById(triggerId);

    if (!dropdown || !trigger) return;

    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = dropdown.classList.contains('open');

        // Close all other dropdowns
        closeAllDropdowns();

        if (!isOpen) {
            dropdown.classList.add('open');
        }
    });
}

/**
 * Close all dropdown menus
 */
function closeAllDropdowns() {
    document.querySelectorAll('.dropdown.open').forEach(d => {
        d.classList.remove('open');
    });
}

/**
 * Populate tenant switcher with available tenants
 */
function populateTenantSwitcher() {
    const container = document.getElementById('context-tenants');
    if (!container) return;

    const tenants = state.get('availableTenants');
    const currentTenant = state.get('currentTenant');

    container.innerHTML = tenants.map(tenant => {
        const typeInfo = getTenantTypeInfo(tenant.type);
        const isCurrent = tenant.id === currentTenant?.id;

        return `
            <button class="dropdown-item ${isCurrent ? 'bg-gray-50' : ''}" data-tenant-id="${tenant.id}" ${isCurrent ? 'disabled' : ''}>
                <div class="w-8 h-8 rounded-lg bg-${typeInfo.color}-100 flex items-center justify-center">
                    <i data-lucide="${typeInfo.icon}" class="w-4 h-4 text-${typeInfo.color}-600"></i>
                </div>
                <div class="flex-1 text-left">
                    <p class="text-sm font-medium">${escapeHtml(tenant.name)}</p>
                    <p class="text-xs text-gray-500">${typeInfo.label}</p>
                </div>
                ${isCurrent ? '<i data-lucide="check" class="w-4 h-4 text-green-600"></i>' : ''}
            </button>
        `;
    }).join('');

    // Re-init icons
    if (window.lucide) {
        lucide.createIcons({ nodes: [container] });
    }

    // Attach click handlers
    container.querySelectorAll('button[data-tenant-id]').forEach(btn => {
        if (!btn.disabled) {
            btn.addEventListener('click', () => {
                const tenantId = btn.dataset.tenantId;
                handleTenantSwitch(tenantId);
            });
        }
    });
}

/**
 * Handle tenant switch from context menu
 * @param {string} tenantId - Target tenant ID
 */
async function handleTenantSwitch(tenantId) {
    closeAllDropdowns();

    const tenants = state.get('availableTenants');
    const tenant = tenants.find(t => t.id === tenantId);

    if (!tenant) return;

    showLoading(`Switching to ${tenant.name}...`);

    try {
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

        // Clear cached accounts since we switched tenants
        state.set('accounts', []);

        hideLoading();

        // Navigate to dashboard after tenant switch (don't stay on old tenant's pages)
        router.navigate('/dashboard', { replace: true });
    } catch (error) {
        console.warn('Token exchange failed:', error);

        // Demo fallback
        auth.setCurrentTenant({
            id: tenant.id,
            name: tenant.name,
            type: tenant.type,
            role: tenant.role
        });
        auth.setAccessToken(auth.getIdentityToken(), 3600);

        // Clear cached accounts since we switched tenants
        state.set('accounts', []);

        hideLoading();
        router.navigate('/dashboard', { replace: true });
    }
}

/**
 * Handle logout
 */
async function handleLogout() {
    closeAllDropdowns();
    showLoading('Signing out...');
    await auth.logout();
}

export default { render, init };
