/**
 * Sessions Table Component
 * Displays all user sessions (active, expired, terminated) with filtering
 */

import debugApi from '../../api.js';
import debugState from '../../state.js';
import router from '../../router.js';

let sessions = [];
let sortColumn = 'started_at';
let sortDirection = 'desc';
let searchQuery = '';
let statusFilter = 'all'; // 'all', 'ACTIVE', 'EXPIRED', 'TERMINATED'

function formatDate(dateString) {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString();
}

function formatDuration(startDate) {
    if (!startDate) return '-';
    const start = new Date(startDate);
    const now = new Date();
    const diff = Math.floor((now - start) / 1000);

    if (diff < 60) return `${diff}s`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m`;
    return `${Math.floor(diff / 86400)}d`;
}

function getStatusCounts() {
    const counts = { ACTIVE: 0, EXPIRED: 0, TERMINATED: 0, total: sessions.length };
    sessions.forEach(s => {
        const status = s.status || 'ACTIVE';
        if (counts[status] !== undefined) counts[status]++;
    });
    return counts;
}

function render() {
    const counts = getStatusCounts();

    return `
        <div class="space-y-4">
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <h2 class="text-lg font-semibold text-slate-100">Sessions</h2>
                    <span class="px-2 py-0.5 text-xs rounded bg-slate-600/50 text-slate-300">
                        ${sessions.length} total
                    </span>
                </div>
                <div class="flex items-center gap-3">
                    <select id="sessions-status-filter" class="debug-input w-40">
                        <option value="all" ${statusFilter === 'all' ? 'selected' : ''}>All Status</option>
                        <option value="ACTIVE" ${statusFilter === 'ACTIVE' ? 'selected' : ''}>Active (${counts.ACTIVE})</option>
                        <option value="EXPIRED" ${statusFilter === 'EXPIRED' ? 'selected' : ''}>Expired (${counts.EXPIRED})</option>
                        <option value="TERMINATED" ${statusFilter === 'TERMINATED' ? 'selected' : ''}>Terminated (${counts.TERMINATED})</option>
                    </select>
                    <input type="text"
                           id="sessions-search"
                           placeholder="Search by email, ID, IP..."
                           class="debug-input w-64"
                           value="${searchQuery}">
                    <button id="refresh-sessions" class="debug-btn debug-btn-secondary">
                        <i data-lucide="refresh-cw" class="w-4 h-4"></i>
                        Refresh
                    </button>
                </div>
            </div>

            <!-- Session summary cards -->
            <div class="grid grid-cols-5 gap-4" id="sessions-summary">
                ${renderSummaryCards()}
            </div>

            <div class="debug-card">
                <div class="overflow-x-auto">
                    <table class="debug-table">
                        <thead>
                            <tr>
                                <th class="cursor-pointer hover:bg-slate-700/50" data-sort="id">Session ID</th>
                                <th>User</th>
                                <th>Current Tenant</th>
                                <th class="cursor-pointer hover:bg-slate-700/50" data-sort="status">Status</th>
                                <th class="cursor-pointer hover:bg-slate-700/50" data-sort="started_at">Started</th>
                                <th class="cursor-pointer hover:bg-slate-700/50" data-sort="last_activity">Last Activity</th>
                                <th>Events</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="sessions-tbody">
                            ${renderTableBody()}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
}

