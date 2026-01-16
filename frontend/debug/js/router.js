/**
 * Debug Application Router
 * Hash-based client-side routing for debug dashboard
 */

import debugState from './state.js';

// Route definitions
const routes = {
    // Data routes
    'data/users': {
        component: 'users-table',
        title: 'Users',
        section: 'DATA'
    },
    'data/tenants': {
        component: 'tenants-table',
        title: 'Tenants',
        section: 'DATA'
    },
    'data/memberships': {
        component: 'memberships-table',
        title: 'Memberships',
        section: 'DATA'
    },
    'data/accounts': {
        component: 'accounts-table',
        title: 'Accounts',
        section: 'DATA'
    },
    'data/sessions': {
        component: 'sessions-table',
        title: 'Sessions',
        section: 'DATA'
    },

    // Auth routes
    'auth/tokens': {
        component: 'active-tokens',
        title: 'Active Tokens',
        section: 'AUTH'
    },
    'auth/decoder': {
        component: 'jwt-decoder',
        title: 'JWT Decoder',
        section: 'AUTH'
    },
    'auth/events': {
        component: 'keycloak-events',
        title: 'Keycloak Events',
        section: 'AUTH'
    },

    // Network routes
    'network/requests': {
        component: 'request-log',
        title: 'Request Log',
        section: 'NETWORK'
    },
    'network/correlation': {
        component: 'correlation-view',
        title: 'Correlation View',
        section: 'NETWORK'
    },
    'network/waterfall': {
        component: 'waterfall',
        title: 'Waterfall',
        section: 'NETWORK'
    },

    // Policy routes
    'policy/decisions': {
        component: 'opa-decisions',
        title: 'OPA Decisions',
        section: 'POLICY'
    },
    'policy/risk': {
        component: 'risk-breakdown',
        title: 'Risk Analysis',
        section: 'POLICY'
    },
    'policy/browser': {
        component: 'policy-browser',
        title: 'Policy Browser',
        section: 'POLICY'
    },

    // Workflow routes
    'workflows/timeline': {
        component: 'session-timeline',
        title: 'Session Timeline',
        section: 'WORKFLOWS'
    },
    'workflows/replay': {
        component: 'replay-controls',
        title: 'Replay Session',
        section: 'WORKFLOWS'
    },

    // Control routes
    'controls/demo': {
        component: 'demo-controls',
        title: 'Demo Controls',
        section: 'CONTROLS'
    },

    // Health routes
    'health/services': {
        component: 'service-health',
        title: 'Service Health',
        section: 'HEALTH'
    },

    // Docs routes
    'docs/api': {
        component: 'api-docs',
        title: 'API Documentation',
        section: 'DOCS'
    }
};

// Component loaders (lazy loading)
const componentLoaders = {};

class Router {
    constructor() {
        this.currentRoute = null;
        this.components = new Map();
        this.onRouteChange = null;
    }

    /**
     * Initialize the router
     */
    init() {
        // Listen for hash changes
        window.addEventListener('hashchange', () => this.handleRouteChange());

        // Handle initial route
        this.handleRouteChange();
    }

    /**
     * Handle route changes
     */
    async handleRouteChange() {
        const hash = window.location.hash.slice(1) || 'data/users';
        const route = routes[hash];

        if (!route) {
            console.warn(`[Router] Unknown route: ${hash}`);
            this.navigate('data/users');
            return;
        }

        this.currentRoute = hash;

        // Close slide-over panel when navigating to a new route
        debugState.closeSlideOver();

        // Update state
        debugState.update({
            'currentView': hash,
            'currentSection': route.section
        });

        // Load and render component
        await this.renderComponent(route);

        // Update sidebar active state
        this.updateSidebarActive(hash);

        // Call route change handler if set
        if (this.onRouteChange) {
            this.onRouteChange(hash, route);
        }
    }

    /**
     * Navigate to a route
     */
    navigate(path) {
        window.location.hash = path;
    }

