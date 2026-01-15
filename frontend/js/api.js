/**
 * API Client Module
 * Centralized HTTP client for backend communication
 */

import state from './state.js';
import auth from './auth.js';

const API_BASE_URL = 'http://localhost:8000';

// Callbacks for handling specific responses
let onUnauthorizedCallback = null;

/**
 * Make an HTTP request to the backend
 * @param {string} method - HTTP method
 * @param {string} path - API path
 * @param {Object} options - Request options
 * @returns {Promise<Object>} Response data
 */
async function request(method, path, options = {}) {
    const { body, params, useIdentityToken = false, headers: customHeaders = {} } = options;

    // Build URL with query params
    let url = `${API_BASE_URL}${path}`;
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

    // Add authorization header
    const token = useIdentityToken ? auth.getIdentityToken() : auth.getAccessToken();
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    } else if (auth.getIdentityToken()) {
        // Fall back to identity token if no access token
        headers['Authorization'] = `Bearer ${auth.getIdentityToken()}`;
    }

    // Add tenant context header
    const currentTenant = state.get('currentTenant');
    if (currentTenant && currentTenant.id) {
        headers['X-Tenant-ID'] = currentTenant.id;
    }

    // Build request config
    const config = {
        method,
        headers,
        mode: 'cors'
    };

    if (body && method !== 'GET') {
        config.body = JSON.stringify(body);
    }

    try {
        const response = await fetch(url, config);

        // Handle response
        if (response.status === 401) {
            if (onUnauthorizedCallback) {
                onUnauthorizedCallback();
            }
            throw new ApiError('Unauthorized', 401, { code: 'UNAUTHORIZED' });
        }

        if (response.status === 403) {
            const errorData = await response.json().catch(() => ({}));
            throw new ApiError(
                errorData.error?.message || 'Access denied',
                403,
                errorData.error || { code: 'ACCESS_DENIED' }
            );
        }

        if (response.status === 404) {
            throw new ApiError('Not found', 404, { code: 'NOT_FOUND' });
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new ApiError(
                errorData.error?.message || 'Request failed',
                response.status,
                errorData.error || { code: 'ERROR' }
            );
        }

        // Handle empty responses
        if (response.status === 204) {
            return null;
        }

        return await response.json();
    } catch (error) {
        if (error instanceof ApiError) {
            throw error;
        }
        // Network error or other failure
        console.error('API request failed:', error);
        throw new ApiError('Network error', 0, { code: 'NETWORK_ERROR' });
    }
}

/**
 * Custom API Error class
 */
class ApiError extends Error {
    constructor(message, status, details = {}) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.details = details;
    }
}

// HTTP method shortcuts
const api = {
    /**
     * GET request
     * @param {string} path - API path
     * @param {Object} params - Query parameters
     * @param {Object} options - Additional options
     */
    get(path, params, options = {}) {
        return request('GET', path, { ...options, params });
    },

    /**
     * POST request
     * @param {string} path - API path
     * @param {Object} body - Request body
     * @param {Object} options - Additional options
     */
    post(path, body, options = {}) {
        return request('POST', path, { ...options, body });
    },

    /**
     * PUT request
     * @param {string} path - API path
     * @param {Object} body - Request body
     * @param {Object} options - Additional options
     */
    put(path, body, options = {}) {
        return request('PUT', path, { ...options, body });
    },

    /**
     * PATCH request
     * @param {string} path - API path
     * @param {Object} body - Request body
     * @param {Object} options - Additional options
     */
    patch(path, body, options = {}) {
        return request('PATCH', path, { ...options, body });
    },

    /**
     * DELETE request
     * @param {string} path - API path
     * @param {Object} options - Additional options
     */
    delete(path, options = {}) {
        return request('DELETE', path, options);
    },

    /**
     * Set callback for 401 responses
     * @param {Function} callback - Callback function
     */
    onUnauthorized(callback) {
        onUnauthorizedCallback = callback;
    },

    // ============================================
    // Auth Endpoints
    // ============================================

    /**
     * Get current user info and available tenants
     */
    async getMe() {
        return api.get('/auth/me', null, { useIdentityToken: true });
    },

    /**
     * Exchange identity token for tenant-scoped access token
     * @param {string} targetTenantId - Target tenant UUID
     */
    async exchangeToken(targetTenantId) {
        return api.post('/auth/token/exchange', {
            target_tenant_id: targetTenantId
        }, { useIdentityToken: true });
    },

    // ============================================
    // Tenant Endpoints
    // ============================================

    /**
     * Get list of tenants user has access to
     */
    async getTenants() {
        return api.get('/api/tenants', null, { useIdentityToken: true });
    },

    /**
     * Get tenant details
     * @param {string} tenantId - Tenant UUID
     */
    async getTenant(tenantId) {
        return api.get(`/api/tenants/${tenantId}`);
    },

    /**
     * Switch to a different tenant context
     * @param {string} tenantId - Target tenant UUID
     */
    async switchTenant(tenantId) {
        return api.post(`/api/tenants/${tenantId}/switch`);
    },

    // ============================================
    // Account Endpoints
    // ============================================

    /**
     * Get accounts in current tenant context
     */
    async getAccounts() {
        return api.get('/api/accounts');
    },

    /**
     * Get account details
     * @param {string} accountId - Account UUID
     */
    async getAccount(accountId) {
        return api.get(`/api/accounts/${accountId}`);
    },

    /**
     * Get account transactions
     * @param {string} accountId - Account UUID
     * @param {Object} params - Query parameters (page, size, dateFrom, dateTo)
     */
    async getTransactions(accountId, params = {}) {
        return api.get(`/api/accounts/${accountId}/transactions`, params);
    },

    /**
     * Initiate a transfer
     * @param {string} accountId - Source account UUID
     * @param {Object} transferData - Transfer details
     */
    async createTransfer(accountId, transferData) {
        return api.post(`/api/accounts/${accountId}/transfer`, transferData);
    },

    // ============================================
    // Admin Endpoints
    // ============================================

    /**
     * Get users in current tenant (ADMIN+ only)
     */
    async getUsers() {
        return api.get('/api/admin/users');
    },

    /**
     * Invite a user to the tenant
     * @param {Object} inviteData - Invite details
     */
    async inviteUser(inviteData) {
        return api.post('/api/admin/users/invite', inviteData);
    },

    /**
     * Update user's role in tenant
     * @param {string} userId - User UUID
     * @param {string} role - New role
     */
    async updateUserRole(userId, role) {
        return api.patch(`/api/admin/users/${userId}/role`, { role });
    },

    /**
     * Revoke user access to tenant
     * @param {string} userId - User UUID
     */
    async revokeUser(userId) {
        return api.delete(`/api/admin/users/${userId}`);
    }
};

// Export
export default api;
export { ApiError };
