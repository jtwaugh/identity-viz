/**
 * JWT Decoder Component
 * Decode and inspect JWT tokens
 */

import debugApi from '../../api.js';
import debugState from '../../state.js';

let currentToken = '';
let decodedToken = null;
let verificationStatus = null;

/**
 * Decode JWT token (client-side)
 */
function decodeToken(token) {
    try {
        const parts = token.trim().split('.');
        if (parts.length !== 3) return null;

        const header = JSON.parse(atob(parts[0].replace(/-/g, '+').replace(/_/g, '/')));
        const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));

        return {
            header,
            payload,
            signature: parts[2]
        };
    } catch (error) {
        console.error('Failed to decode token:', error);
        return null;
    }
}

/**
 * Format time remaining
 */
function formatTimeRemaining(exp) {
    if (!exp) return null;

    const now = Math.floor(Date.now() / 1000);
    const remaining = exp - now;

    if (remaining <= 0) return { text: 'EXPIRED', class: 'text-red-400 bg-red-500/20' };
    if (remaining < 300) return { text: `Expires in ${remaining}s`, class: 'text-amber-400 bg-amber-500/20' };
    if (remaining < 3600) return { text: `Expires in ${Math.floor(remaining / 60)}m`, class: 'text-green-400 bg-green-500/20' };
    return { text: `Expires in ${Math.floor(remaining / 3600)}h`, class: 'text-green-400 bg-green-500/20' };
}

function render() {
    const selectedToken = debugState.get('auth.selectedToken');
    if (selectedToken && !currentToken) {
        currentToken = selectedToken;
        decodedToken = decodeToken(currentToken);
    }

    return `
        <div class="space-y-6">
            <div class="flex items-center justify-between">
                <h2 class="text-lg font-semibold text-slate-100">JWT Decoder</h2>
                <div class="flex items-center gap-3">
                    <select id="token-select" class="debug-select">
                        <option value="">Select an active token...</option>
                    </select>
                    <button id="verify-token" class="debug-btn debug-btn-secondary" ${!currentToken ? 'disabled' : ''}>
                        <i data-lucide="shield-check" class="w-4 h-4"></i>
                        Verify Signature
                    </button>
                </div>
            </div>

            <!-- Token Input -->
            <div class="debug-card">
                <div class="debug-card-header">
                    <span class="text-sm font-medium">Paste JWT Token</span>
                    <button id="clear-token" class="text-xs text-slate-400 hover:text-slate-200">
                        Clear
                    </button>
                </div>
                <div class="debug-card-body">
                    <textarea id="token-input"
                              class="w-full h-24 bg-slate-900 border border-slate-700 rounded p-3 font-mono text-sm text-slate-300 focus:outline-none focus:border-blue-500"
                              placeholder="Paste your JWT token here...">${currentToken}</textarea>
                </div>
            </div>

            ${decodedToken ? renderDecodedToken() : `
            <div class="empty-state">
                <div class="empty-state-icon">&#128273;</div>
                <div class="empty-state-title">No Token to Decode</div>
                <div class="empty-state-description">Paste a JWT token above or select from active tokens</div>
            </div>
            `}
        </div>
    `;
}

