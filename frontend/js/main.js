/**
 * Main Application Entry Point
 * AnyBank Unified Identity Platform Frontend
 */

import state from './state.js';
import auth from './auth.js';
import api from './api.js';
import router from './router.js';
import { showToast, hideLoading } from './ui.js';

// Import components
import login from './components/login.js';
import callback from './components/callback.js';
import tenantSelector from './components/tenant-selector.js';
import dashboard from './components/dashboard.js';
import accounts from './components/accounts.js';
import transfers from './components/transfers.js';

/**
 * Initialize the application
 */
async function init() {
    console.log('AnyBank Frontend initializing...');

    // Hydrate state from session storage
    const hasState = state.hydrate();
    console.log('State hydrated:', hasState);

    // Set up API unauthorized handler
    api.onUnauthorized(() => {
        console.warn('Unauthorized - redirecting to login');
        showToast('Your session has expired. Please sign in again.', 'warning');
        auth.logout();
    });

    // Register routes
    registerRoutes();

    // Handle initial routing
    const currentPath = router.getCurrentPath();

    // If no hash, default to login or dashboard based on auth state
    if (!window.location.hash || window.location.hash === '#' || window.location.hash === '#/') {
        if (auth.isAuthenticated() && auth.hasTenantContext()) {
            router.navigate('/dashboard', { replace: true });
        } else if (auth.isAuthenticated()) {
            router.navigate('/select-organization', { replace: true });
        } else {
            router.navigate('/login', { replace: true });
        }
    }

    // Start router
    router.start();

    console.log('AnyBank Frontend initialized');
}

/**
 * Register all application routes
 */
function registerRoutes() {
    // Public routes (no auth required)
    router.route('/login', {
        component: login.render,
        requiresAuth: false,
        requiresTenant: false,
        title: 'Sign In - AnyBank'
    });

    router.route('/callback', {
        component: callback.render,
        requiresAuth: false,
        requiresTenant: false,
        title: 'Completing Sign In - AnyBank'
    });

    // Auth required, no tenant required
    router.route('/select-organization', {
        component: tenantSelector.render,
        requiresAuth: true,
        requiresTenant: false,
        title: 'Select Organization - AnyBank'
    });

    // Auth + tenant required
    router.route('/dashboard', {
        component: dashboard.render,
        requiresAuth: true,
        requiresTenant: true,
        title: 'Dashboard - AnyBank'
    });

    router.route('/accounts', {
        component: accounts.renderList,
        requiresAuth: true,
        requiresTenant: true,
        title: 'Accounts - AnyBank'
    });

    router.route('/accounts/:id', {
        component: accounts.renderDetails,
        requiresAuth: true,
        requiresTenant: true,
        title: 'Account Details - AnyBank'
    });

    router.route('/transfers', {
        component: transfers.render,
        requiresAuth: true,
        requiresTenant: true,
        title: 'Transfers - AnyBank'
    });

    router.route('/transfers/new', {
        component: transfers.render,
        requiresAuth: true,
        requiresTenant: true,
        title: 'New Transfer - AnyBank'
    });

    // Settings route (placeholder)
    router.route('/settings', {
        component: renderSettingsPlaceholder,
        requiresAuth: true,
        requiresTenant: true,
        title: 'Settings - AnyBank'
    });

    // Admin routes
    router.route('/admin/users', {
        component: renderAdminUsersPlaceholder,
        requiresAuth: true,
        requiresTenant: true,
        requiredRole: 'ADMIN',
        title: 'User Management - AnyBank'
    });

    // 404 handler
    router.notFound((path) => {
        renderNotFound(path);
    });
}

/**
 * Render settings placeholder
 */
function renderSettingsPlaceholder() {
    // Import header inline to avoid circular dependencies
    import('./components/header.js').then(headerModule => {
        const header = headerModule.default;
        const app = document.getElementById('app');

        app.innerHTML = `
            ${header.render()}
            <main class="max-w-3xl mx-auto px-4 py-6">
                <h1 class="text-2xl font-bold text-gray-900 mb-6">Settings</h1>

                <div class="card p-6">
                    <div class="text-center py-8">
                        <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                            <i data-lucide="settings" class="w-8 h-8 text-gray-400"></i>
                        </div>
                        <h2 class="text-lg font-semibold text-gray-900 mb-2">Settings Coming Soon</h2>
                        <p class="text-gray-500 max-w-sm mx-auto">
                            Account settings, notification preferences, and security options will be available here.
                        </p>
                    </div>
                </div>
            </main>
        `;

        if (window.lucide) lucide.createIcons();
        header.init();
    });
}

/**
 * Render admin users placeholder
 */
