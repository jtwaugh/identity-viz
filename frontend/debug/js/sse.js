/**
 * SSE Event Stream Client
 * Handles Server-Sent Events for real-time updates
 */

import debugState from './state.js';

// Use relative URL so it works through nginx proxy
const SSE_URL = '/debug/events/stream';

// Event type to icon mapping
const EVENT_ICONS = {
    UI: '&#128433;',      // Mouse
    API: '&#128225;',     // Antenna
    OPA: '&#128737;',     // Shield
    DB: '&#128452;',      // Database
    AUTH: '&#128274;',    // Lock
    TOKEN: '&#127915;',   // Ticket
    AUDIT: '&#128221;',   // Notepad
    ERROR: '&#9888;'      // Warning
};

class SSEClient {
    constructor() {
        this.eventSource = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.reconnectDelay = 1000;
        this.handlers = new Map();
        this.isManuallyDisconnected = false;
    }

    /**
     * Connect to the SSE stream
     */
    connect() {
        if (this.eventSource) {
            this.disconnect();
        }

        this.isManuallyDisconnected = false;

        try {
            this.eventSource = new EventSource(SSE_URL);

            this.eventSource.onopen = () => {
                console.log('[SSE] Connected to event stream');
                this.reconnectAttempts = 0;
                debugState.update({
                    'connection.status': 'connected',
                    'connection.lastConnected': new Date().toISOString(),
                    'connection.reconnectAttempts': 0
                });
                this.updateConnectionUI(true);
            };

            this.eventSource.onerror = (error) => {
                console.error('[SSE] Connection error:', error);
                this.handleDisconnect();
            };

            // Generic message handler
            this.eventSource.onmessage = (event) => {
                this.handleEvent(event);
            };

            // Register specific event type handlers
            this.registerEventHandlers();

        } catch (error) {
            console.error('[SSE] Failed to create EventSource:', error);
            this.handleDisconnect();
        }
    }

    /**
     * Register handlers for specific event types
     */
    registerEventHandlers() {
        const eventTypes = ['ui', 'api', 'opa', 'db', 'auth', 'token', 'audit', 'error', 'health'];

        eventTypes.forEach(type => {
            this.eventSource.addEventListener(type, (event) => {
                this.handleTypedEvent(type.toUpperCase(), event);
            });
        });
    }

    /**
     * Handle generic SSE event
     */
    handleEvent(event) {
        try {
            const data = JSON.parse(event.data);
            const eventType = data.type || 'UNKNOWN';
            this.processEvent(eventType, data);
        } catch (error) {
            console.warn('[SSE] Failed to parse event:', error);
        }
    }

    /**
     * Handle typed SSE event
     */
    handleTypedEvent(type, event) {
        try {
            const data = JSON.parse(event.data);
            this.processEvent(type, data);
        } catch (error) {
            console.warn(`[SSE] Failed to parse ${type} event:`, error);
        }
    }

    /**
     * Process event and update state
     */
    processEvent(type, data) {
        // Skip if events are paused
        if (debugState.get('eventsPaused')) {
            return;
        }

        const event = {
            type,
            icon: EVENT_ICONS[type] || '&#128196;',
            data,
            timestamp: data.timestamp || new Date().toISOString()
        };

        // Add to events list
        debugState.addEvent(event);

        // Handle specific event types
        switch (type) {
            case 'API':
                this.handleApiEvent(data);
                break;
            case 'OPA':
                this.handleOpaEvent(data);
                break;
            case 'AUTH':
            case 'TOKEN':
                this.handleAuthEvent(data);
                break;
            case 'ERROR':
                this.handleErrorEvent(data);
                break;
            case 'health':
                this.handleHealthEvent(data);
                break;
        }

        // Notify registered handlers
        if (this.handlers.has(type)) {
            this.handlers.get(type).forEach(handler => handler(event));
        }
    }

