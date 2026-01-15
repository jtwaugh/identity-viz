/**
 * Users Table Component
 * Displays all users in the system
 */

import debugApi from '../../api.js';
import debugState from '../../state.js';

let users = [];
let sortColumn = 'created_at';
let sortDirection = 'desc';
let searchQuery = '';

/**
 * Format date for display
 */
function formatDate(dateString) {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString();
}

/**
 * Render the users table
 */
function render() {
    return `
        <div class="space-y-4">
            <div class="flex items-center justify-between">
                <h2 class="text-lg font-semibold text-slate-100">Users</h2>
                <div class="flex items-center gap-3">
                    <input type="text"
                           id="users-search"
                           placeholder="Search users..."
                           class="debug-input w-64"
                           value="${searchQuery}">
                    <button id="refresh-users" class="debug-btn debug-btn-secondary">
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
                                <th class="cursor-pointer hover:bg-slate-700/50" data-sort="email">
                                    Email ${sortColumn === 'email' ? (sortDirection === 'asc' ? '&#9650;' : '&#9660;') : ''}
                                </th>
                                <th class="cursor-pointer hover:bg-slate-700/50" data-sort="display_name">
                                    Display Name ${sortColumn === 'display_name' ? (sortDirection === 'asc' ? '&#9650;' : '&#9660;') : ''}
                                </th>
                                <th>External ID</th>
                                <th>MFA</th>
                                <th class="cursor-pointer hover:bg-slate-700/50" data-sort="created_at">
                                    Created ${sortColumn === 'created_at' ? (sortDirection === 'asc' ? '&#9650;' : '&#9660;') : ''}
                                </th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="users-tbody">
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
    const filteredUsers = filterAndSortUsers();

    if (filteredUsers.length === 0) {
        return `
            <tr>
                <td colspan="7" class="text-center text-slate-500 py-8">
                    ${searchQuery ? 'No users match your search' : 'No users found'}
                </td>
            </tr>
        `;
    }

    return filteredUsers.map(user => `
        <tr class="clickable" data-user-id="${user.id}">
            <td>
                <code class="text-xs text-slate-400">${user.id?.substring(0, 8)}...</code>
            </td>
            <td>
                <div class="flex items-center gap-2">
                    <div class="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-medium text-slate-300">
                        ${user.display_name?.charAt(0) || user.email?.charAt(0) || '?'}
                    </div>
                    <span>${user.email}</span>
                </div>
            </td>
            <td>${user.display_name || '-'}</td>
            <td>
                <code class="text-xs text-slate-400">${user.external_id?.substring(0, 12) || '-'}...</code>
            </td>
            <td>
                ${user.mfa_enabled
                    ? '<span class="px-2 py-0.5 text-xs rounded bg-green-500/20 text-green-400">Enabled</span>'
                    : '<span class="px-2 py-0.5 text-xs rounded bg-slate-700 text-slate-400">Disabled</span>'
                }
            </td>
            <td class="text-slate-400 text-sm">${formatDate(user.created_at)}</td>
            <td>
                <button class="debug-btn debug-btn-secondary text-xs py-1 px-2 view-user" data-user-id="${user.id}">
                    View
                </button>
            </td>
        </tr>
    `).join('');
}

/**
 * Filter and sort users
 */
function filterAndSortUsers() {
    let filtered = [...users];

    // Apply search filter
    if (searchQuery) {
        const query = searchQuery.toLowerCase();
        filtered = filtered.filter(user =>
            user.email?.toLowerCase().includes(query) ||
            user.display_name?.toLowerCase().includes(query) ||
            user.id?.toLowerCase().includes(query)
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
 * Load users from API
 */
async function loadUsers() {
    try {
        const response = await debugApi.getUsers();
        users = response?.users || response || [];
        debugState.set('data.users', users);
        updateTableBody();
    } catch (error) {
        console.error('Failed to load users:', error);
        users = [];
        updateTableBody();
    }
}

/**
 * Update just the table body
 */
function updateTableBody() {
    const tbody = document.getElementById('users-tbody');
    if (tbody) {
        tbody.innerHTML = renderTableBody();
    }
}

/**
 * Show user details in slide-over
 */
function showUserDetails(userId) {
    const user = users.find(u => u.id === userId);
    if (!user) return;

    const html = `
        <div class="space-y-6">
            <div class="flex items-center gap-4">
                <div class="w-16 h-16 rounded-full bg-slate-700 flex items-center justify-center text-xl font-medium text-slate-300">
                    ${user.display_name?.charAt(0) || user.email?.charAt(0) || '?'}
                </div>
                <div>
                    <h3 class="text-lg font-medium text-slate-100">${user.display_name || 'Unknown'}</h3>
                    <p class="text-sm text-slate-400">${user.email}</p>
                </div>
            </div>

            <div class="grid grid-cols-2 gap-4">
                <div>
                    <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">ID</h4>
                    <code class="text-sm text-slate-300 font-mono break-all">${user.id}</code>
                </div>
                <div>
                    <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">External ID</h4>
                    <code class="text-sm text-slate-300 font-mono break-all">${user.external_id || '-'}</code>
                </div>
                <div>
                    <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">MFA Status</h4>
                    <span class="px-2 py-0.5 text-xs rounded ${user.mfa_enabled ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-400'}">
                        ${user.mfa_enabled ? 'Enabled' : 'Disabled'}
                    </span>
                </div>
                <div>
                    <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Created</h4>
                    <span class="text-sm text-slate-300">${formatDate(user.created_at)}</span>
                </div>
            </div>

            <div>
                <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Raw Data</h4>
                <pre class="code-block bg-slate-900 p-3 rounded overflow-x-auto text-xs"><code class="language-json">${JSON.stringify(user, null, 2)}</code></pre>
            </div>
        </div>
    `;

    debugState.openSlideOver(`User: ${user.display_name || user.email}`, { html });

    // Highlight JSON
    setTimeout(() => {
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
    loadUsers();

    // Setup event handlers
    const searchInput = document.getElementById('users-search');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value;
            updateTableBody();
        });
    }

    const refreshBtn = document.getElementById('refresh-users');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', loadUsers);
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
        const viewBtn = e.target.closest('.view-user');
        const row = e.target.closest('[data-user-id]');

        if (viewBtn) {
            const userId = viewBtn.getAttribute('data-user-id');
            showUserDetails(userId);
        } else if (row && !e.target.closest('button')) {
            const userId = row.getAttribute('data-user-id');
            showUserDetails(userId);
        }
    });

    // Initialize Lucide icons
    if (window.lucide) {
        window.lucide.createIcons();
    }
}

export default { render, init };
