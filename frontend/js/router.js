/**
 * Router Module
 * Hash-based client-side routing
 */

import auth from './auth.js';
import state from './state.js';

// Route definitions
const routes = new Map();
let notFoundHandler = null;
let beforeEachGuard = null;

/**
 * Parse hash into path and params
 * @param {string} hash - URL hash
 * @returns {Object} { path, params }
 */
function parseHash(hash) {
    // Remove leading #
    let path = hash.replace(/^#/, '') || '/';

    // Handle query parameters in hash
    const queryIndex = path.indexOf('?');
    let params = {};
    if (queryIndex > -1) {
        const queryString = path.substring(queryIndex + 1);
        path = path.substring(0, queryIndex);
        params = Object.fromEntries(new URLSearchParams(queryString));
    }

    return { path, params };
}

/**
 * Match path against registered routes
 * @param {string} path - Path to match
 * @returns {Object|null} Matched route info or null
 */
function matchRoute(path) {
    for (const [pattern, config] of routes) {
        const match = matchPattern(pattern, path);
        if (match) {
            return { ...config, params: match.params };
        }
    }
    return null;
}

/**
 * Match path against a pattern
 * @param {string} pattern - Route pattern (e.g., '/accounts/:id')
 * @param {string} path - Path to match
 * @returns {Object|null} Match result with params or null
 */
function matchPattern(pattern, path) {
    const patternParts = pattern.split('/').filter(Boolean);
    const pathParts = path.split('/').filter(Boolean);

    if (patternParts.length !== pathParts.length) {
        return null;
    }

    const params = {};

    for (let i = 0; i < patternParts.length; i++) {
        const patternPart = patternParts[i];
        const pathPart = pathParts[i];

        if (patternPart.startsWith(':')) {
            // Parameter
            const paramName = patternPart.substring(1);
            params[paramName] = decodeURIComponent(pathPart);
        } else if (patternPart !== pathPart) {
            // Literal mismatch
            return null;
        }
    }

    return { params };
}

/**
 * Router module
 */
const router = {
    /**
     * Register a route
     * @param {string} path - Route path pattern
     * @param {Object} config - Route configuration
     */
    route(path, config) {
        routes.set(path, {
            component: config.component,
            requiresAuth: config.requiresAuth ?? true,
            requiresTenant: config.requiresTenant ?? false,
            requiredRole: config.requiredRole ?? null,
            title: config.title ?? 'AnyBank'
        });
    },

    /**
     * Set 404 handler
     * @param {Function} handler - Handler function
     */
    notFound(handler) {
        notFoundHandler = handler;
    },

    /**
     * Set before-each navigation guard
     * @param {Function} guard - Guard function(to, from, next)
     */
    beforeEach(guard) {
        beforeEachGuard = guard;
    },

    /**
     * Navigate to a path
     * @param {string} path - Path to navigate to
     * @param {Object} options - Navigation options
     */
    navigate(path, options = {}) {
        const { replace = false, queryParams = {} } = options;

        let hash = `#${path}`;
        if (Object.keys(queryParams).length > 0) {
            hash += '?' + new URLSearchParams(queryParams).toString();
        }

        if (replace) {
            window.location.replace(hash);
        } else {
            window.location.hash = hash;
        }
    },

    /**
     * Replace current path without adding to history
     * @param {string} path - Path to navigate to
     */
    replace(path) {
        this.navigate(path, { replace: true });
    },

    /**
     * Go back in history
     */
    back() {
        window.history.back();
    },

    /**
     * Get current path
     * @returns {string}
     */
    getCurrentPath() {
        return parseHash(window.location.hash).path;
    },

    /**
     * Get current query params
     * @returns {Object}
     */
    getQueryParams() {
        return parseHash(window.location.hash).params;
    },

    /**
     * Handle route change
     */
    async handleRouteChange() {
        const { path, params: queryParams } = parseHash(window.location.hash);
        const matched = matchRoute(path);

        if (!matched) {
            if (notFoundHandler) {
                notFoundHandler(path);
            }
            return;
        }

        const { component, requiresAuth, requiresTenant, requiredRole, params, title } = matched;

        // Set page title
        document.title = title;

        // Run before-each guard
        if (beforeEachGuard) {
            const proceed = await new Promise(resolve => {
                beforeEachGuard(
                    { path, params, queryParams, requiresAuth, requiresTenant, requiredRole },
                    null,
                    resolve
                );
            });
            if (!proceed) return;
        }

        // Auth guard
        if (requiresAuth && !auth.isAuthenticated()) {
            this.navigate('/login', { replace: true });
            return;
        }

        // Tenant guard
        if (requiresTenant && !auth.hasTenantContext()) {
            this.navigate('/select-organization', { replace: true });
            return;
        }

        // Role guard
        if (requiredRole) {
            const currentTenant = state.get('currentTenant');
            const userRole = currentTenant?.role;
            if (!hasRequiredRole(userRole, requiredRole)) {
                this.renderForbidden();
                return;
            }
        }

        // Render component
        if (typeof component === 'function') {
            try {
                await component({ params, queryParams });
            } catch (error) {
                console.error('Error rendering route:', error);
                this.renderError(error);
            }
        }
    },

    /**
     * Render 403 Forbidden page
     */
    renderForbidden() {
        const app = document.getElementById('app');
        app.innerHTML = `
            <div class="min-h-screen flex items-center justify-center bg-gray-50">
                <div class="card p-8 max-w-md text-center">
                    <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
                        <i data-lucide="shield-x" class="w-8 h-8 text-red-600"></i>
                    </div>
                    <h1 class="text-2xl font-semibold text-gray-900 mb-2">Access Denied</h1>
                    <p class="text-gray-600 mb-6">You don't have permission to access this page.</p>
                    <button onclick="window.location.hash='#/dashboard'" class="btn btn-primary">
                        Return to Dashboard
                    </button>
                </div>
            </div>
        `;
        if (window.lucide) lucide.createIcons();
    },

    /**
     * Render error page
     * @param {Error} error - Error object
     */
    renderError(error) {
        const app = document.getElementById('app');
        app.innerHTML = `
            <div class="min-h-screen flex items-center justify-center bg-gray-50">
                <div class="card p-8 max-w-md text-center">
                    <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
                        <i data-lucide="alert-circle" class="w-8 h-8 text-red-600"></i>
                    </div>
                    <h1 class="text-2xl font-semibold text-gray-900 mb-2">Something went wrong</h1>
                    <p class="text-gray-600 mb-6">${escapeHtml(error.message || 'An unexpected error occurred.')}</p>
                    <button onclick="window.location.reload()" class="btn btn-primary">
                        Reload Page
                    </button>
                </div>
            </div>
        `;
        if (window.lucide) lucide.createIcons();
    },

    /**
     * Start listening for route changes
     */
    start() {
        // Handle initial route
        this.handleRouteChange();

        // Listen for hash changes
        window.addEventListener('hashchange', () => {
            this.handleRouteChange();
        });
    }
};

/**
 * Check if user has required role
 * @param {string} userRole - User's current role
 * @param {string} requiredRole - Required role
 * @returns {boolean}
 */
function hasRequiredRole(userRole, requiredRole) {
    const roleHierarchy = ['VIEWER', 'OPERATOR', 'ADMIN', 'OWNER'];
    const userRoleIndex = roleHierarchy.indexOf(userRole);
    const requiredRoleIndex = roleHierarchy.indexOf(requiredRole);
    return userRoleIndex >= requiredRoleIndex;
}

/**
 * Escape HTML to prevent XSS
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

export default router;
export { hasRequiredRole, escapeHtml };