function renderSummaryCards() {
    const counts = getStatusCounts();
    const uniqueUsers = new Set(sessions.map(s => s.user_id)).size;
    const totalEvents = sessions.reduce((sum, s) => sum + (s.event_count || 0), 0);

    return `
        <div class="debug-card cursor-pointer hover:ring-1 hover:ring-green-500/50 ${statusFilter === 'ACTIVE' ? 'ring-1 ring-green-500' : ''}" data-filter-status="ACTIVE">
            <div class="p-4">
                <div class="text-xs font-medium text-slate-400 uppercase tracking-wider">Active</div>
                <div class="text-2xl font-semibold text-green-400 mt-1">${counts.ACTIVE}</div>
            </div>
        </div>
        <div class="debug-card cursor-pointer hover:ring-1 hover:ring-amber-500/50 ${statusFilter === 'EXPIRED' ? 'ring-1 ring-amber-500' : ''}" data-filter-status="EXPIRED">
            <div class="p-4">
                <div class="text-xs font-medium text-slate-400 uppercase tracking-wider">Expired</div>
                <div class="text-2xl font-semibold text-amber-400 mt-1">${counts.EXPIRED}</div>
            </div>
        </div>
        <div class="debug-card cursor-pointer hover:ring-1 hover:ring-red-500/50 ${statusFilter === 'TERMINATED' ? 'ring-1 ring-red-500' : ''}" data-filter-status="TERMINATED">
            <div class="p-4">
                <div class="text-xs font-medium text-slate-400 uppercase tracking-wider">Terminated</div>
                <div class="text-2xl font-semibold text-red-400 mt-1">${counts.TERMINATED}</div>
            </div>
        </div>
        <div class="debug-card">
            <div class="p-4">
                <div class="text-xs font-medium text-slate-400 uppercase tracking-wider">Unique Users</div>
                <div class="text-2xl font-semibold text-slate-100 mt-1">${uniqueUsers}</div>
            </div>
        </div>
        <div class="debug-card">
            <div class="p-4">
                <div class="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Events</div>
                <div class="text-2xl font-semibold text-slate-100 mt-1">${totalEvents}</div>
            </div>
        </div>
    `;
}

function getStatusBadge(status) {
    const statusConfig = {
        ACTIVE: { bg: 'bg-green-500/20', text: 'text-green-400', dot: 'bg-green-500' },
        EXPIRED: { bg: 'bg-amber-500/20', text: 'text-amber-400', dot: 'bg-amber-500' },
        TERMINATED: { bg: 'bg-red-500/20', text: 'text-red-400', dot: 'bg-red-500' }
    };
    const config = statusConfig[status] || statusConfig.ACTIVE;
    const isActive = status === 'ACTIVE';

    return `
        <span class="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs rounded ${config.bg} ${config.text}">
            <span class="w-1.5 h-1.5 rounded-full ${config.dot} ${isActive ? 'pulse' : ''}"></span>
            ${status || 'ACTIVE'}
        </span>
    `;
}