function renderDecodedToken() {
    const { header, payload, signature } = decodedToken;
    const expInfo = formatTimeRemaining(payload.exp);

    return `
        <!-- Verification Status -->
        ${verificationStatus !== null ? `
        <div class="p-4 rounded ${verificationStatus ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'}">
            <div class="flex items-center gap-3">
                <span class="${verificationStatus ? 'text-green-400' : 'text-red-400'}">
                    ${verificationStatus ? '&#10004; Signature Valid' : '&#10006; Signature Invalid'}
                </span>
            </div>
        </div>
        ` : ''}

        <!-- Expiration Countdown -->
        ${expInfo ? `
        <div class="p-4 rounded ${expInfo.class.includes('red') ? 'bg-red-500/10 border border-red-500/30' : expInfo.class.includes('amber') ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-green-500/10 border border-green-500/30'}">
            <div class="flex items-center justify-between">
                <span class="${expInfo.class.split(' ')[0]} font-medium">${expInfo.text}</span>
                <span class="text-sm text-slate-400">Expires: ${new Date(payload.exp * 1000).toLocaleString()}</span>
            </div>
        </div>
        ` : ''}

        <!-- Header Section -->
        <div class="jwt-section">
            <div class="jwt-section-header header">Header</div>
            <div class="jwt-section-content">
                <pre><code class="language-json">${JSON.stringify(header, null, 2)}</code></pre>
            </div>
        </div>

        <!-- Payload Section -->
        <div class="jwt-section">
            <div class="jwt-section-header payload">Payload</div>
            <div class="jwt-section-content">
                <pre><code class="language-json">${JSON.stringify(payload, null, 2)}</code></pre>
            </div>
        </div>

        <!-- Claim Details -->
        <div class="debug-card">
            <div class="debug-card-header">
                <span class="text-sm font-medium">Claim Details</span>
            </div>
            <div class="debug-card-body">
                <div class="grid grid-cols-2 gap-4">
                    ${renderClaim('Subject (sub)', payload.sub)}
                    ${renderClaim('Issuer (iss)', payload.iss)}
                    ${renderClaim('Audience (aud)', payload.aud)}
                    ${renderClaim('Email', payload.email)}
                    ${renderClaim('Name', payload.name || payload.preferred_username)}
                    ${payload.tenant_id ? renderClaim('Tenant ID', payload.tenant_id) : ''}
                    ${payload.role ? renderClaim('Role', payload.role, 'badge') : ''}
                    ${renderClaim('Issued At (iat)', payload.iat ? new Date(payload.iat * 1000).toLocaleString() : null)}
                    ${renderClaim('Expires At (exp)', payload.exp ? new Date(payload.exp * 1000).toLocaleString() : null)}
                    ${payload.azp ? renderClaim('Authorized Party (azp)', payload.azp) : ''}
                    ${payload.scope ? renderClaim('Scope', payload.scope) : ''}
                </div>
            </div>
        </div>

        <!-- Signature Section -->
        <div class="jwt-section">
            <div class="jwt-section-header signature flex items-center justify-between">
                <span>Signature</span>
                <button id="copy-signature" class="text-xs text-slate-400 hover:text-slate-200">
                    Copy
                </button>
            </div>
            <div class="jwt-section-content break-all text-xs text-slate-400">
                ${signature}
            </div>
        </div>

        <!-- Actions -->
        <div class="flex gap-3">
            <button id="copy-decoded" class="debug-btn debug-btn-secondary flex-1">
                <i data-lucide="copy" class="w-4 h-4"></i>
                Copy Decoded JSON
            </button>
            <button id="copy-full-token" class="debug-btn debug-btn-secondary flex-1">
                <i data-lucide="clipboard" class="w-4 h-4"></i>
                Copy Full Token
            </button>
        </div>
    `;
}

function renderClaim(label, value, type = 'text') {
    if (value === null || value === undefined) return '';

    let displayValue = value;
    if (type === 'badge') {
        displayValue = `<span class="px-2 py-0.5 text-xs rounded bg-purple-500/20 text-purple-400">${value}</span>`;
    } else if (typeof value === 'object') {
        displayValue = `<code class="text-xs">${JSON.stringify(value)}</code>`;
    }

    return `
        <div>
            <div class="text-xs font-medium text-slate-400 uppercase tracking-wider">${label}</div>
            <div class="text-sm text-slate-200 mt-1 break-all">${displayValue}</div>
        </div>
    `;
}

async function loadActiveTokens() {
    try {
        const response = await debugApi.getActiveTokens();
        const tokens = response?.tokens || response || [];
        const select = document.getElementById('token-select');

        if (select) {
            // Clear existing options except first
            select.innerHTML = '<option value="">Select an active token...</option>';

            tokens.forEach((token, index) => {
                const tokenValue = token.value || token.token || token;
                const decoded = decodeToken(tokenValue);
                if (decoded) {
                    const isIdentity = !decoded.payload.tenant_id;
                    const label = isIdentity
                        ? `Identity Token (${decoded.payload.email || decoded.payload.sub?.substring(0, 20)})`
                        : `Access Token (${decoded.payload.tenant_id?.substring(0, 8)} - ${decoded.payload.role})`;

                    const option = document.createElement('option');
                    option.value = tokenValue;
                    option.textContent = label;
                    select.appendChild(option);
                }
            });
        }
    } catch (error) {
        console.error('Failed to load active tokens:', error);
    }
}

