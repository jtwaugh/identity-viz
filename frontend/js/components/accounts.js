/**
 * Accounts Component
 * Account list and account details views
 */

import auth from '../auth.js';
import api from '../api.js';
import state from '../state.js';
import router from '../router.js';
import header from './header.js';
import {
    showLoading,
    hideLoading,
    showToast,
    formatCurrency,
    formatDate,
    formatRelativeTime,
    getTenantTypeInfo,
    getAccountTypeInfo,
    escapeHtml
} from '../ui.js';

// Mock transaction data
const MOCK_TRANSACTIONS = {
    'acc-001': [
        { id: 'tx-001', date: new Date(Date.now() - 86400000), description: 'Direct Deposit - Payroll', category: 'Income', amount: 3250.00, balance: 4521.33 },
        { id: 'tx-002', date: new Date(Date.now() - 172800000), description: 'Electric Company', category: 'Utilities', amount: -145.32, balance: 1271.33 },
        { id: 'tx-003', date: new Date(Date.now() - 259200000), description: 'Grocery Store', category: 'Food & Dining', amount: -87.54, balance: 1416.65 },
        { id: 'tx-004', date: new Date(Date.now() - 345600000), description: 'Refund - Online Purchase', category: 'Shopping', amount: 29.99, balance: 1504.19 },
        { id: 'tx-005', date: new Date(Date.now() - 432000000), description: 'Gas Station', category: 'Transportation', amount: -45.00, balance: 1474.20 },
        { id: 'tx-006', date: new Date(Date.now() - 518400000), description: 'Restaurant', category: 'Food & Dining', amount: -62.80, balance: 1519.20 }
    ],
    'acc-005': [
        { id: 'tx-010', date: new Date(Date.now() - 86400000), description: 'Wire Transfer - Client Payment', category: 'Income', amount: 125000.00, balance: 5400000.00 },
        { id: 'tx-011', date: new Date(Date.now() - 172800000), description: 'Payroll - Bi-weekly', category: 'Payroll', amount: -234500.00, balance: 5275000.00 },
        { id: 'tx-012', date: new Date(Date.now() - 259200000), description: 'Vendor Payment - Office Supplies', category: 'Operations', amount: -8750.00, balance: 5509500.00 },
        { id: 'tx-013', date: new Date(Date.now() - 345600000), description: 'Client Invoice #1234', category: 'Income', amount: 45000.00, balance: 5518250.00 }
    ]
};

/**
 * Render account list page
 */
export async function renderList() {
    const app = document.getElementById('app');
    const currentTenant = state.get('currentTenant');
    const typeInfo = getTenantTypeInfo(currentTenant.type);

    // Show loading
    app.innerHTML = `
        ${header.render()}
        <main class="max-w-7xl mx-auto px-4 py-6">
            <div class="flex items-center justify-center py-12">
                <div class="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full spinner"></div>
            </div>
        </main>
    `;
    if (window.lucide) lucide.createIcons();
    header.init();

    // Fetch accounts
    let accounts = state.get('accounts') || [];
    if (accounts.length === 0) {
        try {
            const response = await api.getAccounts();
            accounts = response.accounts || [];
            state.set('accounts', accounts);
        } catch (error) {
            console.warn('Failed to fetch accounts:', error);
            // Use mock data from dashboard
            accounts = state.get('accounts') || [];
        }
    }

    const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);
    const colorClass = currentTenant.type === 'COMMERCIAL' ? 'purple' : 'blue';

    app.innerHTML = `
        ${header.render()}
        <main class="max-w-7xl mx-auto px-4 py-6">
            <!-- Breadcrumb -->
            <nav class="flex items-center gap-2 text-sm mb-6">
                <a href="#/dashboard" class="text-gray-500 hover:text-gray-700">Dashboard</a>
                <i data-lucide="chevron-right" class="w-4 h-4 text-gray-400"></i>
                <span class="text-gray-900 font-medium">Accounts</span>
            </nav>

            <div class="flex items-center justify-between mb-6">
                <div>
                    <h1 class="text-2xl font-bold text-gray-900">${currentTenant.type === 'COMMERCIAL' ? 'Business' : 'Your'} Accounts</h1>
                    <p class="text-gray-500">Manage and view all your accounts</p>
                </div>
                <div class="text-right">
                    <p class="text-sm text-gray-500">Total Balance</p>
                    <p class="text-2xl font-bold text-gray-900 balance-amount">${formatCurrency(totalBalance)}</p>
                </div>
            </div>

            <!-- Account Grid -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                ${accounts.map(account => renderAccountCard(account, colorClass)).join('')}
            </div>
        </main>
    `;

    if (window.lucide) lucide.createIcons();
    header.init();

    // Attach handlers
    document.querySelectorAll('.account-card').forEach(card => {
        card.addEventListener('click', () => {
            router.navigate(`/accounts/${card.dataset.accountId}`);
        });
    });
}

