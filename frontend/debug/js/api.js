/**
 * Debug API Client
 * HTTP client for debug endpoints
 */

import debugState from './state.js';

// Use relative URL so it works through nginx proxy at /debug/api/
// When served at /debug/, requests go to /debug/api/* which nginx proxies to backend
const DEBUG_BASE_URL = '/debug/api';

/**
 * Make an HTTP request to the backend
 * @param {string} method - HTTP method
 * @param {string} path - API path
 * @param {Object} options - Request options
 * @returns {Promise<Object>} Response data
 */
async function request(method, path, options = {}) {
    const { body, params, headers: customHeaders = {} } = options;
    const startTime = Date.now();

    // Build URL with query params
    let url = path.startsWith('http') ? path : `${DEBUG_BASE_URL}${path}`;
    if (params) {
        const searchParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                searchParams.append(key, value);
            }
        });
        const queryString = searchParams.toString();
        if (queryString) {
            url += `?${queryString}`;
        }
    }

    // Build headers
    const headers = {
        'Content-Type': 'application/json',
        ...customHeaders
    };

    // Build request config
    const config = {
        method,
        headers,
        mode: 'cors'
    };

    if (body && method !== 'GET') {
        config.body = JSON.stringify(body);
    }

    // Track request for debug purposes
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
        const response = await fetch(url, config);
        const duration = Date.now() - startTime;

        // Try to parse JSON response
        let data = null;
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            data = await response.json().catch(() => null);
        }

        // Log request for network inspector
        debugState.addRequest({
            id: requestId,
            method,
            url,
            status: response.status,
            duration,
            requestHeaders: headers,
            requestBody: body,
            responseHeaders: Object.fromEntries(response.headers.entries()),
            responseBody: data,
            timestamp: new Date().toISOString()
        });

        if (!response.ok) {
            throw new DebugApiError(
                data?.error?.message || `Request failed with status ${response.status}`,
                response.status,
                data?.error || { code: 'ERROR' }
            );
        }

        return data;
    } catch (error) {
        const duration = Date.now() - startTime;

        if (error instanceof DebugApiError) {
            throw error;
        }

        // Log failed request
        debugState.addRequest({
            id: requestId,
            method,
            url,
            status: 0,
            duration,
            requestHeaders: headers,
            requestBody: body,
            error: error.message,
            timestamp: new Date().toISOString()
        });

        throw new DebugApiError('Network error', 0, { code: 'NETWORK_ERROR' });
    }
}

/**
 * Custom API Error class
 */
class DebugApiError extends Error {
    constructor(message, status, details = {}) {
        super(message);
        this.name = 'DebugApiError';
        this.status = status;
        this.details = details;
    }
}

