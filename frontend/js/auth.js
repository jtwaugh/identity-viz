/**
 * Authentication Module
 * BFF (Backend-for-Frontend) pattern - OAuth flow handled by backend
 */

import state from './state.js';

// BFF endpoints
const BFF_LOGIN_URL = '/bff/auth/login';
const BFF_LOGOUT_URL = '/bff/auth/logout';

/**
 * Start the login flow (redirect to BFF which handles OAuth)
 */
async function login() {
    console.log('[Auth] Starting BFF login flow');
    // Simply redirect to the BFF login endpoint
    // The backend will handle the OAuth redirect to Keycloak
    window.location.href = BFF_LOGIN_URL;
}

/**
 * Handle the OAuth callback after BFF redirects back.
 * BFF pattern: tokens stay server-side, we fetch user info via API.
 * @returns {Promise<Object>} User info
 */
async function handleCallback() {
    console.log('[Auth] Handling BFF callback');

    // Parse callback params from URL fragment
    const hash = window.location.hash;
    const queryStart = hash.indexOf('?');

    if (queryStart !== -1) {
        const queryString = hash.substring(queryStart + 1);
        const params = new URLSearchParams(queryString);

        // Check for error from BFF
        const error = params.get('error');
        if (error) {
            throw new Error(`Authentication failed: ${error}`);
        }
    }

    // Fetch user info from BFF (tokens are stored server-side)
    console.log('[Auth] Fetching user info from BFF /bff/auth/me...');
    console.log('[Auth] Cookies available:', document.cookie);

    const response = await fetch('/bff/auth/me', {
        method: 'GET',
        credentials: 'include', // Include session cookies
        headers: {
            'Accept': 'application/json'
        }
    });

    console.log('[Auth] /bff/auth/me response status:', response.status);
    console.log('[Auth] /bff/auth/me response headers:', [...response.headers.entries()]);

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[Auth] /bff/auth/me failed:', errorData);
        throw new Error(errorData.error || `Failed to fetch user info: ${response.status}`);
    }

    const userInfo = await response.json();

    if (!userInfo.authenticated) {
        throw new Error(userInfo.error || 'Not authenticated');
    }

    // Store user info in state (no tokens stored client-side - BFF pattern)
    const user = {
        id: userInfo.sub,
        email: userInfo.email,
        name: userInfo.name || userInfo.preferred_username,
        avatarUrl: null
    };

    state.update({
        'user': user,
        'tokens.expiresAt': userInfo.expiresAt
    });
    state.persist();

    // Don't change hash here - let the callback component navigate when done
    // Changing hash triggers router's hashchange listener and causes re-renders

    console.log('[Auth] BFF callback successful, user:', user.email);

    return { profile: user };
}

/**
 * Logout the user via BFF
 */
async function logout() {
    console.log('[Auth] Starting BFF logout');

    // Clear state first
    state.reset();
    state.clearStorage();

    // Redirect to BFF logout which will handle Keycloak logout
    window.location.href = BFF_LOGOUT_URL;
}

/**
 * Get current user info from state
 * @returns {Object|null} User object
 */
function getCurrentUser() {
    return state.get('user');
}

/**
 * Get current identity token
 * @returns {string|null} Identity token
 */
function getIdentityToken() {
    return state.get('tokens.identity');
}

/**
 * Get current access token (tenant-scoped)
 * @returns {string|null} Access token
 */
function getAccessToken() {
    return state.get('tokens.access');
}

/**
 * Set the tenant-scoped access token after token exchange
 * @param {string} accessToken - The new access token
 * @param {number} expiresIn - Expiration time in seconds
 */
function setAccessToken(accessToken, expiresIn) {
    state.update({
        'tokens.access': accessToken,
        'tokens.expiresAt': Date.now() + (expiresIn * 1000)
    });
    state.persist();
}

/**
 * Set the current tenant context
 * @param {Object} tenant - Tenant object
 */
function setCurrentTenant(tenant) {
    state.set('currentTenant', tenant);
    state.persist();
}

/**
 * Set available tenants
 * @param {Array} tenants - Array of tenant objects
 */
function setAvailableTenants(tenants) {
    state.set('availableTenants', tenants);
    state.persist();
}

/**
 * Check if user is authenticated
 * @returns {boolean}
 */
function isAuthenticated() {
    return state.isAuthenticated();
}

/**
 * Check if tenant context is selected
 * @returns {boolean}
 */
function hasTenantContext() {
    return state.hasTenantContext();
}

/**
 * Check if token is expired
 * @returns {boolean}
 */
function isTokenExpired() {
    return state.isTokenExpired();
}

/**
 * Parse JWT token to extract claims
 * @param {string} token - JWT token
 * @returns {Object|null} Token payload
 */
function parseToken(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
            atob(base64)
                .split('')
                .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                .join('')
        );
        return JSON.parse(jsonPayload);
    } catch (e) {
        console.error('Failed to parse token:', e);
        return null;
    }
}

/**
 * Get user initials for avatar
 * @param {string} name - User's full name
 * @returns {string} Initials (1-2 characters)
 */
function getInitials(name) {
    if (!name) return '?';
    const parts = name.split(' ');
    if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
}

// Export auth module
export default {
    login,
    logout,
    handleCallback,
    getCurrentUser,
    getIdentityToken,
    getAccessToken,
    setAccessToken,
    setCurrentTenant,
    setAvailableTenants,
    isAuthenticated,
    hasTenantContext,
    isTokenExpired,
    parseToken,
    getInitials
};

// Named exports
export {
    login,
    logout,
    handleCallback,
    getCurrentUser,
    getIdentityToken,
    getAccessToken,
    setAccessToken,
    setCurrentTenant,
    setAvailableTenants,
    isAuthenticated,
    hasTenantContext,
    isTokenExpired,
    parseToken,
    getInitials
};
