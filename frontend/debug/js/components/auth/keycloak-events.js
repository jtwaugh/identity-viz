/**
 * Keycloak Events Component
 * Shows authentication events from Keycloak
 */

import debugApi from '../../api.js';
import debugState from '../../state.js';

let events = [];
let sortColumn = 'time';
let sortDirection = 'desc';
let typeFilter = 'all';

const EVENT_TYPE_BADGES = {
    LOGIN: 'bg-green-500/20 text-green-400 border-green-500/30',
    LOGIN_ERROR: 'bg-red-500/20 text-red-400 border-red-500/30',
    LOGOUT: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    TOKEN_EXCHANGE: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    REFRESH_TOKEN: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    CODE_TO_TOKEN: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
    REGISTER: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
    UPDATE_PASSWORD: 'bg-pink-500/20 text-pink-400 border-pink-500/30'
};

function formatDate(timestamp) {
    if (!timestamp) return '-';
    return new Date(timestamp).toLocaleString();
}

function render() {
    return `
        <div class="space-y-4">
            <div class="flex items-center justify-between">
                <h2 class="text-lg font-semibold text-slate-100">Keycloak Events</h2>
                <div class="flex items-center gap-3">
                    <select id="event-type-filter" class="debug-select">
                        <option value="all">All Events</option>
                        <option value="LOGIN">Login</option>
                        <option value="LOGIN_ERROR">Login Error</option>
                        <option value="LOGOUT">Logout</option>
                        <option value="TOKEN_EXCHANGE">Token Exchange</option>
                        <option value="REFRESH_TOKEN">Refresh Token</option>
                        <option value="CODE_TO_TOKEN">Code to Token</option>
                        <option value="REGISTER">Register</option>
                    </select>
                    <button id="refresh-events" class="debug-btn debug-btn-secondary">
                        <i data-lucide="refresh-cw" class="w-4 h-4"></i>
                        Refresh
                    </button>
                </div>
            </div>

            <!-- Summary Cards -->
            <div class="grid grid-cols-4 gap-4" id="keycloak-summary">
                ${renderSummaryCards()}
            </div>

            <div class="debug-card">
                <div class="overflow-x-auto">
                    <table class="debug-table">
                        <thead>
                            <tr>
                                <th class="cursor-pointer hover:bg-slate-700/50" data-sort="time">Time</th>
                                <th class="cursor-pointer hover:bg-slate-700/50" data-sort="type">Event Type</th>
                                <th>User</th>
                                <th>Client</th>
                                <th>IP Address</th>
                                <th>Details</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="keycloak-tbody">
                            ${renderTableBody()}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
}

function renderSummaryCards() {
    const loginCount = events.filter(e => e.type === 'LOGIN').length;
    const errorCount = events.filter(e => e.type?.includes('ERROR')).length;
    const tokenExchangeCount = events.filter(e => e.type === 'TOKEN_EXCHANGE').length;
    const uniqueUsers = new Set(events.map(e => e.userId).filter(Boolean)).size;

    return `
        <div class="debug-card">
            <div class="p-4">
                <div class="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Events</div>
                <div class="text-2xl font-semibold text-slate-100 mt-1">${events.length}</div>
            </div>
        </div>
        <div class="debug-card">
            <div class="p-4">
                <div class="text-xs font-medium text-slate-400 uppercase tracking-wider">Successful Logins</div>
                <div class="text-2xl font-semibold text-green-400 mt-1">${loginCount}</div>
            </div>
        </div>
        <div class="debug-card">
            <div class="p-4">
                <div class="text-xs font-medium text-slate-400 uppercase tracking-wider">Token Exchanges</div>
                <div class="text-2xl font-semibold text-purple-400 mt-1">${tokenExchangeCount}</div>
            </div>
        </div>
        <div class="debug-card">
            <div class="p-4">
                <div class="text-xs font-medium text-slate-400 uppercase tracking-wider">Errors</div>
                <div class="text-2xl font-semibold ${errorCount > 0 ? 'text-red-400' : 'text-slate-400'} mt-1">${errorCount}</div>
            </div>
        </div>
    `;
}

function renderTableBody() {
    const filtered = filterAndSortEvents();

    if (filtered.length === 0) {
        return `
            <tr>
                <td colspan="7" class="text-center text-slate-500 py-8">
                    No Keycloak events found
                </td>
            </tr>
        `;
    }

    return filtered.map((event, index) => {
        const badgeClass = EVENT_TYPE_BADGES[event.type] || 'bg-slate-500/20 text-slate-400 border-slate-500/30';

        return `
            <tr class="clickable" data-event-index="${index}">
                <td class="text-slate-400 text-sm whitespace-nowrap">
                    ${formatDate(event.time)}
                </td>
                <td>
                    <span class="px-2 py-0.5 text-xs rounded border ${badgeClass}">
                        ${event.type || 'UNKNOWN'}
                    </span>
                </td>
                <td class="text-sm">
                    ${event.userId ? `
                        <code class="text-xs text-slate-400">${event.userId.substring(0, 12)}...</code>
                    ` : '-'}
                </td>
                <td class="text-sm text-slate-300">
                    ${event.clientId || '-'}
                </td>
                <td>
                    <code class="text-xs text-slate-400">${event.ipAddress || '-'}</code>
                </td>
                <td class="text-sm text-slate-400">
                    ${event.error || event.details?.auth_method || '-'}
                </td>
                <td>
                    <button class="debug-btn debug-btn-secondary text-xs py-1 px-2 view-event" data-event-index="${index}">
                        View
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function filterAndSortEvents() {
    let filtered = [...events];

    if (typeFilter !== 'all') {
        filtered = filtered.filter(e => e.type === typeFilter);
    }

    filtered.sort((a, b) => {
        let aVal = a[sortColumn] || '';
        let bVal = b[sortColumn] || '';

        if (sortColumn === 'time') {
            aVal = new Date(aVal).getTime();
            bVal = new Date(bVal).getTime();
        }

        if (typeof aVal === 'string') {
            aVal = aVal.toLowerCase();
            bVal = bVal.toLowerCase();
        }

        return sortDirection === 'asc' ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1);
    });

    return filtered;
}

