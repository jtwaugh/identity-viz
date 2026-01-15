/**
 * Authentication Module
 * OIDC integration with Keycloak using oidc-client-ts
 */

import state from './state.js';

// Keycloak configuration
const KEYCLOAK_URL = 'http://localhost:8080';
const REALM = 'anybank';
const CLIENT_ID = 'anybank-web';
const REDIRECT_URI = 'http://localhost:3000/#/callback';
const POST_LOGOUT_REDIRECT_URI = 'http://localhost:3000/#/login';

// OIDC UserManager instance
let userManager = null;

/**
 * Initialize the OIDC UserManager
 */
function initUserManager() {
    if (userManager) return userManager;

    const settings = {
        authority: `${KEYCLOAK_URL}/realms/${REALM}`,
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        post_logout_redirect_uri: POST_LOGOUT_REDIRECT_URI,
        response_type: 'code',
        scope: 'openid profile email',
        filterProtocolClaims: true,
        loadUserInfo: true,
        automaticSilentRenew: false,
        monitorSession: false
    };

    // Access oidc-client-ts from the global window object (loaded via CDN)
    if (typeof oidc !== 'undefined') {
        userManager = new oidc.UserManager(settings);
    } else {
        console.error('oidc-client-ts not loaded');
        return null;
    }

    return userManager;
}

/**
 * Start the login flow (redirect to Keycloak)
 */
async function login() {
    const um = initUserManager();
    if (!um) {
        throw new Error('Failed to initialize authentication');
    }

    try {
        await um.signinRedirect();
    } catch (error) {
        console.error('Login redirect failed:', error);
        throw error;
    }
}

/**
 * Handle the OAuth callback after Keycloak redirect
 * @returns {Promise<Object>} User info
 */
async function handleCallback() {
    const um = initUserManager();
    if (!um) {
        throw new Error('Failed to initialize authentication');
    }

    try {
        const user = await um.signinRedirectCallback();

        if (user) {
            // Store identity token and user info in state
            state.update({
                'user': {
                    id: user.profile.sub,
                    email: user.profile.email,
                    name: user.profile.name || user.profile.preferred_username,
                    avatarUrl: null
                },
                'tokens.identity': user.access_token,
                'tokens.expiresAt': user.expires_at ? user.expires_at * 1000 : null
            });
            state.persist();

            return user;
        }

        throw new Error('No user returned from callback');
    } catch (error) {
        console.error('Callback handling failed:', error);
        throw error;
    }
}

/**
 * Logout the user
 */
async function logout() {
    const um = initUserManager();

    // Clear state first
    state.reset();
    state.clearStorage();

    if (um) {
        try {
            await um.signoutRedirect();
        } catch (error) {
            console.error('Logout redirect failed:', error);
            // Still navigate to login even if logout fails
            window.location.hash = '#/login';
        }
    } else {
        window.location.hash = '#/login';
    }
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