    /**
     * Handle API events - transforms backend events into Request Log format
     */
    handleApiEvent(data) {
        // Handle legacy format with nested request object
        if (data.request) {
            debugState.addRequest({
                ...data.request,
                timestamp: data.timestamp
            });
            return;
        }

        // Handle new action lineage format (response_sent events contain full request info)
        if (data.action === 'response_sent' && data.details) {
            const details = data.details;
            debugState.addRequest({
                id: data.id || `req_${Date.now()}`,
                url: details.path,
                method: details.method,
                status: details.statusCode,
                duration: details.duration,
                timestamp: data.timestamp,
                requestHeaders: details.headers || {},
                responseHeaders: details.headers || {},
                direction: details.direction,
                from: details.from,
                to: details.to
            });
        }
    }

    /**
     * Handle OPA decision events
     */
    handleOpaEvent(data) {
        if (data.decision) {
            debugState.addDecision({
                ...data.decision,
                timestamp: data.timestamp
            });
        }
    }

    /**
     * Handle auth/token events
     */
    handleAuthEvent(data) {
        // Update active tokens if included
        if (data.tokens) {
            debugState.set('auth.activeTokens', data.tokens);
        }
    }

    /**
     * Handle error events
     */
    handleErrorEvent(data) {
        // Show toast notification for errors
        this.showToast('error', data.message || 'An error occurred');
    }

    /**
     * Handle health update events
     */
    handleHealthEvent(data) {
        if (data.service && data.status) {
            debugState.updateHealth(data.service, {
                status: data.status,
                metrics: data.metrics || {}
            });
        }
    }

    /**
     * Handle disconnection
     */
    handleDisconnect() {
        if (this.isManuallyDisconnected) {
            return;
        }

        debugState.set('connection.status', 'disconnected');
        this.updateConnectionUI(false);

        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            debugState.update({
                'connection.status': 'reconnecting',
                'connection.reconnectAttempts': this.reconnectAttempts
            });

            const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
            console.log(`[SSE] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

            setTimeout(() => {
                this.connect();
            }, Math.min(delay, 30000));
        } else {
            console.error('[SSE] Max reconnection attempts reached');
            this.showToast('error', 'Lost connection to server. Please refresh the page.');
        }
    }

    /**
     * Disconnect from the SSE stream
     */
    disconnect() {
        this.isManuallyDisconnected = true;
        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = null;
        }
        debugState.set('connection.status', 'disconnected');
        this.updateConnectionUI(false);
    }

    /**
     * Register an event handler
     */
    on(eventType, handler) {
        if (!this.handlers.has(eventType)) {
            this.handlers.set(eventType, new Set());
        }
        this.handlers.get(eventType).add(handler);

        return () => {
            this.handlers.get(eventType).delete(handler);
        };
    }

    /**
     * Update connection status in UI
     */
    updateConnectionUI(connected) {
        const statusEl = document.getElementById('connection-status');
        if (statusEl) {
            const dot = statusEl.querySelector('span:first-child');
            const text = statusEl.querySelector('span:last-child');

            if (connected) {
                dot.className = 'w-2 h-2 rounded-full bg-green-500 pulse';
                text.textContent = 'Connected';
                text.className = 'text-green-400';
            } else {
                dot.className = 'w-2 h-2 rounded-full bg-red-500';
                text.textContent = 'Disconnected';
                text.className = 'text-slate-400';
            }
        }
    }

    /**
     * Show toast notification
     */
    showToast(type, message) {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <span class="status-dot status-${type === 'error' ? 'error' : type === 'success' ? 'success' : 'info'}"></span>
            <span class="text-sm text-slate-200">${message}</span>
        `;

        container.appendChild(toast);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            toast.remove();
        }, 5000);
    }

    /**
     * Get connection status
     */
    isConnected() {
        return this.eventSource && this.eventSource.readyState === EventSource.OPEN;
    }
}

// Create singleton instance
const sseClient = new SSEClient();

// Export
export default sseClient;
export { EVENT_ICONS };