    /**
     * Render a component
     */
    async renderComponent(route) {
        const mainContent = document.getElementById('main-content');
        if (!mainContent) return;

        // Show loading state
        mainContent.innerHTML = `
            <div class="flex items-center justify-center h-64">
                <div class="spinner"></div>
            </div>
        `;

        try {
            // Get or load component
            let component = this.components.get(route.component);

            if (!component) {
                component = await this.loadComponent(route.component);
                if (component) {
                    this.components.set(route.component, component);
                }
            }

            if (component && typeof component.render === 'function') {
                const content = await component.render();
                mainContent.innerHTML = '';

                if (typeof content === 'string') {
                    mainContent.innerHTML = content;
                } else if (content instanceof HTMLElement) {
                    mainContent.appendChild(content);
                }

                // Initialize component if needed
                if (typeof component.init === 'function') {
                    component.init();
                }
            } else {
                mainContent.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-state-icon">&#128679;</div>
                        <div class="empty-state-title">${route.title}</div>
                        <div class="empty-state-description">Component not implemented yet</div>
                    </div>
                `;
            }
        } catch (error) {
            console.error(`[Router] Failed to render component: ${route.component}`, error);
            mainContent.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">&#9888;</div>
                    <div class="empty-state-title">Error Loading Component</div>
                    <div class="empty-state-description">${error.message}</div>
                </div>
            `;
        }
    }

    /**
     * Load a component dynamically
     */
    async loadComponent(componentName) {
        // Map component names to module paths
        const componentPaths = {
            // Data components
            'users-table': './components/data/users-table.js',
            'tenants-table': './components/data/tenants-table.js',
            'memberships-table': './components/data/memberships-table.js',
            'accounts-table': './components/data/accounts-table.js',
            'sessions-table': './components/data/sessions-table.js',

            // Auth components
            'active-tokens': './components/auth/active-tokens.js',
            'jwt-decoder': './components/auth/jwt-decoder.js',
            'keycloak-events': './components/auth/keycloak-events.js',

            // Network components
            'request-log': './components/network/request-log.js',
            'request-detail': './components/network/request-detail.js',
            'correlation-view': './components/network/correlation-view.js',
            'waterfall': './components/network/waterfall.js',

            // Policy components
            'opa-decisions': './components/policy/opa-decisions.js',
            'decision-detail': './components/policy/decision-detail.js',
            'risk-breakdown': './components/policy/risk-breakdown.js',
            'policy-browser': './components/policy/policy-browser.js',

            // Workflow components
            'session-timeline': './components/workflows/session-timeline.js',
            'replay-controls': './components/workflows/replay-controls.js',

            // Control components
            'demo-controls': './components/controls/demo-controls.js',

            // Health components
            'service-health': './components/health/service-health.js',

            // Docs components
            'api-docs': './components/docs/api-docs.js'
        };

        const path = componentPaths[componentName];
        if (!path) {
            console.warn(`[Router] No path defined for component: ${componentName}`);
            return null;
        }

        try {
            const module = await import(path);
            return module.default || module;
        } catch (error) {
            console.error(`[Router] Failed to load component: ${componentName}`, error);
            return null;
        }
    }

    /**
     * Update sidebar active state
     */
    updateSidebarActive(currentPath) {
        // Remove active class from all nav items
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });

        // Add active class to current nav item
        const activeItem = document.querySelector(`.nav-item[data-route="${currentPath}"]`);
        if (activeItem) {
            activeItem.classList.add('active');
        }
    }

    /**
     * Get current route
     */
    getCurrentRoute() {
        return this.currentRoute;
    }

    /**
     * Get route info
     */
    getRouteInfo(path) {
        return routes[path];
    }

    /**
     * Get all routes
     */
    getAllRoutes() {
        return { ...routes };
    }

    /**
     * Get routes by section
     */
    getRoutesBySection(section) {
        return Object.entries(routes)
            .filter(([_, route]) => route.section === section)
            .reduce((acc, [path, route]) => {
                acc[path] = route;
                return acc;
            }, {});
    }
}

// Create singleton instance
const router = new Router();

// Export
export default router;
export { routes };
