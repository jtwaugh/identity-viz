/**
 * Active Tokens Component
 * Displays currently active tokens in the system
 */

import debugApi from '../../api.js';
import debugState from '../../state.js';
import router from '../../router.js';

let tokens = [];

/**
 * Decode JWT token (client-side, no verification)
 */
function decodeToken(token) {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;

        const header = JSON.parse(atob(parts[0]));
        const payload = JSON.parse(atob(parts[1]));

        return { header, payload, signature: parts[2] };
    } catch (error) {
        return null;
    }
}

/**
 * Format time remaining until expiration
 */
function formatTimeRemaining(exp) {
    if (!exp) return 'Unknown';

    const now = Math.floor(Date.now() / 1000);
    const remaining = exp - now;

    if (remaining <= 0) return 'Expired';
    if (remaining < 60) return `${remaining}s`;
    if (remaining < 3600) return `${Math.floor(remaining / 60)}m ${remaining % 60}s`;
    return `${Math.floor(remaining / 3600)}h ${Math.floor((remaining % 3600) / 60)}m`;
}

/**
 * Get TTL color class based on remaining time
 */
function getTtlColorClass(exp) {
    if (!exp) return 'text-slate-400';

    const now = Math.floor(Date.now() / 1000);
    const remaining = exp - now;

    if (remaining <= 0) return 'text-red-400';
    if (remaining < 300) return 'text-amber-400'; // < 5 minutes
    return 'text-green-400';
}

function render() {
    return `
        <div class="space-y-4">
            <div class="flex items-center justify-between">
                <h2 class="text-lg font-semibold text-slate-100">Active Tokens</h2>
                <button id="refresh-tokens" class="debug-btn debug-btn-secondary">
                    <i data-lucide="refresh-cw" class="w-4 h-4"></i>
                    Refresh
                </button>
            </div>

            <div id="tokens-container" class="space-y-4">
                ${renderTokenCards()}
            </div>
        </div>
    `;
}

function renderTokenCards() {
    if (tokens.length === 0) {
        return `
            <div class="empty-state">
                <div class="empty-state-icon">&#128273;</div>
                <div class="empty-state-title">No Active Tokens</div>
                <div class="empty-state-description">No tokens are currently active in the system</div>
            </div>
        `;
    }

    return tokens.map((token, index) => {
        const decoded = decodeToken(token.value || token.token || token);
        if (!decoded) return '';

        const payload = decoded.payload;
        const isIdentityToken = !payload.tenant_id;
        const tokenType = isIdentityToken ? 'Identity Token' : 'Access Token';

        return `
            <div class="debug-card" data-token-index="${index}">
                <div class="debug-card-header">
                    <div class="flex items-center gap-3">
                        <span class="px-2 py-0.5 text-xs rounded ${isIdentityToken ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-green-500/20 text-green-400 border border-green-500/30'}">
                            ${tokenType}
                        </span>
                        <span class="text-sm text-slate-400">${payload.sub?.substring(0, 20) || 'Unknown'}...</span>
                    </div>
                    <div class="flex items-center gap-3">
                        <span class="text-xs ${getTtlColorClass(payload.exp)} font-mono">
                            TTL: ${formatTimeRemaining(payload.exp)}
                        </span>
                        <button class="debug-btn debug-btn-secondary text-xs py-1 px-2 decode-token" data-token-index="${index}">
                            Decode
                        </button>
                    </div>
                </div>
                <div class="debug-card-body">
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                            <div class="text-xs font-medium text-slate-400 uppercase tracking-wider">Subject</div>
                            <div class="text-sm text-slate-200 mt-1 truncate">${payload.sub || '-'}</div>
                        </div>
                        <div>
                            <div class="text-xs font-medium text-slate-400 uppercase tracking-wider">Email</div>
                            <div class="text-sm text-slate-200 mt-1 truncate">${payload.email || '-'}</div>
                        </div>
                        <div>
                            <div class="text-xs font-medium text-slate-400 uppercase tracking-wider">Issued At</div>
                            <div class="text-sm text-slate-200 mt-1">${payload.iat ? new Date(payload.iat * 1000).toLocaleTimeString() : '-'}</div>
                        </div>
                        <div>
                            <div class="text-xs font-medium text-slate-400 uppercase tracking-wider">Expires At</div>
                            <div class="text-sm text-slate-200 mt-1">${payload.exp ? new Date(payload.exp * 1000).toLocaleTimeString() : '-'}</div>
                        </div>
                        ${!isIdentityToken ? `
                        <div>
                            <div class="text-xs font-medium text-slate-400 uppercase tracking-wider">Tenant ID</div>
                            <div class="text-sm text-slate-200 mt-1 truncate">${payload.tenant_id || '-'}</div>
                        </div>
                        <div>
                            <div class="text-xs font-medium text-slate-400 uppercase tracking-wider">Role</div>
                            <div class="text-sm mt-1">
                                <span class="px-2 py-0.5 text-xs rounded bg-purple-500/20 text-purple-400">
                                    ${payload.role || '-'}
                                </span>
                            </div>
                        </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

async function loadTokens() {
    try {
        const response = await debugApi.getActiveTokens();
        tokens = response?.tokens || response || [];
        debugState.set('auth.activeTokens', tokens);
        updateTokensContainer();
    } catch (error) {
        console.error('Failed to load tokens:', error);
        tokens = [];
        updateTokensContainer();
    }
}

function updateTokensContainer() {
    const container = document.getElementById('tokens-container');
    if (container) {
        container.innerHTML = renderTokenCards();
    }
}

function openInDecoder(tokenIndex) {
    const token = tokens[tokenIndex];
    if (token) {
        const tokenValue = token.value || token.token || token;
        debugState.set('auth.selectedToken', tokenValue);
        router.navigate('auth/decoder');
    }
}

function init() {
    loadTokens();

    // Refresh every 10 seconds to update TTL
    const refreshInterval = setInterval(() => {
        updateTokensContainer();
    }, 10000);

    document.getElementById('refresh-tokens')?.addEventListener('click', loadTokens);

    document.addEventListener('click', (e) => {
        const decodeBtn = e.target.closest('.decode-token');
        if (decodeBtn) {
            const index = parseInt(decodeBtn.getAttribute('data-token-index'));
            openInDecoder(index);
        }
    });

    if (window.lucide) window.lucide.createIcons();

    return () => {
        clearInterval(refreshInterval);
    };
}

export default { render, init };