async function verifyToken() {
    if (!currentToken) return;

    try {
        const response = await debugApi.verifyToken(currentToken);
        verificationStatus = response?.valid || false;
        updateDecodedView();
    } catch (error) {
        console.error('Failed to verify token:', error);
        verificationStatus = false;
        updateDecodedView();
    }
}

function updateDecodedView() {
    const container = document.querySelector('.space-y-6');
    if (container) {
        // Re-render just the decoded sections
        const decodedContainer = container.querySelector('.jwt-section')?.parentElement;
        if (decodedContainer) {
            decodedContainer.innerHTML = renderDecodedToken();
            highlightCode();
            setupDecodedEventHandlers();
        }
    }
}

function highlightCode() {
    if (window.hljs) {
        document.querySelectorAll('.jwt-section pre code').forEach(block => {
            window.hljs.highlightElement(block);
        });
    }
}

function setupDecodedEventHandlers() {
    document.getElementById('copy-decoded')?.addEventListener('click', () => {
        if (decodedToken) {
            navigator.clipboard.writeText(JSON.stringify({
                header: decodedToken.header,
                payload: decodedToken.payload
            }, null, 2));
            showToast('Copied decoded JSON');
        }
    });

    document.getElementById('copy-full-token')?.addEventListener('click', () => {
        navigator.clipboard.writeText(currentToken);
        showToast('Copied full token');
    });

    document.getElementById('copy-signature')?.addEventListener('click', () => {
        if (decodedToken) {
            navigator.clipboard.writeText(decodedToken.signature);
            showToast('Copied signature');
        }
    });

    if (window.lucide) window.lucide.createIcons();
}

function showToast(message) {
    if (window.debugApp?.showToast) {
        window.debugApp.showToast('success', message);
    }
}

function init() {
    loadActiveTokens();

    // Token input handler
    const tokenInput = document.getElementById('token-input');
    if (tokenInput) {
        tokenInput.addEventListener('input', (e) => {
            currentToken = e.target.value.trim();
            verificationStatus = null;
            decodedToken = decodeToken(currentToken);

            const container = document.getElementById('token-input').closest('.space-y-6');
            if (container) {
                // Remove old decoded sections
                const existingSections = container.querySelectorAll('.jwt-section, .debug-card:not(:first-child), .empty-state, .flex.gap-3, .p-4.rounded');
                existingSections.forEach(el => el.remove());

                // Add new decoded view
                if (decodedToken) {
                    container.insertAdjacentHTML('beforeend', renderDecodedToken());
                    highlightCode();
                    setupDecodedEventHandlers();
                } else if (currentToken) {
                    container.insertAdjacentHTML('beforeend', `
                        <div class="p-4 rounded bg-red-500/10 border border-red-500/30">
                            <span class="text-red-400">Invalid JWT token format</span>
                        </div>
                    `);
                }
            }
        });
    }

    // Token select handler
    document.getElementById('token-select')?.addEventListener('change', (e) => {
        if (e.target.value) {
            currentToken = e.target.value;
            verificationStatus = null;
            decodedToken = decodeToken(currentToken);

            if (tokenInput) {
                tokenInput.value = currentToken;
                tokenInput.dispatchEvent(new Event('input'));
            }
        }
    });

    // Clear handler
    document.getElementById('clear-token')?.addEventListener('click', () => {
        currentToken = '';
        decodedToken = null;
        verificationStatus = null;
        debugState.set('auth.selectedToken', null);

        if (tokenInput) {
            tokenInput.value = '';
            tokenInput.dispatchEvent(new Event('input'));
        }
    });

    // Verify handler
    document.getElementById('verify-token')?.addEventListener('click', verifyToken);

    // Initial highlight
    highlightCode();
    setupDecodedEventHandlers();

    if (window.lucide) window.lucide.createIcons();

    // Update expiration countdown every second
    const countdownInterval = setInterval(() => {
        if (decodedToken?.payload?.exp) {
            updateDecodedView();
        }
    }, 1000);

    return () => {
        clearInterval(countdownInterval);
    };
}

export default { render, init };
