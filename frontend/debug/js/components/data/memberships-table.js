/**
 * Memberships Table Component
 * Displays user-tenant membership relationships
 */

import debugApi from '../../api.js';
import debugState from '../../state.js';

let memberships = [];
let sortColumn = 'created_at';
let sortDirection = 'desc';
let searchQuery = '';
let roleFilter = 'all';
let statusFilter = 'all';

const ROLE_BADGES = {
    OWNER: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    ADMIN: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    OPERATOR: 'bg-green-500/20 text-green-400 border-green-500/30',
    VIEWER: 'bg-slate-500/20 text-slate-400 border-slate-500/30'
};

const STATUS_BADGES = {
    ACTIVE: 'bg-green-500/20 text-green-400',
    INVITED: 'bg-blue-500/20 text-blue-400',
    SUSPENDED: 'bg-amber-500/20 text-amber-400',
    REVOKED: 'bg-red-500/20 text-red-400'
};

function formatDate(dateString) {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString();
}

function render() {
    return `
        <div class="space-y-4">
            <div class="flex items-center justify-between">
                <h2 class="text-lg font-semibold text-slate-100">Memberships</h2>
                <div class="flex items-center gap-3">
                    <select id="role-filter" class="debug-select">
                        <option value="all">All Roles</option>
                        <option value="OWNER">Owner</option>
                        <option value="ADMIN">Admin</option>
                        <option value="OPERATOR">Operator</option>
                        <option value="VIEWER">Viewer</option>
                    </select>
                    <select id="status-filter" class="debug-select">
                        <option value="all">All Statuses</option>
                        <option value="ACTIVE">Active</option>
                        <option value="INVITED">Invited</option>
                        <option value="SUSPENDED">Suspended</option>
                        <option value="REVOKED">Revoked</option>
                    </select>
                    <input type="text"
                           id="memberships-search"
                           placeholder="Search..."
                           class="debug-input w-48"
                           value="${searchQuery}">
                    <button id="refresh-memberships" class="debug-btn debug-btn-secondary">
                        <i data-lucide="refresh-cw" class="w-4 h-4"></i>
                        Refresh
                    </button>
                </div>
            </div>

            <div class="debug-card">
                <div class="overflow-x-auto">
                    <table class="debug-table">
                        <thead>
                            <tr>
                                <th class="cursor-pointer hover:bg-slate-700/50" data-sort="id">ID</th>
                                <th>User</th>
                                <th>Tenant</th>
                                <th class="cursor-pointer hover:bg-slate-700/50" data-sort="role">Role</th>
                                <th class="cursor-pointer hover:bg-slate-700/50" data-sort="status">Status</th>
                                <th class="cursor-pointer hover:bg-slate-700/50" data-sort="created_at">Created</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="memberships-tbody">
                            ${renderTableBody()}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
}

function renderTableBody() {
    const filtered = filterAndSortMemberships();

    if (filtered.length === 0) {
        return `
            <tr>
                <td colspan="7" class="text-center text-slate-500 py-8">
                    No memberships found
                </td>
            </tr>
        `;
    }

    return filtered.map(membership => `
        <tr class="clickable" data-membership-id="${membership.id}">
            <td>
                <code class="text-xs text-slate-400">${membership.id?.substring(0, 8)}...</code>
            </td>
            <td>
                <div class="flex items-center gap-2">
                    <div class="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-xs">
                        ${membership.user?.display_name?.charAt(0) || membership.user_id?.charAt(0) || '?'}
                    </div>
                    <span class="text-sm">${membership.user?.email || membership.user_id?.substring(0, 8) || '-'}</span>
                </div>
            </td>
            <td>
                <span class="text-sm">${membership.tenant?.name || membership.tenant_id?.substring(0, 8) || '-'}</span>
            </td>
            <td>
                <span class="px-2 py-0.5 text-xs rounded border ${ROLE_BADGES[membership.role] || ROLE_BADGES.VIEWER}">
                    ${membership.role || 'UNKNOWN'}
                </span>
            </td>
            <td>
                <span class="px-2 py-0.5 text-xs rounded ${STATUS_BADGES[membership.status] || STATUS_BADGES.ACTIVE}">
                    ${membership.status || 'UNKNOWN'}
                </span>
            </td>
            <td class="text-slate-400 text-sm">${formatDate(membership.created_at)}</td>
            <td>
                <button class="debug-btn debug-btn-secondary text-xs py-1 px-2 view-membership" data-membership-id="${membership.id}">
                    View
                </button>
            </td>
        </tr>
    `).join('');
}

function filterAndSortMemberships() {
    let filtered = [...memberships];

    if (roleFilter !== 'all') {
        filtered = filtered.filter(m => m.role === roleFilter);
    }

    if (statusFilter !== 'all') {
        filtered = filtered.filter(m => m.status === statusFilter);
    }

    if (searchQuery) {
        const query = searchQuery.toLowerCase();
        filtered = filtered.filter(m =>
            m.user?.email?.toLowerCase().includes(query) ||
            m.tenant?.name?.toLowerCase().includes(query) ||
            m.id?.toLowerCase().includes(query)
        );
    }

    filtered.sort((a, b) => {
        let aVal = a[sortColumn] || '';
        let bVal = b[sortColumn] || '';

        if (sortColumn === 'created_at') {
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

async function loadMemberships() {
    try {
        const response = await debugApi.getMemberships();
        memberships = response?.memberships || response || [];
        debugState.set('data.memberships', memberships);
        updateTableBody();
    } catch (error) {
        console.error('Failed to load memberships:', error);
        memberships = [];
        updateTableBody();
    }
}

function updateTableBody() {
    const tbody = document.getElementById('memberships-tbody');
    if (tbody) {
        tbody.innerHTML = renderTableBody();
    }
}

function showMembershipDetails(membershipId) {
    const membership = memberships.find(m => m.id === membershipId);
    if (!membership) return;

    const html = `
        <div class="space-y-6">
            <div class="flex items-center gap-3">
                <span class="px-2 py-0.5 text-xs rounded border ${ROLE_BADGES[membership.role] || ROLE_BADGES.VIEWER}">
                    ${membership.role}
                </span>
                <span class="px-2 py-0.5 text-xs rounded ${STATUS_BADGES[membership.status] || STATUS_BADGES.ACTIVE}">
                    ${membership.status}
                </span>
            </div>

            <div class="grid grid-cols-2 gap-4">
                <div>
                    <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Membership ID</h4>
                    <code class="text-sm text-slate-300 font-mono break-all">${membership.id}</code>
                </div>
                <div>
                    <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">User ID</h4>
                    <code class="text-sm text-slate-300 font-mono break-all">${membership.user_id}</code>
                </div>
                <div>
                    <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Tenant ID</h4>
                    <code class="text-sm text-slate-300 font-mono break-all">${membership.tenant_id}</code>
                </div>
                <div>
                    <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Created</h4>
                    <span class="text-sm text-slate-300">${formatDate(membership.created_at)}</span>
                </div>
                ${membership.invited_at ? `
                <div>
                    <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Invited</h4>
                    <span class="text-sm text-slate-300">${formatDate(membership.invited_at)}</span>
                </div>
                ` : ''}
                ${membership.accepted_at ? `
                <div>
                    <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Accepted</h4>
                    <span class="text-sm text-slate-300">${formatDate(membership.accepted_at)}</span>
                </div>
                ` : ''}
            </div>

            <div>
                <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Raw Data</h4>
                <pre class="code-block bg-slate-900 p-3 rounded overflow-x-auto text-xs"><code class="language-json">${JSON.stringify(membership, null, 2)}</code></pre>
            </div>
        </div>
    `;

    debugState.openSlideOver('Membership Details', { html });

    setTimeout(() => {
        if (window.hljs) {
            document.querySelectorAll('#slide-over-content pre code').forEach(block => {
                window.hljs.highlightElement(block);
            });
        }
    }, 10);
}

function init() {
    loadMemberships();

    document.getElementById('memberships-search')?.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        updateTableBody();
    });

    document.getElementById('role-filter')?.addEventListener('change', (e) => {
        roleFilter = e.target.value;
        updateTableBody();
    });

    document.getElementById('status-filter')?.addEventListener('change', (e) => {
        statusFilter = e.target.value;
        updateTableBody();
    });

    document.getElementById('refresh-memberships')?.addEventListener('click', loadMemberships);

    document.querySelectorAll('[data-sort]').forEach(th => {
        th.addEventListener('click', () => {
            const column = th.getAttribute('data-sort');
            if (sortColumn === column) {
                sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                sortColumn = column;
                sortDirection = 'asc';
            }
            updateTableBody();
        });
    });

    document.addEventListener('click', (e) => {
        const viewBtn = e.target.closest('.view-membership');
        const row = e.target.closest('[data-membership-id]');

        if (viewBtn) {
            showMembershipDetails(viewBtn.getAttribute('data-membership-id'));
        } else if (row && !e.target.closest('button')) {
            showMembershipDetails(row.getAttribute('data-membership-id'));
        }
    });

    if (window.lucide) window.lucide.createIcons();
}

export default { render, init };
