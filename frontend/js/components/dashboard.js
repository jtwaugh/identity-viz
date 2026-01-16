/**
 * Dashboard Component
 * Main dashboard with Consumer and Commercial variants
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
    getGreeting,
    getTenantTypeInfo,
    getRoleInfo,
    getAccountTypeInfo,
    maskAccountNumber,
    escapeHtml
} from '../ui.js';

// Mock account data for demo
const MOCK_ACCOUNTS = {
    'tenant-001': [
        { id: 'acc-001', account_number: '****1234', name: 'Personal Checking', type: 'CHECKING', balance: 4521.33, currency: 'USD', status: 'ACTIVE' },
        { id: 'acc-002', account_number: '****5678', name: 'Savings', type: 'SAVINGS', balance: 12340.00, currency: 'USD', status: 'ACTIVE' }
    ],
    'tenant-002': [
        { id: 'acc-003', account_number: '****9012', name: 'Personal Checking', type: 'CHECKING', balance: 2847.65, currency: 'USD', status: 'ACTIVE' },
        { id: 'acc-004', account_number: '****3456', name: 'Savings', type: 'SAVINGS', balance: 8920.00, currency: 'USD', status: 'ACTIVE' }
    ],
    'tenant-003': [
        { id: 'acc-005', account_number: '****4521', name: 'Business Operating', type: 'CHECKING', balance: 5400000.00, currency: 'USD', status: 'ACTIVE' },
        { id: 'acc-006', account_number: '****7832', name: 'Payroll', type: 'CHECKING', balance: 234500.00, currency: 'USD', status: 'ACTIVE' },
        { id: 'acc-007', account_number: '****1199', name: 'Business Reserve', type: 'MONEY_MARKET', balance: 1250000.00, currency: 'USD', status: 'ACTIVE' }
    ]
};

// Mock team members for commercial dashboard
const MOCK_TEAM_MEMBERS = [
    { id: 'user-001', name: 'John Doe', email: 'jdoe@example.com', role: 'OWNER' },
    { id: 'user-004', name: 'Sarah Johnson', email: 'sjohnson@anybusiness.com', role: 'ADMIN' },
    { id: 'user-005', name: 'Mike Chen', email: 'mchen@anybusiness.com', role: 'OPERATOR' }
];

/**
 * Render the dashboard
 */
export async function render() {
    const app = document.getElementById('app');
    const user = state.get('user');
    const currentTenant = state.get('currentTenant');

    if (!user || !currentTenant) {
        router.navigate('/login', { replace: true });
        return;
    }

    // Start with loading state
    app.innerHTML = `
        ${header.render()}
        <main class="max-w-7xl mx-auto px-4 py-6">
            <div class="flex items-center justify-center py-12">
                <div class="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full spinner"></div>
            </div>
        </main>
    `;

    // Initialize header
    if (window.lucide) lucide.createIcons();
    header.init();

    // Fetch accounts
    let accounts = [];
    try {
        const response = await api.getAccounts();
        accounts = response.accounts || [];
    } catch (error) {
        // Handle 401 Unauthorized - log out the user
        if (error.status === 401) {
            console.error('[Dashboard] 401 Unauthorized when loading dashboard - logging out user');
            showToast('Your session has expired. Please sign in again.', 'warning');
            auth.logout();
            return;
        }
        console.warn('Failed to fetch accounts, using mock data:', error);
        accounts = MOCK_ACCOUNTS[currentTenant.id] || [];
    }

    // Store in state
    state.set('accounts', accounts);

    // Fetch team members for commercial dashboards
    let teamMembers = MOCK_TEAM_MEMBERS;
    const isCommercial = currentTenant.type === 'COMMERCIAL' || currentTenant.type === 'SMALL_BUSINESS';
    if (isCommercial && (currentTenant.role === 'ADMIN' || currentTenant.role === 'OWNER')) {
        try {
            teamMembers = await api.getUsers();
        } catch (error) {
            // Handle 401 Unauthorized - log out the user
            if (error.status === 401) {
                console.error('[Dashboard] 401 Unauthorized when fetching team members - logging out user');
                showToast('Your session has expired. Please sign in again.', 'warning');
                auth.logout();
                return;
            }
            console.warn('Failed to fetch team members, using mock data:', error);
        }
    }

    app.innerHTML = `
        ${header.render()}
        <main class="max-w-7xl mx-auto px-4 py-6">
            ${isCommercial ? renderCommercialDashboard(user, currentTenant, accounts, teamMembers) : renderConsumerDashboard(user, currentTenant, accounts)}
        </main>
    `;

    // Initialize
    if (window.lucide) lucide.createIcons();
    header.init();
    attachEventHandlers();
}

/**
 * Render Consumer Dashboard
 */