// HTTP method shortcuts and API methods
const debugApi = {
    /**
     * GET request
     */
    get(path, params, options = {}) {
        return request('GET', path, { ...options, params });
    },

    /**
     * POST request
     */
    post(path, body, options = {}) {
        return request('POST', path, { ...options, body });
    },

    /**
     * PUT request
     */
    put(path, body, options = {}) {
        return request('PUT', path, { ...options, body });
    },

    /**
     * PATCH request
     */
    patch(path, body, options = {}) {
        return request('PATCH', path, { ...options, body });
    },

    /**
     * DELETE request
     */
    delete(path, options = {}) {
        return request('DELETE', path, options);
    },

    // ============================================
    // Data Endpoints
    // ============================================

    /**
     * Get all users
     */
    async getUsers() {
        return this.get('/data/users');
    },

    /**
     * Get all tenants
     */
    async getTenants() {
        return this.get('/data/tenants');
    },

    /**
     * Get all memberships
     */
    async getMemberships() {
        return this.get('/data/memberships');
    },

    /**
     * Get all accounts
     */
    async getAccounts() {
        return this.get('/data/accounts');
    },

    /**
     * Get active sessions
     */
    async getSessions() {
        return this.get('/data/sessions');
    },

    /**
     * Get entity by ID
     */
    async getEntity(type, id) {
        return this.get(`/data/${type}/${id}`);
    },

    // ============================================
    // Auth Endpoints
    // ============================================

    /**
     * Get active tokens
     */
    async getActiveTokens() {
        return this.get('/auth/tokens');
    },

    /**
     * Get Keycloak events
     */
    async getKeycloakEvents() {
        return this.get('/auth/keycloak/events');
    },

    /**
     * Decode a JWT token
     */
    async decodeToken(token) {
        return this.post('/auth/decode', { token });
    },

    /**
     * Verify token signature
     */
    async verifyToken(token) {
        return this.post('/auth/verify', { token });
    },

    // ============================================
    // Network Endpoints
    // ============================================

    /**
     * Get request log
     */
    async getRequestLog(params = {}) {
        return this.get('/network/requests', params);
    },

    /**
     * Get request by ID
     */
    async getRequest(requestId) {
        return this.get(`/network/requests/${requestId}`);
    },

    /**
     * Get correlated requests
     */
    async getCorrelatedRequests(correlationId) {
        return this.get(`/network/correlation/${correlationId}`);
    },

    // ============================================
    // Policy Endpoints
    // ============================================

    /**
     * Get OPA decisions
     */
    async getOpaDecisions(params = {}) {
        return this.get('/policy/decisions', params);
    },

    /**
     * Get decision by ID
     */
    async getDecision(decisionId) {
        return this.get(`/policy/decisions/${decisionId}`);
    },

    /**
     * Get loaded policies
     */
    async getPolicies() {
        return this.get('/policy/policies');
    },

    /**
     * Evaluate a policy manually
     */
    async evaluatePolicy(input) {
        return this.post('/policy/evaluate', input);
    },

    // ============================================
    // Workflow Endpoints
    // ============================================

    /**
     * Get session timeline
     */
    async getSessionTimeline(sessionId) {
        return this.get(`/workflows/sessions/${sessionId}/timeline`);
    },

    /**
     * Get all session events
     */
    async getSessionEvents(sessionId) {
        return this.get(`/workflows/sessions/${sessionId}/events`);
    },

    /**
     * Export session data
     */
    async exportSession(sessionId, format = 'json') {
        return this.get(`/workflows/sessions/${sessionId}/export`, { format });
    },

    // ============================================
    // Control Endpoints
    // ============================================

    /**
     * Reset all data
     */
    async resetAll() {
        return this.post('/controls/reset/all');
    },

    /**
     * Reset users
     */
    async resetUsers() {
        return this.post('/controls/reset/users');
    },

    /**
     * Reset sessions
     */
    async resetSessions() {
        return this.post('/controls/reset/sessions');
    },

    /**
     * Reset audit logs
     */
    async resetAudit() {
        return this.post('/controls/reset/audit');
    },

    /**
     * Inject risk factors
     */
    async injectRisk(factors) {
        return this.post('/controls/risk/inject', factors);
    },

    /**
     * Clear injected risk
     */
    async clearRisk() {
        return this.post('/controls/risk/clear');
    },

    /**
     * Set simulated time
     */
    async setSimulatedTime(timestamp) {
        return this.post('/controls/time/set', { timestamp });
    },

    /**
     * Clear simulated time
     */
    async clearSimulatedTime() {
        return this.post('/controls/time/clear');
    },

    /**
     * Simulate service failure
     */
    async simulateFailure(service, enabled) {
        return this.post(`/controls/failures/${service}`, { enabled });
    },

    // ============================================
    // Health Endpoints
    // ============================================

    /**
     * Get all service health
     */
    async getHealth() {
        return this.get('/health');
    },

    /**
     * Get service-specific health
     */
    async getServiceHealth(service) {
        return this.get(`/health/${service}`);
    },

    /**
     * Get service metrics
     */
    async getMetrics(service) {
        return this.get(`/health/${service}/metrics`);
    },

    // ============================================
    // Utility Methods
    // ============================================

    /**
     * Generate cURL command from request details
     */
    generateCurl(request) {
        const parts = ['curl'];

        // Method
        if (request.method !== 'GET') {
            parts.push(`-X ${request.method}`);
        }

        // Headers
        if (request.requestHeaders) {
            Object.entries(request.requestHeaders).forEach(([key, value]) => {
                parts.push(`-H '${key}: ${value}'`);
            });
        }

        // Body
        if (request.requestBody) {
            parts.push(`-d '${JSON.stringify(request.requestBody)}'`);
        }

        // URL
        parts.push(`'${request.url}'`);

        return parts.join(' \\\n  ');
    }
};

// Export
export default debugApi;
export { DebugApiError };
