/**
 * State Management Module
 * Simple pub/sub state management with persistence
 */

const STORAGE_KEY = 'anybank_state';

// Initial state structure
const initialState = {
    user: null,
    currentTenant: null,
    availableTenants: [],
    tokens: {
        identity: null,
        access: null,
        expiresAt: null
    },
    accounts: [],
    ui: {
        loading: false,
        loadingText: 'Loading...',
        error: null,
        sidebarOpen: false
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
const state = {
    _state: deepClone(initialState),
    _subscribers: new Map(),
    _globalSubscribers: [],

    /**
     * Get state value by path
     * @param {string} path - Dot-separated path (e.g., 'user.name')
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
     * Persist critical state to sessionStorage
     */
    persist() {
        const persistData = {
            user: this._state.user,
            currentTenant: this._state.currentTenant,
            availableTenants: this._state.availableTenants,
            tokens: this._state.tokens
        };
        try {
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(persistData));
        } catch (e) {
            console.warn('Failed to persist state:', e);
        }
    },

    /**
     * Restore state from sessionStorage
     * @returns {boolean} True if state was restored
     */
    hydrate() {
        try {
            const stored = sessionStorage.getItem(STORAGE_KEY);
            if (stored) {
                const data = JSON.parse(stored);
                this._state.user = data.user;
                this._state.currentTenant = data.currentTenant;
                this._state.availableTenants = data.availableTenants || [];
                this._state.tokens = data.tokens;
                this._notifyGlobalSubscribers();
                return true;
            }
        } catch (e) {
            console.warn('Failed to hydrate state:', e);
        }
        return false;
    },

    /**
     * Clear persisted state
     */
    clearStorage() {
        try {
            sessionStorage.removeItem(STORAGE_KEY);
        } catch (e) {
            console.warn('Failed to clear storage:', e);
        }
    },

    /**
     * Check if user is authenticated
     * BFF pattern: we check for user object, not tokens (tokens are server-side)
     * @returns {boolean}
     */
    isAuthenticated() {
        return !!this._state.user;
    },

    /**
     * Check if tenant is selected
     * @returns {boolean}
     */
    hasTenantContext() {
        return !!this._state.currentTenant;
    },

    /**
     * Check if token is expired or about to expire
     * @param {number} bufferMs - Buffer time in milliseconds (default 60s)
     * @returns {boolean}
     */
    isTokenExpired(bufferMs = 60000) {
        const expiresAt = this._state.tokens.expiresAt;
        if (!expiresAt) return true;
        return Date.now() > (expiresAt - bufferMs);
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
export default state;

// Named exports for convenience
export const getState = (path) => state.get(path);
export const setState = (path, value) => state.set(path, value);
export const subscribe = (path, callback) => state.subscribe(path, callback);
export const persist = () => state.persist();
export const hydrate = () => state.hydrate();