function renderConsumerDashboard(user, tenant, accounts) {
    const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);
    const firstName = user.name.split(' ')[0];

    return `
        <!-- Greeting -->
        <div class="mb-6">
            <h1 class="text-2xl font-bold text-gray-900">${getGreeting()}, ${escapeHtml(firstName)}</h1>
            <p class="text-gray-500">${formatDate(new Date(), { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <!-- Left Column: Accounts -->
            <div class="lg:col-span-2 space-y-6">
                <!-- Total Balance Card -->
                <div class="card p-6 bg-gradient-to-br from-blue-600 to-blue-700 text-white">
                    <p class="text-blue-100 text-sm font-medium">Total Balance</p>
                    <p class="text-3xl font-bold mt-1 balance-amount">${formatCurrency(totalBalance)}</p>
                    <p class="text-blue-200 text-sm mt-2">${accounts.length} account${accounts.length !== 1 ? 's' : ''}</p>
                </div>

                <!-- Account Cards -->
                <div>
                    <h2 class="text-lg font-semibold text-gray-900 mb-4">Your Accounts</h2>
                    <div class="space-y-3">
                        ${accounts.map(account => renderAccountCard(account)).join('')}
                    </div>
                </div>
            </div>

            <!-- Right Column: Quick Actions + Activity -->
            <div class="space-y-6">
                <!-- Quick Actions -->
                <div class="card p-6">
                    <h3 class="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
                    <div class="space-y-2">
                        <a href="#/transfers/new" class="btn btn-primary w-full justify-start">
                            <i data-lucide="send" class="w-5 h-5"></i>
                            Transfer Money
                        </a>
                        <button class="btn btn-secondary w-full justify-start demo-placeholder" data-feature="Pay Bills">
                            <i data-lucide="receipt" class="w-5 h-5"></i>
                            Pay Bills
                        </button>
                        <button class="btn btn-secondary w-full justify-start demo-placeholder" data-feature="Mobile Deposit">
                            <i data-lucide="camera" class="w-5 h-5"></i>
                            Mobile Deposit
                        </button>
                    </div>
                </div>

                <!-- Recent Activity -->
                <div class="card p-6">
                    <h3 class="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
                    <div class="space-y-4">
                        ${renderRecentActivity()}
                    </div>
                    <button class="btn btn-ghost w-full mt-4 demo-placeholder" data-feature="View All Transactions">
                        View All Transactions
                    </button>
                </div>
            </div>
        </div>
    `;
}

/**
 * Render Commercial Dashboard
 */