function renderTableBody() {
    const filtered = filterAndSortSessions();

    if (filtered.length === 0) {
        return `
            <tr>
                <td colspan="8" class="text-center text-slate-500 py-8">
                    ${searchQuery || statusFilter !== 'all' ? 'No sessions match your filters' : 'No sessions recorded'}
                </td>
            </tr>
        `;
    }

    return filtered.map(session => `
        <tr class="clickable" data-session-id="${session.id}">
            <td>
                <code class="text-xs text-slate-400">${session.id?.substring(0, 12)}...</code>
            </td>
            <td>
                <div class="flex items-center gap-2">
                    <div class="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-xs">
                        ${(session.user_email || session.user?.email || '?').charAt(0).toUpperCase()}
                    </div>
                    <span class="text-sm">${session.user_email || session.user?.email || session.user_id?.substring(0, 8) || '-'}</span>
                </div>
            </td>
            <td class="text-sm text-slate-400">
                ${session.current_tenant_name || session.current_tenant?.name || session.current_tenant_id?.substring(0, 8) || 'No context'}
            </td>
            <td>
                ${getStatusBadge(session.status)}
            </td>
            <td class="text-slate-400 text-sm">${formatDate(session.started_at)}</td>
            <td class="text-slate-400 text-sm">${formatDate(session.last_activity)}</td>
            <td>
                <span class="px-2 py-0.5 text-xs rounded bg-slate-700 text-slate-300">
                    ${session.event_count || 0}
                </span>
            </td>
            <td>
                <div class="flex items-center gap-2">
                    <button class="debug-btn debug-btn-secondary text-xs py-1 px-2 view-timeline" data-session-id="${session.id}">
                        Timeline
                    </button>
                    <button class="debug-btn debug-btn-secondary text-xs py-1 px-2 view-session" data-session-id="${session.id}">
                        Details
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

function filterAndSortSessions() {
    let filtered = [...sessions];

    // Filter by status
    if (statusFilter !== 'all') {
        filtered = filtered.filter(s => (s.status || 'ACTIVE') === statusFilter);
    }

    // Filter by search query
    if (searchQuery) {
        const query = searchQuery.toLowerCase();
        filtered = filtered.filter(s =>
            s.user_email?.toLowerCase().includes(query) ||
            s.user?.email?.toLowerCase().includes(query) ||
            s.id?.toLowerCase().includes(query) ||
            s.visitor_session_id?.toLowerCase().includes(query) ||
            s.current_tenant_name?.toLowerCase().includes(query) ||
            (s.status || 'ACTIVE').toLowerCase().includes(query)
        );
    }

    // Sort
    filtered.sort((a, b) => {
        let aVal = a[sortColumn] || '';
        let bVal = b[sortColumn] || '';

        if (sortColumn === 'started_at' || sortColumn === 'last_activity') {
            aVal = new Date(aVal).getTime() || 0;
            bVal = new Date(bVal).getTime() || 0;
        }

        if (typeof aVal === 'string') {
            aVal = aVal.toLowerCase();
            bVal = bVal.toLowerCase();
        }

        return sortDirection === 'asc' ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1);
    });

    return filtered;
}

async function loadSessions() {
    try {
        const response = await debugApi.getSessions();
        sessions = response?.sessions || response || [];
        debugState.set('data.sessions', sessions);
        updateTableBody();
        updateSummaryCards();
    } catch (error) {
        console.error('Failed to load sessions:', error);
        sessions = [];
        updateTableBody();
    }
}

function updateTableBody() {
    const tbody = document.getElementById('sessions-tbody');
    if (tbody) {
        tbody.innerHTML = renderTableBody();
    }
}

function updateSummaryCards() {
    const summary = document.getElementById('sessions-summary');
    if (summary) {
        summary.innerHTML = renderSummaryCards();
    }
}

function showSessionDetails(sessionId) {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;

    const status = session.status || 'ACTIVE';
    const statusConfig = {
        ACTIVE: { color: 'green', label: 'Active Session' },
        EXPIRED: { color: 'amber', label: 'Expired Session' },
        TERMINATED: { color: 'red', label: 'Terminated Session' }
    };
    const config = statusConfig[status] || statusConfig.ACTIVE;

    const html = `
        <div class="space-y-6">
            <div class="flex items-center gap-3">
                ${getStatusBadge(status)}
                <span class="text-sm text-slate-400">Duration: ${formatDuration(session.started_at)}</span>
            </div>

            <div class="grid grid-cols-2 gap-4">
                <div>
                    <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Session ID</h4>
                    <code class="text-sm text-slate-300 font-mono break-all">${session.id}</code>
                </div>
                <div>
                    <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">User</h4>
                    <span class="text-sm text-slate-300">${session.user_email || session.user?.email || '-'}</span>
                </div>
                <div>
                    <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">User ID</h4>
                    <code class="text-sm text-slate-300 font-mono break-all">${session.user_id}</code>
                </div>
                <div>
                    <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Current Tenant</h4>
                    <span class="text-sm text-slate-300">${session.current_tenant_name || session.current_tenant?.name || 'No context'}</span>
                </div>
                <div>
                    <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Started</h4>
                    <span class="text-sm text-slate-300">${formatDate(session.started_at)}</span>
                </div>
                <div>
                    <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Last Activity</h4>
                    <span class="text-sm text-slate-300">${formatDate(session.last_activity)}</span>
                </div>
                <div>
                    <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Events</h4>
                    <span class="text-sm text-slate-300">${session.event_count || 0}</span>
                </div>
                <div>
                    <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Context Switches</h4>
                    <span class="text-sm text-slate-300">${session.context_switches || 0}</span>
                </div>
            </div>

            <div class="flex gap-3">
                <button class="debug-btn debug-btn-primary flex-1" id="goto-timeline-btn">
                    <i data-lucide="clock" class="w-4 h-4"></i>
                    View Timeline
                </button>
                <button class="debug-btn debug-btn-secondary flex-1" id="export-session-btn">
                    <i data-lucide="download" class="w-4 h-4"></i>
                    Export
                </button>
            </div>

            <div>
                <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Raw Data</h4>
                <pre class="code-block bg-slate-900 p-3 rounded overflow-x-auto text-xs"><code class="language-json">${JSON.stringify(session, null, 2)}</code></pre>
            </div>
        </div>
    `;

    debugState.openSlideOver('Session Details', { html });

    setTimeout(() => {
        if (window.lucide) window.lucide.createIcons();
        if (window.hljs) {
            document.querySelectorAll('#slide-over-content pre code').forEach(block => {
                window.hljs.highlightElement(block);
            });
        }

        // Timeline button
        document.getElementById('goto-timeline-btn')?.addEventListener('click', () => {
            debugState.set('workflows.currentSession', session.id);
            debugState.closeSlideOver();
            router.navigate('workflows/timeline');
        });

        // Export button
        document.getElementById('export-session-btn')?.addEventListener('click', async () => {
            try {
                const data = await debugApi.exportSession(session.id, 'json');
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `session-${session.id}.json`;
                a.click();
                URL.revokeObjectURL(url);
            } catch (error) {
                console.error('Failed to export session:', error);
            }
        });
    }, 10);
}

function setStatusFilter(newStatus) {
    statusFilter = newStatus;
    // Update dropdown
    const select = document.getElementById('sessions-status-filter');
    if (select) select.value = newStatus;
    // Update UI
    updateTableBody();
    updateSummaryCards();
}

function init() {
    loadSessions();

    // Auto-refresh every 30 seconds
    const refreshInterval = setInterval(loadSessions, 30000);

    // Search input
    document.getElementById('sessions-search')?.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        updateTableBody();
    });

    // Status filter dropdown
    document.getElementById('sessions-status-filter')?.addEventListener('change', (e) => {
        setStatusFilter(e.target.value);
    });

    // Refresh button
    document.getElementById('refresh-sessions')?.addEventListener('click', loadSessions);

    // Sortable columns
    document.querySelectorAll('[data-sort]').forEach(th => {
        th.addEventListener('click', () => {
            const column = th.getAttribute('data-sort');
            if (sortColumn === column) {
                sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                sortColumn = column;
                sortDirection = 'desc';
            }
            updateTableBody();
        });
    });

    // Click handlers for rows, buttons, and summary cards
    document.addEventListener('click', (e) => {
        const timelineBtn = e.target.closest('.view-timeline');
        const viewBtn = e.target.closest('.view-session');
        const row = e.target.closest('tr[data-session-id]');
        const filterCard = e.target.closest('[data-filter-status]');

        if (filterCard) {
            const newStatus = filterCard.getAttribute('data-filter-status');
            // Toggle filter - clicking same status clears filter
            setStatusFilter(statusFilter === newStatus ? 'all' : newStatus);
        } else if (timelineBtn) {
            const sessionId = timelineBtn.getAttribute('data-session-id');
            debugState.set('workflows.currentSession', sessionId);
            router.navigate('workflows/timeline');
        } else if (viewBtn) {
            showSessionDetails(viewBtn.getAttribute('data-session-id'));
        } else if (row && !e.target.closest('button')) {
            showSessionDetails(row.getAttribute('data-session-id'));
        }
    });

    if (window.lucide) window.lucide.createIcons();

    // Cleanup on component unmount (not implemented in simple router)
    return () => {
        clearInterval(refreshInterval);
    };
}

export default { render, init };