/**
 * Render account details page
 * @param {Object} context - Route context with params
 */
export async function renderDetails(context) {
    const { params } = context;
    const accountId = params.id;
    const app = document.getElementById('app');
    const currentTenant = state.get('currentTenant');

    // Show loading
    app.innerHTML = `
        ${header.render()}
        <main class="max-w-7xl mx-auto px-4 py-6">
            <div class="flex items-center justify-center py-12">
                <div class="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full spinner"></div>
            </div>
        </main>
    `;
    if (window.lucide) lucide.createIcons();
    header.init();

    // Find account
    let accounts = state.get('accounts') || [];
    let account = accounts.find(a => a.id === accountId);

    if (!account) {
        try {
            account = await api.getAccount(accountId);
        } catch (error) {
            console.warn('Failed to fetch account:', error);
            showToast('Account not found', 'error');
            router.navigate('/accounts');
            return;
        }
    }

    // Fetch transactions
    let transactions = [];
    try {
        const response = await api.getTransactions(accountId);
        transactions = response.transactions || [];
    } catch (error) {
        console.warn('Failed to fetch transactions, using mock data:', error);
        transactions = MOCK_TRANSACTIONS[accountId] || MOCK_TRANSACTIONS['acc-001'];
    }

    const typeInfo = getAccountTypeInfo(account.type);
    const colorClass = currentTenant.type === 'COMMERCIAL' ? 'purple' : 'blue';

    app.innerHTML = `
        ${header.render()}
        <main class="max-w-7xl mx-auto px-4 py-6">
            <!-- Breadcrumb -->
            <nav class="flex items-center gap-2 text-sm mb-6">
                <a href="#/dashboard" class="text-gray-500 hover:text-gray-700">Dashboard</a>
                <i data-lucide="chevron-right" class="w-4 h-4 text-gray-400"></i>
                <a href="#/accounts" class="text-gray-500 hover:text-gray-700">Accounts</a>
                <i data-lucide="chevron-right" class="w-4 h-4 text-gray-400"></i>
                <span class="text-gray-900 font-medium">${escapeHtml(account.name)}</span>
            </nav>

            <!-- Account Header Card -->
            <div class="card p-6 mb-6">
                <div class="flex items-start justify-between">
                    <div class="flex items-center gap-4">
                        <div class="w-14 h-14 rounded-xl bg-${colorClass}-100 flex items-center justify-center">
                            <i data-lucide="${typeInfo.icon}" class="w-7 h-7 text-${colorClass}-600"></i>
                        </div>
                        <div>
                            <h1 class="text-xl font-bold text-gray-900">${escapeHtml(account.name)}</h1>
                            <p class="text-gray-500">${account.account_number || account.accountNumber}</p>
                            <span class="badge badge-${colorClass === 'purple' ? 'commercial' : 'consumer'} mt-2">${typeInfo.label}</span>
                        </div>
                    </div>
                    <div class="text-right">
                        <p class="text-sm text-gray-500">Current Balance</p>
                        <p class="text-3xl font-bold text-gray-900 balance-amount">${formatCurrency(account.balance, account.currency)}</p>
                        <p class="text-sm text-gray-500 mt-1">Available: ${formatCurrency(account.balance * 0.95)}</p>
                    </div>
                </div>
            </div>

            <!-- Tabs -->
            <div class="card">
                <div class="tabs-list border-b border-gray-200 px-4">
                    <button class="tab-trigger active" data-tab="transactions">Transactions</button>
                    <button class="tab-trigger" data-tab="details">Details</button>
                    <button class="tab-trigger" data-tab="statements">Statements</button>
                </div>

                <!-- Transactions Tab -->
                <div class="tab-content active p-4" id="tab-transactions">
                    <!-- Filters -->
                    <div class="flex flex-wrap items-center gap-4 mb-4">
                        <div class="flex-1 min-w-[200px]">
                            <input type="text" class="input" placeholder="Search transactions...">
                        </div>
                        <select class="select w-auto">
                            <option>All Types</option>
                            <option>Credits</option>
                            <option>Debits</option>
                        </select>
                        <select class="select w-auto">
                            <option>Last 30 Days</option>
                            <option>Last 60 Days</option>
                            <option>Last 90 Days</option>
                            <option>Custom Range</option>
                        </select>
                    </div>

                    <!-- Transactions Table -->
                    <div class="overflow-x-auto">
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Description</th>
                                    <th>Category</th>
                                    <th class="text-right">Amount</th>
                                    <th class="text-right">Balance</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${transactions.map(tx => renderTransactionRow(tx)).join('')}
                            </tbody>
                        </table>
                    </div>

                    <!-- Pagination -->
                    <div class="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
                        <p class="text-sm text-gray-500">Showing ${transactions.length} transactions</p>
                        <div class="flex items-center gap-2">
                            <button class="btn btn-secondary btn-sm demo-placeholder" data-feature="Pagination">
                                <i data-lucide="chevron-left" class="w-4 h-4"></i>
                                Previous
                            </button>
                            <button class="btn btn-secondary btn-sm demo-placeholder" data-feature="Pagination">
                                Next
                                <i data-lucide="chevron-right" class="w-4 h-4"></i>
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Details Tab -->
                <div class="tab-content p-6" id="tab-details">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <h3 class="text-lg font-semibold text-gray-900 mb-4">Account Information</h3>
                            <dl class="space-y-3">
                                <div class="flex justify-between">
                                    <dt class="text-gray-500">Account Type</dt>
                                    <dd class="font-medium text-gray-900">${typeInfo.label}</dd>
                                </div>
                                <div class="flex justify-between">
                                    <dt class="text-gray-500">Account Number</dt>
                                    <dd class="font-medium text-gray-900">${account.account_number || account.accountNumber}</dd>
                                </div>
                                <div class="flex justify-between">
                                    <dt class="text-gray-500">Status</dt>
                                    <dd><span class="badge badge-operator">${account.status}</span></dd>
                                </div>
                                <div class="flex justify-between">
                                    <dt class="text-gray-500">Currency</dt>
                                    <dd class="font-medium text-gray-900">${account.currency}</dd>
                                </div>
                                <div class="flex justify-between">
                                    <dt class="text-gray-500">Interest Rate</dt>
                                    <dd class="font-medium text-gray-900">${account.type === 'SAVINGS' ? '2.50% APY' : 'N/A'}</dd>
                                </div>
                            </dl>
                        </div>
                        <div>
                            <h3 class="text-lg font-semibold text-gray-900 mb-4">Linked Services</h3>
                            <div class="space-y-3">
                                <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                    <div class="flex items-center gap-3">
                                        <i data-lucide="credit-card" class="w-5 h-5 text-gray-600"></i>
                                        <span class="font-medium text-gray-900">Debit Card</span>
                                    </div>
                                    <span class="badge badge-operator">Active</span>
                                </div>
                                <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                    <div class="flex items-center gap-3">
                                        <i data-lucide="smartphone" class="w-5 h-5 text-gray-600"></i>
                                        <span class="font-medium text-gray-900">Mobile Banking</span>
                                    </div>
                                    <span class="badge badge-operator">Enabled</span>
                                </div>
                                <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                    <div class="flex items-center gap-3">
                                        <i data-lucide="bell" class="w-5 h-5 text-gray-600"></i>
                                        <span class="font-medium text-gray-900">Alerts</span>
                                    </div>
                                    <span class="badge badge-operator">On</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Statements Tab -->
                <div class="tab-content p-6" id="tab-statements">
                    <h3 class="text-lg font-semibold text-gray-900 mb-4">Monthly Statements</h3>
                    <div class="space-y-2">
                        ${renderStatementsList()}
                    </div>
                </div>
            </div>
        </main>
    `;

    if (window.lucide) lucide.createIcons();
    header.init();

    // Tab switching
    document.querySelectorAll('.tab-trigger').forEach(trigger => {
        trigger.addEventListener('click', () => {
            const tabId = trigger.dataset.tab;

            // Update triggers
            document.querySelectorAll('.tab-trigger').forEach(t => t.classList.remove('active'));
            trigger.classList.add('active');

            // Update content
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            document.getElementById(`tab-${tabId}`).classList.add('active');
        });
    });

    // Demo placeholder buttons - show toast for unimplemented features
    document.querySelectorAll('.demo-placeholder').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const feature = btn.dataset.feature || 'This feature';
            showToast(`${feature} - not included in the identity demo!`, 'info');
        });
    });
}

