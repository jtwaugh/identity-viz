/**
 * Debug Application State Management
 * Centralized state for the debug control plane
 */

const DEBUG_STORAGE_KEY = 'anybank_debug_state';

// Initial state structure
const initialState = {
    // Connection status
    connection: {
        status: 'disconnected', // 'connected', 'disconnected', 'reconnecting'
        lastConnected: null,
        reconnectAttempts: 0
    },

    // Current view/route
    currentView: null,
    currentSection: null,

    // Live events
    events: [],
    eventsPaused: false,
    eventsFilter: 'all',
    maxEvents: 50,

    // Data entities (cached from backend)
    data: {
        users: [],
        tenants: [],
        memberships: [],
        accounts: [],
        sessions: []
    },

    // Auth/Token state
    auth: {
        activeTokens: [],
        keycloakEvents: [],
        selectedToken: null
    },

    // Network requests
    network: {
        requests: [],
        selectedRequest: null,
        correlationId: null
    },

    // OPA policy decisions
    policy: {
        decisions: [],
        selectedDecision: null,
        policies: []
    },

    // Workflow/Session tracking
    workflows: {
        currentSession: null,
        sessionEvents: [],
        replayState: null
    },

    // Service health
    health: {
        backend: { status: 'unknown', metrics: {} },
        postgres: { status: 'unknown', metrics: {} },
        keycloak: { status: 'unknown', metrics: {} },
        opa: { status: 'unknown', metrics: {} }
    },

    // UI state
    ui: {
        slideOverOpen: false,
        slideOverContent: null,
        bottomPanelCollapsed: false,
        sidebarCollapsedGroups: []
    }
};

// Deep clone helper
function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

// Get nested value from object by path (e.g., 'user.name')
function getByPath(obj, path) {
    return path.split('.').reduce((acc, part) => acc && acc[part], obj);
}

// Set nested value in object by path
function setByPath(obj, path, value) {
    const parts = path.split('.');
    const last = parts.pop();
    const parent = parts.reduce((acc, part) => {
        if (acc[part] === undefined) acc[part] = {};
        return acc[part];
    }, obj);
    parent[last] = value;
}

