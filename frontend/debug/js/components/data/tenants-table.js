/**
 * Tenants Table Component
 * Displays all tenants/organizations in the system
 */

import debugApi from '../../api.js';
import debugState from '../../state.js';

let tenants = [];
let sortColumn = 'created_at';
let sortDirection = 'desc';
let searchQuery = '';
let typeFilter = 'all';

// Tenant type badges
const TYPE_BADGES = {
    CONSUMER: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    SMALL_BUSINESS: 'bg-green-500/20 text-green-400 border-green-500/30',
    COMMERCIAL: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    INVESTMENT: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    TRUST: 'bg-slate-500/20 text-slate-400 border-slate-500/30'
};

const STATUS_BADGES = {
    ACTIVE: 'bg-green-500/20 text-green-400',
    SUSPENDED: 'bg-amber-500/20 text-amber-400',
    CLOSED: 'bg-red-500/20 text-red-400'
};

/**
 * Format date for display
 */
function formatDate(dateString) {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString();
}

/**
 * Render the tenants table
 */
function render() {
    return `
        <div class="space-y-4">
            <div class="flex items-center justify-between">
                <h2 class="text-lg font-semibold text-slate-100">Tenants</h2>
                <div class="flex items-center gap-3">
                    <select id="tenant-type-filter" class="debug-select">
                        <option value="all">All Types</option>
                        <option value="CONSUMER">Consumer</option>
                        <option value="SMALL_BUSINESS">Small Business</option>
                        <option value="COMMERCIAL">Commercial</option>
                        <option value="INVESTMENT">Investment</option>
                        <option value="TRUST">Trust</option>
                    </select>
                    <input type="text"
                           id="tenants-search"
                           placeholder="Search tenants..."
                           class="debug-input w-64"
                           value="${searchQuery}">
                    <button id="refresh-tenants" class="debug-btn debug-btn-secondary">
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
                                <th class="cursor-pointer hover:bg-slate-700/50" data-sort="id">
                                    ID ${sortColumn === 'id' ? (sortDirection === 'asc' ? '&#9650;' : '&#9660;') : ''}
                                </th>
                                <th class="cursor-pointer hover:bg-slate-700/50" data-sort="name">
                                    Name ${sortColumn === 'name' ? (sortDirection === 'asc' ? '&#9650;' : '&#9660;') : ''}
                                </th>
                                <th class="cursor-pointer hover:bg-slate-700/50" data-sort="type">
                                    Type ${sortColumn === 'type' ? (sortDirection === 'asc' ? '&#9650;' : '&#9660;') : ''}
                                </th>
                                <th>Status</th>
                                <th>External ID</th>
                                <th class="cursor-pointer hover:bg-slate-700/50" data-sort="created_at">
                                    Created ${sortColumn === 'created_at' ? (sortDirection === 'asc' ? '&#9650;' : '&#9660;') : ''}
                                </th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="tenants-tbody">
                            ${renderTableBody()}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
}

/**
 * Render table body
 */
function renderTableBody() {
    const filteredTenants = filterAndSortTenants();

    if (filteredTenants.length === 0) {
        return `
            <tr>
                <td colspan="7" class="text-center text-slate-500 py-8">
                    ${searchQuery || typeFilter !== 'all' ? 'No tenants match your filters' : 'No tenants found'}
                </td>
            </tr>
        `;
    }

    return filteredTenants.map(tenant => `
        <tr class="clickable" data-tenant-id="${tenant.id}">
            <td>
                <code class="text-xs text-slate-400">${tenant.id?.substring(0, 8)}...</code>
            </td>
            <td>
                <div class="flex items-center gap-2">
                    <div class="w-8 h-8 rounded bg-slate-700 flex items-center justify-center">
                        <i data-lucide="${tenant.type === 'CONSUMER' ? 'user' : 'building-2'}" class="w-4 h-4 text-slate-400"></i>
                    </div>
                    <span class="font-medium">${tenant.name}</span>
                </div>
            </td>
            <td>
                <span class="px-2 py-0.5 text-xs rounded border ${TYPE_BADGES[tenant.type] || TYPE_BADGES.CONSUMER}">
                    ${tenant.type || 'UNKNOWN'}
                </span>
            </td>
            <td>
                <span class="px-2 py-0.5 text-xs rounded ${STATUS_BADGES[tenant.status] || STATUS_BADGES.ACTIVE}">
                    ${tenant.status || 'UNKNOWN'}
                </span>
            </td>
            <td>
                <code class="text-xs text-slate-400">${tenant.external_id?.substring(0, 12) || '-'}...</code>
            </td>
            <td class="text-slate-400 text-sm">${formatDate(tenant.created_at)}</td>
            <td>
                <button class="debug-btn debug-btn-secondary text-xs py-1 px-2 view-tenant" data-tenant-id="${tenant.id}">
                    View
                </button>
            </td>
        </tr>
    `).join('');
}

/**
 * Filter and sort tenants
 */
function filterAndSortTenants() {
    let filtered = [...tenants];

    // Apply type filter
    if (typeFilter !== 'all') {
        filtered = filtered.filter(t => t.type === typeFilter);
    }

    // Apply search filter
    if (searchQuery) {
        const query = searchQuery.toLowerCase();
        filtered = filtered.filter(tenant =>
            tenant.name?.toLowerCase().includes(query) ||
            tenant.id?.toLowerCase().includes(query) ||
            tenant.external_id?.toLowerCase().includes(query)
        );
    }

    // Apply sorting
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

        if (sortDirection === 'asc') {
            return aVal > bVal ? 1 : -1;
        } else {
            return aVal < bVal ? 1 : -1;
        }
    });

    return filtered;
}

/**
 * Load tenants from API
 */
async function loadTenants() {
    try {
        const response = await debugApi.getTenants();
        tenants = response?.tenants || response || [];
        debugState.set('data.tenants', tenants);
        updateTableBody();
    } catch (error) {
        console.error('Failed to load tenants:', error);
        tenants = [];
        updateTableBody();
    }
}

/**
 * Update just the table body
 */
function updateTableBody() {
    const tbody = document.getElementById('tenants-tbody');
    if (tbody) {
        tbody.innerHTML = renderTableBody();
        if (window.lucide) {
            window.lucide.createIcons();
        }
    }
}

/**
 * Show tenant details in slide-over
 */
function showTenantDetails(tenantId) {
    const tenant = tenants.find(t => t.id === tenantId);
    if (!tenant) return;

    const html = `
        <div class="space-y-6">
            <div class="flex items-center gap-4">
                <div class="w-16 h-16 rounded bg-slate-700 flex items-center justify-center">
                    <i data-lucide="${tenant.type === 'CONSUMER' ? 'user' : 'building-2'}" class="w-8 h-8 text-slate-400"></i>
                </div>
                <div>
                    <h3 class="text-lg font-medium text-slate-100">${tenant.name}</h3>
                    <div class="flex items-center gap-2 mt-1">
                        <span class="px-2 py-0.5 text-xs rounded border ${TYPE_BADGES[tenant.type] || TYPE_BADGES.CONSUMER}">
                            ${tenant.type}
                        </span>
                        <span class="px-2 py-0.5 text-xs rounded ${STATUS_BADGES[tenant.status] || STATUS_BADGES.ACTIVE}">
                            ${tenant.status}
                        </span>
                    </div>
                </div>
            </div>

            <div class="grid grid-cols-2 gap-4">
                <div>
                    <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">ID</h4>
                    <code class="text-sm text-slate-300 font-mono break-all">${tenant.id}</code>
                </div>
                <div>
                    <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">External ID</h4>
                    <code class="text-sm text-slate-300 font-mono break-all">${tenant.external_id || '-'}</code>
                </div>
                <div>
                    <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Created</h4>
                    <span class="text-sm text-slate-300">${formatDate(tenant.created_at)}</span>
                </div>
                <div>
                    <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Updated</h4>
                    <span class="text-sm text-slate-300">${formatDate(tenant.updated_at)}</span>
                </div>
            </div>

            ${tenant.metadata ? `
            <div>
                <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Metadata</h4>
                <pre class="code-block bg-slate-900 p-3 rounded overflow-x-auto text-xs"><code class="language-json">${JSON.stringify(tenant.metadata, null, 2)}</code></pre>
            </div>
            ` : ''}

            <div>
                <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Raw Data</h4>
                <pre class="code-block bg-slate-900 p-3 rounded overflow-x-auto text-xs"><code class="language-json">${JSON.stringify(tenant, null, 2)}</code></pre>
            </div>
        </div>
    `;

    debugState.openSlideOver(`Tenant: ${tenant.name}`, { html });

    // Initialize icons and highlight JSON
    setTimeout(() => {
        if (window.lucide) window.lucide.createIcons();
        if (window.hljs) {
            document.querySelectorAll('#slide-over-content pre code').forEach(block => {
                window.hljs.highlightElement(block);
            });
        }
    }, 10);
}

/**
 * Initialize the component
 */
function init() {
    // Load initial data
    loadTenants();

    // Setup event handlers
    const searchInput = document.getElementById('tenants-search');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value;
            updateTableBody();
        });
    }

    const typeSelect = document.getElementById('tenant-type-filter');
    if (typeSelect) {
        typeSelect.addEventListener('change', (e) => {
            typeFilter = e.target.value;
            updateTableBody();
        });
    }

    const refreshBtn = document.getElementById('refresh-tenants');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', loadTenants);
    }

    // Sort handlers
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

    // Row click handler
    document.addEventListener('click', (e) => {
        const viewBtn = e.target.closest('.view-tenant');
        const row = e.target.closest('[data-tenant-id]');

        if (viewBtn) {
            const tenantId = viewBtn.getAttribute('data-tenant-id');
            showTenantDetails(tenantId);
        } else if (row && !e.target.closest('button')) {
            const tenantId = row.getAttribute('data-tenant-id');
            showTenantDetails(tenantId);
        }
    });

    // Initialize Lucide icons
    if (window.lucide) {
        window.lucide.createIcons();
    }
}

export default { render, init };