/**
 * Render account card for list view
 */
function renderAccountCard(account, colorClass) {
    const typeInfo = getAccountTypeInfo(account.type);

    return `
        <div class="card account-card p-5 cursor-pointer" data-account-id="${account.id}">
            <div class="flex items-center gap-4 mb-4">
                <div class="w-12 h-12 rounded-xl bg-${colorClass}-100 flex items-center justify-center">
                    <i data-lucide="${typeInfo.icon}" class="w-6 h-6 text-${colorClass}-600"></i>
                </div>
                <div class="flex-1 min-w-0">
                    <h3 class="font-semibold text-gray-900 truncate">${escapeHtml(account.name)}</h3>
                    <p class="text-sm text-gray-500">${account.account_number || account.accountNumber}</p>
                </div>
            </div>
            <div class="flex items-end justify-between">
                <span class="badge badge-${colorClass === 'purple' ? 'commercial' : 'consumer'}">${typeInfo.label}</span>
                <p class="text-xl font-bold text-gray-900 balance-amount">${formatCurrency(account.balance)}</p>
            </div>
        </div>
    `;
}

/**
 * Render transaction row
 */
function renderTransactionRow(tx) {
    const isCredit = tx.amount > 0;

    return `
        <tr>
            <td class="whitespace-nowrap">
                <p class="font-medium text-gray-900">${formatDate(tx.date)}</p>
                <p class="text-xs text-gray-500">${formatRelativeTime(tx.date)}</p>
            </td>
            <td>
                <div class="flex items-center gap-2">
                    <div class="w-8 h-8 rounded-full ${isCredit ? 'bg-green-100' : 'bg-gray-100'} flex items-center justify-center">
                        <i data-lucide="${isCredit ? 'arrow-down-left' : 'arrow-up-right'}" class="w-4 h-4 ${isCredit ? 'text-green-600' : 'text-gray-600'}"></i>
                    </div>
                    <span class="font-medium text-gray-900">${escapeHtml(tx.description)}</span>
                </div>
            </td>
            <td>
                <span class="text-gray-500">${escapeHtml(tx.category)}</span>
            </td>
            <td class="text-right">
                <span class="font-medium ${isCredit ? 'text-green-600' : 'text-gray-900'}">
                    ${isCredit ? '+' : ''}${formatCurrency(tx.amount)}
                </span>
            </td>
            <td class="text-right">
                <span class="text-gray-500 balance-amount">${formatCurrency(tx.balance)}</span>
            </td>
        </tr>
    `;
}

/**
 * Render statements list
 */
function renderStatementsList() {
    const statements = [];
    const now = new Date();

    for (let i = 0; i < 6; i++) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        statements.push({
            month: date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
            date: date
        });
    }

    return statements.map(stmt => `
        <div class="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                    <i data-lucide="file-text" class="w-5 h-5 text-gray-600"></i>
                </div>
                <div>
                    <p class="font-medium text-gray-900">${stmt.month}</p>
                    <p class="text-sm text-gray-500">PDF Statement</p>
                </div>
            </div>
            <button class="btn btn-ghost btn-sm demo-placeholder" data-feature="Statement Download">
                <i data-lucide="download" class="w-4 h-4"></i>
                Download
            </button>
        </div>
    `).join('');
}

export default { renderList, renderDetails };
