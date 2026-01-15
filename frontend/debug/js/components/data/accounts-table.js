/**
 * Accounts Table Component
 * Displays financial accounts in the system
 */

import debugApi from '../../api.js';
import debugState from '../../state.js';

let accounts = [];
let sortColumn = 'balance';
let sortDirection = 'desc';
let searchQuery = '';
let typeFilter = 'all';

const TYPE_BADGES = {
    CHECKING: 'bg-blue-500/20 text-blue-400',
    SAVINGS: 'bg-green-500/20 text-green-400',
    MONEY_MARKET: 'bg-purple-500/20 text-purple-400',
    CD: 'bg-amber-500/20 text-amber-400',
    LOAN: 'bg-red-500/20 text-red-400',
    CREDIT_LINE: 'bg-pink-500/20 text-pink-400'
};

const STATUS_BADGES = {
    ACTIVE: 'bg-green-500/20 text-green-400',
    FROZEN: 'bg-blue-500/20 text-blue-400',
    CLOSED: 'bg-slate-500/20 text-slate-400'
};

function formatCurrency(amount, currency = 'USD') {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency
    }).format(amount || 0);
}

function render() {
    return `
        <div class="space-y-4">
            <div class="flex items-center justify-between">
                <h2 class="text-lg font-semibold text-slate-100">Accounts</h2>
                <div class="flex items-center gap-3">
                    <select id="account-type-filter" class="debug-select">
                        <option value="all">All Types</option>
                        <option value="CHECKING">Checking</option>
                        <option value="SAVINGS">Savings</option>
                        <option value="MONEY_MARKET">Money Market</option>
                        <option value="CD">CD</option>
                        <option value="LOAN">Loan</option>
                        <option value="CREDIT_LINE">Credit Line</option>
                    </select>
                    <input type="text"
                           id="accounts-search"
                           placeholder="Search accounts..."
                           class="debug-input w-48"
                           value="${searchQuery}">
                    <button id="refresh-accounts" class="debug-btn debug-btn-secondary">
                        <i data-lucide="refresh-cw" class="w-4 h-4"></i>
                        Refresh
                    </button>
                </div>
            </div>

            <!-- Summary cards -->
            <div class="grid grid-cols-4 gap-4" id="accounts-summary">
                ${renderSummaryCards()}
            </div>

            <div class="debug-card">
                <div class="overflow-x-auto">
                    <table class="debug-table">
                        <thead>
                            <tr>
                                <th class="cursor-pointer hover:bg-slate-700/50" data-sort="account_number">Account #</th>
                                <th class="cursor-pointer hover:bg-slate-700/50" data-sort="name">Name</th>
                                <th class="cursor-pointer hover:bg-slate-700/50" data-sort="account_type">Type</th>
                                <th>Tenant</th>
                                <th class="cursor-pointer hover:bg-slate-700/50 text-right" data-sort="balance">Balance</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="accounts-tbody">
                            ${renderTableBody()}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
}

function renderSummaryCards() {
    const total = accounts.reduce((sum, a) => sum + (a.balance || 0), 0);
    const byType = accounts.reduce((acc, a) => {
        acc[a.account_type] = (acc[a.account_type] || 0) + (a.balance || 0);
        return acc;
    }, {});

    return `
        <div class="debug-card">
            <div class="p-4">
                <div class="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Accounts</div>
                <div class="text-2xl font-semibold text-slate-100 mt-1">${accounts.length}</div>
            </div>
        </div>
        <div class="debug-card">
            <div class="p-4">
                <div class="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Balance</div>
                <div class="text-2xl font-semibold text-green-400 mt-1">${formatCurrency(total)}</div>
            </div>
        </div>
        <div class="debug-card">
            <div class="p-4">
                <div class="text-xs font-medium text-slate-400 uppercase tracking-wider">Checking</div>
                <div class="text-xl font-semibold text-slate-100 mt-1">${formatCurrency(byType.CHECKING || 0)}</div>
            </div>
        </div>
        <div class="debug-card">
            <div class="p-4">
                <div class="text-xs font-medium text-slate-400 uppercase tracking-wider">Savings</div>
                <div class="text-xl font-semibold text-slate-100 mt-1">${formatCurrency(byType.SAVINGS || 0)}</div>
            </div>
        </div>
    `;
}

function renderTableBody() {
    const filtered = filterAndSortAccounts();

    if (filtered.length === 0) {
        return `
            <tr>
                <td colspan="7" class="text-center text-slate-500 py-8">
                    No accounts found
                </td>
            </tr>
        `;
    }

    return filtered.map(account => `
        <tr class="clickable" data-account-id="${account.id}">
            <td>
                <code class="text-sm text-slate-300">${account.account_number || '****'}</code>
            </td>
            <td>
                <div class="flex items-center gap-2">
                    <i data-lucide="wallet" class="w-4 h-4 text-slate-400"></i>
                    <span class="font-medium">${account.name}</span>
                </div>
            </td>
            <td>
                <span class="px-2 py-0.5 text-xs rounded ${TYPE_BADGES[account.account_type] || TYPE_BADGES.CHECKING}">
                    ${account.account_type || 'UNKNOWN'}
                </span>
            </td>
            <td class="text-sm text-slate-400">
                ${account.tenant?.name || account.tenant_id?.substring(0, 8) || '-'}
            </td>
            <td class="text-right font-mono ${account.balance >= 0 ? 'text-green-400' : 'text-red-400'}">
                ${formatCurrency(account.balance, account.currency)}
            </td>
            <td>
                <span class="px-2 py-0.5 text-xs rounded ${STATUS_BADGES[account.status] || STATUS_BADGES.ACTIVE}">
                    ${account.status || 'ACTIVE'}
                </span>
            </td>
            <td>
                <button class="debug-btn debug-btn-secondary text-xs py-1 px-2 view-account" data-account-id="${account.id}">
                    View
                </button>
            </td>
        </tr>
    `).join('');
}

function filterAndSortAccounts() {
    let filtered = [...accounts];

    if (typeFilter !== 'all') {
        filtered = filtered.filter(a => a.account_type === typeFilter);
    }

    if (searchQuery) {
        const query = searchQuery.toLowerCase();
        filtered = filtered.filter(a =>
            a.name?.toLowerCase().includes(query) ||
            a.account_number?.toLowerCase().includes(query) ||
            a.tenant?.name?.toLowerCase().includes(query)
        );
    }

    filtered.sort((a, b) => {
        let aVal = a[sortColumn] || '';
        let bVal = b[sortColumn] || '';

        if (sortColumn === 'balance') {
            aVal = parseFloat(aVal) || 0;
            bVal = parseFloat(bVal) || 0;
        }

        if (typeof aVal === 'string') {
            aVal = aVal.toLowerCase();
            bVal = bVal.toLowerCase();
        }

        return sortDirection === 'asc' ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1);
    });

    return filtered;
}

async function loadAccounts() {
    try {
        const response = await debugApi.getAccounts();
        accounts = response?.accounts || response || [];
        debugState.set('data.accounts', accounts);
        updateTableBody();
        updateSummaryCards();
    } catch (error) {
        console.error('Failed to load accounts:', error);
        accounts = [];
        updateTableBody();
    }
}

function updateTableBody() {
    const tbody = document.getElementById('accounts-tbody');
    if (tbody) {
        tbody.innerHTML = renderTableBody();
        if (window.lucide) window.lucide.createIcons();
    }
}

function updateSummaryCards() {
    const summary = document.getElementById('accounts-summary');
    if (summary) {
        summary.innerHTML = renderSummaryCards();
    }
}

function showAccountDetails(accountId) {
    const account = accounts.find(a => a.id === accountId);
    if (!account) return;

    const html = `
        <div class="space-y-6">
            <div class="flex items-center gap-4">
                <div class="w-16 h-16 rounded bg-slate-700 flex items-center justify-center">
                    <i data-lucide="wallet" class="w-8 h-8 text-slate-400"></i>
                </div>
                <div>
                    <h3 class="text-lg font-medium text-slate-100">${account.name}</h3>
                    <div class="flex items-center gap-2 mt-1">
                        <span class="px-2 py-0.5 text-xs rounded ${TYPE_BADGES[account.account_type] || TYPE_BADGES.CHECKING}">
                            ${account.account_type}
                        </span>
                        <span class="px-2 py-0.5 text-xs rounded ${STATUS_BADGES[account.status] || STATUS_BADGES.ACTIVE}">
                            ${account.status}
                        </span>
                    </div>
                </div>
            </div>

            <div class="p-4 rounded bg-slate-900 border border-slate-700">
                <div class="text-xs font-medium text-slate-400 uppercase tracking-wider">Current Balance</div>
                <div class="text-3xl font-bold ${account.balance >= 0 ? 'text-green-400' : 'text-red-400'} mt-1">
                    ${formatCurrency(account.balance, account.currency)}
                </div>
            </div>

            <div class="grid grid-cols-2 gap-4">
                <div>
                    <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Account ID</h4>
                    <code class="text-sm text-slate-300 font-mono break-all">${account.id}</code>
                </div>
                <div>
                    <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Account Number</h4>
                    <code class="text-sm text-slate-300 font-mono">${account.account_number}</code>
                </div>
                <div>
                    <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Tenant ID</h4>
                    <code class="text-sm text-slate-300 font-mono break-all">${account.tenant_id}</code>
                </div>
                <div>
                    <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Currency</h4>
                    <span class="text-sm text-slate-300">${account.currency || 'USD'}</span>
                </div>
            </div>

            <div>
                <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Raw Data</h4>
                <pre class="code-block bg-slate-900 p-3 rounded overflow-x-auto text-xs"><code class="language-json">${JSON.stringify(account, null, 2)}</code></pre>
            </div>
        </div>
    `;

    debugState.openSlideOver(`Account: ${account.name}`, { html });

    setTimeout(() => {
        if (window.lucide) window.lucide.createIcons();
        if (window.hljs) {
            document.querySelectorAll('#slide-over-content pre code').forEach(block => {
                window.hljs.highlightElement(block);
            });
        }
    }, 10);
}

function init() {
    loadAccounts();

    document.getElementById('accounts-search')?.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        updateTableBody();
    });

    document.getElementById('account-type-filter')?.addEventListener('change', (e) => {
        typeFilter = e.target.value;
        updateTableBody();
    });

    document.getElementById('refresh-accounts')?.addEventListener('click', loadAccounts);

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

    document.addEventListener('click', (e) => {
        const viewBtn = e.target.closest('.view-account');
        const row = e.target.closest('[data-account-id]');

        if (viewBtn) {
            showAccountDetails(viewBtn.getAttribute('data-account-id'));
        } else if (row && !e.target.closest('button')) {
            showAccountDetails(row.getAttribute('data-account-id'));
        }
    });

    if (window.lucide) window.lucide.createIcons();
}

export default { render, init };