function renderCommercialDashboard(user, tenant, accounts, teamMembers = MOCK_TEAM_MEMBERS) {
    const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);
    const firstName = user.name.split(' ')[0];
    const roleInfo = getRoleInfo(tenant.role);

    return `
        <!-- Greeting -->
        <div class="mb-6">
            <h1 class="text-2xl font-bold text-gray-900">${getGreeting()}, ${escapeHtml(firstName)}</h1>
            <p class="text-gray-500">${formatDate(new Date(), { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <!-- Left Column: Accounts -->
            <div class="lg:col-span-2 space-y-6">
                <!-- Total Balance Card -->
                <div class="card p-6 bg-gradient-to-br from-purple-600 to-purple-700 text-white">
                    <div class="flex justify-between items-start">
                        <div>
                            <p class="text-purple-100 text-sm font-medium">Total Business Balance</p>
                            <p class="text-3xl font-bold mt-1 balance-amount">${formatCurrency(totalBalance)}</p>
                            <p class="text-purple-200 text-sm mt-2">${accounts.length} business account${accounts.length !== 1 ? 's' : ''}</p>
                        </div>
                        <div class="badge bg-white/20 text-white">
                            ${roleInfo.label}
                        </div>
                    </div>
                </div>

                <!-- Business Accounts -->
                <div>
                    <h2 class="text-lg font-semibold text-gray-900 mb-4">Business Accounts</h2>
                    <div class="space-y-3">
                        ${accounts.map(account => renderAccountCard(account, 'commercial')).join('')}
                    </div>
                </div>
            </div>

            <!-- Right Column -->
            <div class="space-y-6">
                <!-- Quick Actions (Commercial) -->
                <div class="card p-6">
                    <h3 class="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
                    <div class="space-y-2">
                        <a href="#/transfers/new" class="btn btn-primary w-full justify-start bg-purple-600 hover:bg-purple-700">
                            <i data-lucide="send" class="w-5 h-5"></i>
                            Wire Transfer
                        </a>
                        <button class="btn btn-secondary w-full justify-start demo-placeholder" data-feature="ACH Batch Payment">
                            <i data-lucide="file-text" class="w-5 h-5"></i>
                            ACH Batch Payment
                        </button>
                        <button class="btn btn-secondary w-full justify-start demo-placeholder" data-feature="Run Payroll">
                            <i data-lucide="users" class="w-5 h-5"></i>
                            Run Payroll
                        </button>
                    </div>
                </div>

                <!-- Authorized Users (Commercial-specific) -->
                <div class="card p-6">
                    <div class="flex items-center justify-between mb-4">
                        <h3 class="text-lg font-semibold text-gray-900">Authorized Users</h3>
                        ${(tenant.role === 'ADMIN' || tenant.role === 'OWNER') ? `
                            <a href="#/admin/users" class="text-sm text-purple-600 hover:underline">Manage</a>
                        ` : ''}
                    </div>
                    <div class="space-y-3">
                        ${teamMembers.map(member => renderTeamMember(member)).join('')}
                    </div>
                </div>

                <!-- Pending Approvals -->
                <div class="card p-6">
                    <h3 class="text-lg font-semibold text-gray-900 mb-4">Pending Approvals</h3>
                    <div class="text-center py-4">
                        <div class="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-2">
                            <i data-lucide="check-circle" class="w-6 h-6 text-green-600"></i>
                        </div>
                        <p class="text-sm text-gray-500">No pending approvals</p>
                    </div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Render an account card
 */
function renderAccountCard(account, variant = 'consumer') {
    const typeInfo = getAccountTypeInfo(account.type);
    const colorClass = variant === 'commercial' ? 'purple' : 'blue';

    return `
        <div class="card account-card p-4 cursor-pointer" data-account-id="${account.id}">
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-4">
                    <div class="w-10 h-10 rounded-lg bg-${colorClass}-100 flex items-center justify-center">
                        <i data-lucide="${typeInfo.icon}" class="w-5 h-5 text-${colorClass}-600"></i>
                    </div>
                    <div>
                        <h3 class="font-medium text-gray-900">${escapeHtml(account.name)}</h3>
                        <p class="text-sm text-gray-500">${account.account_number || account.accountNumber}</p>
                    </div>
                </div>
                <div class="text-right">
                    <p class="text-lg font-semibold text-gray-900 balance-amount">${formatCurrency(account.balance, account.currency)}</p>
                    <span class="badge badge-${variant === 'commercial' ? 'commercial' : 'consumer'}">${typeInfo.label}</span>
                </div>
            </div>
        </div>
    `;
}

/**
 * Render recent activity items
 */
function renderRecentActivity() {
    const activities = [
        { type: 'credit', description: 'Direct Deposit - Payroll', amount: 3250.00, date: new Date(Date.now() - 86400000) },
        { type: 'debit', description: 'Electric Company', amount: -145.32, date: new Date(Date.now() - 172800000) },
        { type: 'debit', description: 'Grocery Store', amount: -87.54, date: new Date(Date.now() - 259200000) },
        { type: 'credit', description: 'Refund - Online Purchase', amount: 29.99, date: new Date(Date.now() - 345600000) }
    ];

    return activities.map(activity => `
        <div class="flex items-center justify-between py-2">
            <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-full ${activity.type === 'credit' ? 'bg-green-100' : 'bg-gray-100'} flex items-center justify-center">
                    <i data-lucide="${activity.type === 'credit' ? 'arrow-down-left' : 'arrow-up-right'}" class="w-4 h-4 ${activity.type === 'credit' ? 'text-green-600' : 'text-gray-600'}"></i>
                </div>
                <div>
                    <p class="text-sm font-medium text-gray-900">${escapeHtml(activity.description)}</p>
                    <p class="text-xs text-gray-500">${formatDate(activity.date)}</p>
                </div>
            </div>
            <p class="text-sm font-medium ${activity.amount > 0 ? 'text-green-600' : 'text-gray-900'}">
                ${activity.amount > 0 ? '+' : ''}${formatCurrency(activity.amount)}
            </p>
        </div>
    `).join('');
}

/**
 * Render team member row
 */
function renderTeamMember(member) {
    const roleInfo = getRoleInfo(member.role);

    return `
        <div class="flex items-center justify-between py-2">
            <div class="flex items-center gap-3">
                <div class="avatar avatar-sm">
                    ${auth.getInitials(member.name)}
                </div>
                <div>
                    <p class="text-sm font-medium text-gray-900">${escapeHtml(member.name)}</p>
                    <p class="text-xs text-gray-500">${escapeHtml(member.email)}</p>
                </div>
            </div>
            <span class="badge badge-${roleInfo.color}">${roleInfo.label}</span>
        </div>
    `;
}

/**
 * Attach event handlers
 */
function attachEventHandlers() {
    // Account card clicks
    document.querySelectorAll('.account-card').forEach(card => {
        card.addEventListener('click', () => {
            const accountId = card.dataset.accountId;
            router.navigate(`/accounts/${accountId}`);
        });
    });

    // Demo placeholder buttons - show toast for unimplemented features
    document.querySelectorAll('.demo-placeholder').forEach(btn => {
        btn.addEventListener('click', () => {
            const feature = btn.dataset.feature || 'This feature';
            showToast(`${feature} - not included in the identity demo!`, 'info');
        });
    });
}

export default { render };