// State module
const debugState = {
    _state: deepClone(initialState),
    _subscribers: new Map(),
    _globalSubscribers: [],

    /**
     * Get state value by path
     * @param {string} path - Dot-separated path (e.g., 'events')
     * @returns {*} The value at the path
     */
    get(path) {
        if (!path) return deepClone(this._state);
        return deepClone(getByPath(this._state, path));
    },

    /**
     * Set state value by path
     * @param {string} path - Dot-separated path
     * @param {*} value - Value to set
     */
    set(path, value) {
        setByPath(this._state, path, value);
        this._notifySubscribers(path, value);
        this._notifyGlobalSubscribers();
    },

    /**
     * Update multiple state values
     * @param {Object} updates - Object with path:value pairs
     */
    update(updates) {
        Object.entries(updates).forEach(([path, value]) => {
            setByPath(this._state, path, value);
            this._notifySubscribers(path, value);
        });
        this._notifyGlobalSubscribers();
    },

    /**
     * Subscribe to state changes at a specific path
     * @param {string} path - Path to watch
     * @param {Function} callback - Callback function(newValue, path)
     * @returns {Function} Unsubscribe function
     */
    subscribe(path, callback) {
        if (!this._subscribers.has(path)) {
            this._subscribers.set(path, new Set());
        }
        this._subscribers.get(path).add(callback);

        return () => {
            this._subscribers.get(path).delete(callback);
        };
    },

    /**
     * Subscribe to all state changes
     * @param {Function} callback - Callback function(state)
     * @returns {Function} Unsubscribe function
     */
    subscribeAll(callback) {
        this._globalSubscribers.push(callback);
        return () => {
            const index = this._globalSubscribers.indexOf(callback);
            if (index > -1) this._globalSubscribers.splice(index, 1);
        };
    },

    /**
     * Reset state to initial values
     */
    reset() {
        this._state = deepClone(initialState);
        this._notifyGlobalSubscribers();
    },

    /**
     * Add an event to the events list (with max limit)
     * @param {Object} event - Event object
     */
    addEvent(event) {
        const events = this._state.events;
        events.unshift({
            ...event,
            id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: event.timestamp || new Date().toISOString()
        });

        // Keep only maxEvents
        if (events.length > this._state.maxEvents) {
            events.pop();
        }

        this._notifySubscribers('events', events);
        this._notifyGlobalSubscribers();
    },

    /**
     * Clear all events
     */
    clearEvents() {
        this._state.events = [];
        this._notifySubscribers('events', []);
        this._notifyGlobalSubscribers();
    },

    /**
     * Add a network request
     * @param {Object} request - Request object
     */
    addRequest(request) {
        const requests = this._state.network.requests;
        requests.unshift({
            ...request,
            id: request.id || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        });

        // Keep last 100 requests
        if (requests.length > 100) {
            requests.pop();
        }

        this._notifySubscribers('network.requests', requests);
        this._notifyGlobalSubscribers();
    },

    /**
     * Add an OPA decision
     * @param {Object} decision - Decision object
     */
    addDecision(decision) {
        const decisions = this._state.policy.decisions;
        decisions.unshift({
            ...decision,
            id: decision.id || `dec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        });

        // Keep last 100 decisions
        if (decisions.length > 100) {
            decisions.pop();
        }

        this._notifySubscribers('policy.decisions', decisions);
        this._notifyGlobalSubscribers();
    },

    /**
     * Update service health
     * @param {string} service - Service name
     * @param {Object} health - Health data
     */
    updateHealth(service, health) {
        if (this._state.health[service]) {
            this._state.health[service] = {
                ...this._state.health[service],
                ...health,
                lastCheck: new Date().toISOString()
            };
            this._notifySubscribers(`health.${service}`, this._state.health[service]);
            this._notifyGlobalSubscribers();
        }
    },

    /**
     * Open slide-over panel
     * @param {string} title - Panel title
     * @param {Object} content - Content configuration
     */
    openSlideOver(title, content) {
        this.update({
            'ui.slideOverOpen': true,
            'ui.slideOverContent': { title, ...content }
        });
    },

    /**
     * Close slide-over panel
     */
    closeSlideOver() {
        this.update({
            'ui.slideOverOpen': false,
            'ui.slideOverContent': null
        });
    },

    /**
     * Toggle bottom panel collapse
     */
    toggleBottomPanel() {
        this.set('ui.bottomPanelCollapsed', !this._state.ui.bottomPanelCollapsed);
    },

    /**
     * Toggle sidebar group collapse
     * @param {string} groupId - Group identifier
     */
    toggleSidebarGroup(groupId) {
        const collapsed = this._state.ui.sidebarCollapsedGroups;
        const index = collapsed.indexOf(groupId);
        if (index > -1) {
            collapsed.splice(index, 1);
        } else {
            collapsed.push(groupId);
        }
        this._notifySubscribers('ui.sidebarCollapsedGroups', collapsed);
        this._notifyGlobalSubscribers();
    },

    /**
     * Check if sidebar group is collapsed
     * @param {string} groupId - Group identifier
     * @returns {boolean}
     */
    isGroupCollapsed(groupId) {
        return this._state.ui.sidebarCollapsedGroups.includes(groupId);
    },

    /**
     * Persist UI preferences to localStorage
     */
    persistPreferences() {
        try {
            const prefs = {
                sidebarCollapsedGroups: this._state.ui.sidebarCollapsedGroups,
                bottomPanelCollapsed: this._state.ui.bottomPanelCollapsed
            };
            localStorage.setItem(DEBUG_STORAGE_KEY, JSON.stringify(prefs));
        } catch (e) {
            console.warn('Failed to persist debug preferences:', e);
        }
    },

    /**
     * Restore UI preferences from localStorage
     */
    restorePreferences() {
        try {
            const stored = localStorage.getItem(DEBUG_STORAGE_KEY);
            if (stored) {
                const prefs = JSON.parse(stored);
                this._state.ui.sidebarCollapsedGroups = prefs.sidebarCollapsedGroups || [];
                this._state.ui.bottomPanelCollapsed = prefs.bottomPanelCollapsed || false;
            }
        } catch (e) {
            console.warn('Failed to restore debug preferences:', e);
        }
    },

    // Private methods
    _notifySubscribers(path, value) {
        // Notify exact path subscribers
        if (this._subscribers.has(path)) {
            this._subscribers.get(path).forEach(cb => cb(value, path));
        }

        // Notify parent path subscribers
        const parts = path.split('.');
        for (let i = 1; i < parts.length; i++) {
            const parentPath = parts.slice(0, i).join('.');
            if (this._subscribers.has(parentPath)) {
                const parentValue = getByPath(this._state, parentPath);
                this._subscribers.get(parentPath).forEach(cb => cb(parentValue, parentPath));
            }
        }
    },

    _notifyGlobalSubscribers() {
        const stateCopy = deepClone(this._state);
        this._globalSubscribers.forEach(cb => cb(stateCopy));
    }
};

// Export state module
export default debugState;

// Named exports for convenience
export const getState = (path) => debugState.get(path);
export const setState = (path, value) => debugState.set(path, value);
export const subscribe = (path, callback) => debugState.subscribe(path, callback);
export const addEvent = (event) => debugState.addEvent(event);
export const clearEvents = () => debugState.clearEvents();