async function loadEvents() {
    try {
        const response = await debugApi.getKeycloakEvents();
        events = response?.events || response || [];
        debugState.set('auth.keycloakEvents', events);
        updateView();
    } catch (error) {
        console.error('Failed to load Keycloak events:', error);
        events = [];
        updateView();
    }
}

function updateView() {
    const tbody = document.getElementById('keycloak-tbody');
    if (tbody) {
        tbody.innerHTML = renderTableBody();
    }

    const summary = document.getElementById('keycloak-summary');
    if (summary) {
        summary.innerHTML = renderSummaryCards();
    }
}

function showEventDetails(eventIndex) {
    const event = events[eventIndex];
    if (!event) return;

    const badgeClass = EVENT_TYPE_BADGES[event.type] || 'bg-slate-500/20 text-slate-400 border-slate-500/30';

    const html = `
        <div class="space-y-6">
            <div class="flex items-center gap-3">
                <span class="px-2 py-0.5 text-xs rounded border ${badgeClass}">
                    ${event.type}
                </span>
                <span class="text-sm text-slate-400">${formatDate(event.time)}</span>
            </div>

            ${event.error ? `
            <div class="p-4 rounded bg-red-500/10 border border-red-500/30">
                <div class="text-xs font-medium text-red-400 uppercase tracking-wider mb-1">Error</div>
                <div class="text-sm text-red-300">${event.error}</div>
            </div>
            ` : ''}

            <div class="grid grid-cols-2 gap-4">
                <div>
                    <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Event ID</h4>
                    <code class="text-sm text-slate-300 font-mono break-all">${event.id || '-'}</code>
                </div>
                <div>
                    <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">User ID</h4>
                    <code class="text-sm text-slate-300 font-mono break-all">${event.userId || '-'}</code>
                </div>
                <div>
                    <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Client ID</h4>
                    <span class="text-sm text-slate-300">${event.clientId || '-'}</span>
                </div>
                <div>
                    <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Session ID</h4>
                    <code class="text-sm text-slate-300 font-mono break-all">${event.sessionId || '-'}</code>
                </div>
                <div>
                    <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">IP Address</h4>
                    <code class="text-sm text-slate-300 font-mono">${event.ipAddress || '-'}</code>
                </div>
                <div>
                    <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Realm</h4>
                    <span class="text-sm text-slate-300">${event.realmId || '-'}</span>
                </div>
            </div>

            ${event.details ? `
            <div>
                <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Event Details</h4>
                <pre class="code-block bg-slate-900 p-3 rounded overflow-x-auto text-xs"><code class="language-json">${JSON.stringify(event.details, null, 2)}</code></pre>
            </div>
            ` : ''}

            <div>
                <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Raw Event</h4>
                <pre class="code-block bg-slate-900 p-3 rounded overflow-x-auto text-xs"><code class="language-json">${JSON.stringify(event, null, 2)}</code></pre>
            </div>
        </div>
    `;

    debugState.openSlideOver(`Keycloak Event: ${event.type}`, { html });

    setTimeout(() => {
        if (window.hljs) {
            document.querySelectorAll('#slide-over-content pre code').forEach(block => {
                window.hljs.highlightElement(block);
            });
        }
    }, 10);
}

function init() {
    loadEvents();

    document.getElementById('event-type-filter')?.addEventListener('change', (e) => {
        typeFilter = e.target.value;
        updateView();
    });

    document.getElementById('refresh-events')?.addEventListener('click', loadEvents);

    document.querySelectorAll('[data-sort]').forEach(th => {
        th.addEventListener('click', () => {
            const column = th.getAttribute('data-sort');
            if (sortColumn === column) {
                sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                sortColumn = column;
                sortDirection = 'desc';
            }
            updateView();
        });
    });

    document.addEventListener('click', (e) => {
        const viewBtn = e.target.closest('.view-event');
        const row = e.target.closest('[data-event-index]');

        if (viewBtn) {
            showEventDetails(parseInt(viewBtn.getAttribute('data-event-index')));
        } else if (row && !e.target.closest('button')) {
            showEventDetails(parseInt(row.getAttribute('data-event-index')));
        }
    });

    if (window.lucide) window.lucide.createIcons();
}

export default { render, init };