function renderAdminUsersPlaceholder() {
    import('./components/header.js').then(headerModule => {
        const header = headerModule.default;
        const currentTenant = state.get('currentTenant');
        const app = document.getElementById('app');

        // Mock team members
        const teamMembers = [
            { id: 'user-001', name: 'John Doe', email: 'jdoe@example.com', role: 'OWNER', status: 'ACTIVE' },
            { id: 'user-004', name: 'Sarah Johnson', email: 'sjohnson@anybusiness.com', role: 'ADMIN', status: 'ACTIVE' },
            { id: 'user-005', name: 'Mike Chen', email: 'mchen@anybusiness.com', role: 'OPERATOR', status: 'ACTIVE' },
            { id: 'user-006', name: 'Emily Davis', email: 'edavis@anybusiness.com', role: 'VIEWER', status: 'INVITED' }
        ];

        app.innerHTML = `
            ${header.render()}
            <main class="max-w-5xl mx-auto px-4 py-6">
                <!-- Breadcrumb -->
                <nav class="flex items-center gap-2 text-sm mb-6">
                    <a href="#/dashboard" class="text-gray-500 hover:text-gray-700">Dashboard</a>
                    <i data-lucide="chevron-right" class="w-4 h-4 text-gray-400"></i>
                    <span class="text-gray-900 font-medium">User Management</span>
                </nav>

                <div class="flex items-center justify-between mb-6">
                    <div>
                        <h1 class="text-2xl font-bold text-gray-900">User Management</h1>
                        <p class="text-gray-500">Manage team members for ${currentTenant.name}</p>
                    </div>
                    <button class="btn btn-primary demo-placeholder" data-feature="Invite User">
                        <i data-lucide="user-plus" class="w-4 h-4"></i>
                        Invite User
                    </button>
                </div>

                <div class="card overflow-hidden">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>User</th>
                                <th>Role</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${teamMembers.map(member => `
                                <tr>
                                    <td>
                                        <div class="flex items-center gap-3">
                                            <div class="avatar avatar-sm">${getInitials(member.name)}</div>
                                            <div>
                                                <p class="font-medium text-gray-900">${member.name}</p>
                                                <p class="text-sm text-gray-500">${member.email}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <select class="select w-auto py-1 px-2 text-sm demo-placeholder" data-feature="Role Change" ${member.role === 'OWNER' ? 'disabled' : ''}>
                                            <option value="VIEWER" ${member.role === 'VIEWER' ? 'selected' : ''}>Viewer</option>
                                            <option value="OPERATOR" ${member.role === 'OPERATOR' ? 'selected' : ''}>Operator</option>
                                            <option value="ADMIN" ${member.role === 'ADMIN' ? 'selected' : ''}>Admin</option>
                                            <option value="OWNER" ${member.role === 'OWNER' ? 'selected' : ''}>Owner</option>
                                        </select>
                                    </td>
                                    <td>
                                        <span class="badge ${member.status === 'ACTIVE' ? 'badge-operator' : 'badge-viewer'}">
                                            ${member.status}
                                        </span>
                                    </td>
                                    <td>
                                        ${member.role !== 'OWNER' ? `
                                            <button class="btn btn-ghost btn-sm text-red-600 demo-placeholder" data-feature="Remove User">
                                                <i data-lucide="trash-2" class="w-4 h-4"></i>
                                                Remove
                                            </button>
                                        ` : ''}
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </main>
        `;

        if (window.lucide) lucide.createIcons();
        header.init();

        // Demo placeholder buttons - show toast for unimplemented features
        document.querySelectorAll('.demo-placeholder').forEach(el => {
            const eventType = el.tagName === 'SELECT' ? 'change' : 'click';
            el.addEventListener(eventType, (e) => {
                if (el.tagName === 'SELECT') {
                    // Reset select to original value
                    e.preventDefault();
                }
                const feature = el.dataset.feature || 'This feature';
                showToast(`${feature} - not included in the identity demo!`, 'info');
            });
        });
    });
}

/**
 * Render 404 not found page
 */
function renderNotFound(path) {
    const app = document.getElementById('app');

    app.innerHTML = `
        <div class="min-h-screen flex items-center justify-center bg-gray-50">
            <div class="card p-8 max-w-md text-center">
                <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                    <i data-lucide="file-question" class="w-8 h-8 text-gray-400"></i>
                </div>
                <h1 class="text-2xl font-semibold text-gray-900 mb-2">Page Not Found</h1>
                <p class="text-gray-600 mb-6">The page you're looking for doesn't exist or has been moved.</p>
                <a href="#/dashboard" class="btn btn-primary">
                    Return to Dashboard
                </a>
            </div>
        </div>
    `;

    if (window.lucide) lucide.createIcons();
}

/**
 * Get initials from name
 */
function getInitials(name) {
    if (!name) return '?';
    const parts = name.split(' ');
    if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// Export for debugging
window.AnyBank = {
    state,
    auth,
    api,
    router
};
