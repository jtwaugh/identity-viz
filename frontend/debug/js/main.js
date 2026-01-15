/**
 * Debug Control Plane - Main Entry Point
 * Initializes all components and services
 */

import debugState from './state.js';
import sseClient from './sse.js';
import router from './router.js';
import { initSidebar } from './components/sidebar.js';
import { initLiveEvents } from './components/live-events.js';

/**
 * Initialize the debug application
 */
async function init() {
    console.log('[Debug] Initializing Debug Control Plane...');

    // Restore UI preferences
    debugState.restorePreferences();

    // Initialize Lucide icons
    if (window.lucide) {
        window.lucide.createIcons();
    }

    // Initialize sidebar
    initSidebar();

    // Initialize live events panel
    initLiveEvents();

    // Initialize router
    router.init();

    // Setup global event handlers
    setupGlobalHandlers();

    // Connect to SSE stream
    sseClient.connect();

    // Setup slide-over
    setupSlideOver();

    // Setup bottom panel toggle
    setupBottomPanel();

    console.log('[Debug] Debug Control Plane initialized');
}

/**
 * Setup global event handlers
 */
function setupGlobalHandlers() {
    // Clear all button
    const clearAllBtn = document.getElementById('clear-all-btn');
    if (clearAllBtn) {
        clearAllBtn.addEventListener('click', () => {
            debugState.clearEvents();
            debugState.set('network.requests', []);
            debugState.set('policy.decisions', []);
            showToast('success', 'All data cleared');
        });
    }

    // Handle keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Escape to close slide-over
        if (e.key === 'Escape') {
            debugState.closeSlideOver();
        }

        // Ctrl/Cmd + K to focus search (future feature)
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            // Future: focus search
        }
    });
}

/**
 * Setup slide-over panel
 */
function setupSlideOver() {
    const slideOver = document.getElementById('slide-over');
    const closeBtn = document.getElementById('close-slide-over');

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            debugState.closeSlideOver();
        });
    }

    // Subscribe to slide-over state changes
    debugState.subscribe('ui.slideOverOpen', (isOpen) => {
        if (slideOver) {
            if (isOpen) {
                slideOver.classList.remove('hidden');
                setTimeout(() => slideOver.classList.add('open'), 10);
            } else {
                slideOver.classList.remove('open');
                setTimeout(() => slideOver.classList.add('hidden'), 300);
            }
        }
    });

    // Subscribe to slide-over content changes
    debugState.subscribe('ui.slideOverContent', (content) => {
        const titleEl = document.getElementById('slide-over-title');
        const contentEl = document.getElementById('slide-over-content');

        if (titleEl && content) {
            titleEl.textContent = content.title || 'Details';
        }

        if (contentEl && content) {
            if (content.html) {
                contentEl.innerHTML = content.html;
            } else if (content.component) {
                // Load component dynamically
                loadSlideOverComponent(content.component, content.props);
            }
        }
    });
}

/**
 * Load a component into the slide-over
 */
async function loadSlideOverComponent(componentName, props) {
    const contentEl = document.getElementById('slide-over-content');
    if (!contentEl) return;

    try {
        const module = await import(`./components/${componentName}.js`);
        const component = module.default || module;

        if (component && typeof component.render === 'function') {
            const html = component.render(props);
            contentEl.innerHTML = html;

            if (typeof component.init === 'function') {
                component.init(props);
            }
        }
    } catch (error) {
        console.error('[Debug] Failed to load slide-over component:', error);
        contentEl.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">&#9888;</div>
                <div class="empty-state-title">Error</div>
                <div class="empty-state-description">${error.message}</div>
            </div>
        `;
    }
}

/**
 * Setup bottom panel toggle
 */
function setupBottomPanel() {
    const bottomPanel = document.getElementById('bottom-panel');
    const toggleBtn = document.getElementById('toggle-panel-btn');

    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            debugState.toggleBottomPanel();
        });
    }

    // Subscribe to bottom panel state changes
    debugState.subscribe('ui.bottomPanelCollapsed', (isCollapsed) => {
        if (bottomPanel) {
            if (isCollapsed) {
                bottomPanel.classList.add('collapsed');
                toggleBtn.textContent = 'Expand';
            } else {
                bottomPanel.classList.remove('collapsed');
                toggleBtn.textContent = 'Collapse';
            }
        }
        debugState.persistPreferences();
    });

    // Apply initial state
    if (debugState.get('ui.bottomPanelCollapsed')) {
        bottomPanel?.classList.add('collapsed');
        if (toggleBtn) toggleBtn.textContent = 'Expand';
    }
}

/**
 * Show toast notification
 */
function showToast(type, message, duration = 5000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const iconMap = {
        success: '&#10004;',
        error: '&#10006;',
        warning: '&#9888;',
        info: '&#8505;'
    };

    toast.innerHTML = `
        <span class="status-dot status-${type === 'error' ? 'error' : type === 'success' ? 'success' : 'info'}"></span>
        <span class="text-sm text-slate-200">${message}</span>
    `;

    container.appendChild(toast);

    // Auto-remove
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// Export for use by other modules
window.debugApp = {
    state: debugState,
    sse: sseClient,
    router,
    showToast
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
