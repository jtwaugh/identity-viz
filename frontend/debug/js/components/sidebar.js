/**
 * Sidebar Navigation Component
 * 8 navigation groups as specified
 */

import debugState from '../state.js';
import router from '../router.js';

// Navigation group definitions
const navigationGroups = [
    {
        id: 'DATA',
        title: 'Data',
        icon: 'database',
        items: [
            { route: 'data/users', title: 'Users', icon: 'users' },
            { route: 'data/tenants', title: 'Tenants', icon: 'building-2' },
            { route: 'data/memberships', title: 'Memberships', icon: 'users-round' },
            { route: 'data/accounts', title: 'Accounts', icon: 'wallet' },
            { route: 'data/sessions', title: 'Sessions', icon: 'activity' }
        ]
    },
    {
        id: 'AUTH',
        title: 'Auth',
        icon: 'shield',
        items: [
            { route: 'auth/tokens', title: 'Active Tokens', icon: 'key-round' },
            { route: 'auth/decoder', title: 'JWT Decoder', icon: 'file-code' },
            { route: 'auth/events', title: 'Keycloak Events', icon: 'lock' }
        ]
    },
    {
        id: 'NETWORK',
        title: 'Network',
        icon: 'globe',
        items: [
            { route: 'network/requests', title: 'Request Log', icon: 'list' },
            { route: 'network/correlation', title: 'Correlation View', icon: 'git-branch' },
            { route: 'network/waterfall', title: 'Waterfall', icon: 'bar-chart-3' }
        ]
    },
    {
        id: 'POLICY',
        title: 'Policy',
        icon: 'scale',
        items: [
            { route: 'policy/decisions', title: 'OPA Decisions', icon: 'check-circle' },
            { route: 'policy/risk', title: 'Risk Analysis', icon: 'alert-triangle' },
            { route: 'policy/browser', title: 'Policy Browser', icon: 'file-text' }
        ]
    },
    {
        id: 'WORKFLOWS',
        title: 'Workflows',
        icon: 'workflow',
        items: [
            { route: 'workflows/timeline', title: 'Session Timeline', icon: 'clock' },
            { route: 'workflows/replay', title: 'Replay Session', icon: 'play-circle' }
        ]
    },
    {
        id: 'CONTROLS',
        title: 'Controls',
        icon: 'sliders',
        items: [
            { route: 'controls/demo', title: 'Demo Controls', icon: 'settings' }
        ]
    },
    {
        id: 'HEALTH',
        title: 'Health',
        icon: 'heart-pulse',
        items: [
            { route: 'health/services', title: 'Service Health', icon: 'activity' }
        ]
    },
    {
        id: 'DOCS',
        title: 'Docs',
        icon: 'book-open',
        items: [
            { route: 'docs/api', title: 'API Documentation', icon: 'file-text' }
        ]
    }
];

/**
 * Get Lucide icon SVG
 */
function getIcon(name, size = 16) {
    // Use Lucide icons if available
    return `<i data-lucide="${name}" class="w-4 h-4"></i>`;
}

/**
 * Render the sidebar navigation
 */
function renderSidebar() {
    const collapsedGroups = debugState.get('ui.sidebarCollapsedGroups') || [];
    const currentRoute = router.getCurrentRoute() || 'data/users';

    return navigationGroups.map(group => {
        const isCollapsed = collapsedGroups.includes(group.id);

        return `
            <div class="nav-group ${isCollapsed ? 'collapsed' : ''}" data-group="${group.id}">
                <div class="nav-group-header" data-group-toggle="${group.id}">
                    <div class="flex items-center gap-2">
                        ${getIcon(group.icon)}
                        <span class="nav-group-title">${group.title}</span>
                    </div>
                    <svg class="nav-group-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                    </svg>
                </div>
                <div class="nav-group-items">
                    ${group.items.map(item => `
                        <div class="nav-item ${currentRoute === item.route ? 'active' : ''}" data-route="${item.route}">
                            ${getIcon(item.icon)}
                            <span>${item.title}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Initialize the sidebar
 */
export function initSidebar() {
    const sidebarNav = document.getElementById('sidebar-nav');
    if (!sidebarNav) return;

    // Render initial content
    sidebarNav.innerHTML = renderSidebar();

    // Initialize Lucide icons
    if (window.lucide) {
        window.lucide.createIcons();
    }

    // Setup event handlers
    setupEventHandlers();

    // Subscribe to state changes
    debugState.subscribe('ui.sidebarCollapsedGroups', () => {
        sidebarNav.innerHTML = renderSidebar();
        if (window.lucide) {
            window.lucide.createIcons();
        }
        setupEventHandlers();
    });
}

/**
 * Setup sidebar event handlers
 */
function setupEventHandlers() {
    // Group toggle handlers
    document.querySelectorAll('[data-group-toggle]').forEach(header => {
        header.addEventListener('click', () => {
            const groupId = header.getAttribute('data-group-toggle');
            debugState.toggleSidebarGroup(groupId);
            debugState.persistPreferences();
        });
    });

    // Navigation item handlers
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            const route = item.getAttribute('data-route');
            if (route) {
                router.navigate(route);
            }
        });
    });
}

/**
 * Update sidebar active state
 */
export function updateSidebarActive(route) {
    document.querySelectorAll('.nav-item').forEach(item => {
        if (item.getAttribute('data-route') === route) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
}

export default {
    initSidebar,
    updateSidebarActive,
    navigationGroups
};
