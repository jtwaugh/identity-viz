/**
 * Transfers Component
 * Multi-step transfer form
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
    showModal,
    formatCurrency,
    formatDate,
    getTenantTypeInfo,
    getAccountTypeInfo,
    escapeHtml
} from '../ui.js';

let currentStep = 1;
let transferData = {
    fromAccount: null,
    toType: 'internal', // 'internal', 'external', 'beneficiary'
    toAccount: null,
    externalRouting: '',
    externalAccount: '',
    amount: '',
    memo: '',
    frequency: 'once',
    scheduleDate: ''
};

/**
 * Render transfer form
 */
export async function render() {
    const app = document.getElementById('app');
    const currentTenant = state.get('currentTenant');

    // Fetch accounts if not already loaded in state
    let accounts = state.get('accounts') || [];
    if (accounts.length === 0) {
        try {
            const response = await api.getAccounts();
            accounts = response.accounts || [];
            state.set('accounts', accounts);
        } catch (error) {
            console.warn('Failed to fetch accounts for transfers:', error);
        }
    }

    // Reset state
    currentStep = 1;
    transferData = {
        fromAccount: accounts[0]?.id || null,
        toType: 'internal',
        toAccount: accounts[1]?.id || null,
        externalRouting: '',
        externalAccount: '',
        amount: '',
        memo: '',
        frequency: 'once',
        scheduleDate: ''
    };

    const colorClass = currentTenant.type === 'COMMERCIAL' ? 'purple' : 'blue';

    app.innerHTML = `
        ${header.render()}
        <main class="max-w-3xl mx-auto px-4 py-6">
            <!-- Breadcrumb -->
            <nav class="flex items-center gap-2 text-sm mb-6">
                <a href="#/dashboard" class="text-gray-500 hover:text-gray-700">Dashboard</a>
                <i data-lucide="chevron-right" class="w-4 h-4 text-gray-400"></i>
                <a href="#/transfers" class="text-gray-500 hover:text-gray-700">Transfers</a>
                <i data-lucide="chevron-right" class="w-4 h-4 text-gray-400"></i>
                <span class="text-gray-900 font-medium">New Transfer</span>
            </nav>

            <!-- Step Indicator -->
            <div class="steps mb-8">
                ${renderStepIndicator(currentStep)}
            </div>

            <!-- Form Card -->
            <div class="card">
                <div id="transfer-content">
                    ${renderStep1(accounts, colorClass)}
                </div>
            </div>
        </main>
    `;

    if (window.lucide) lucide.createIcons();
    header.init();
    attachStepHandlers();
}

/**
 * Render step indicator
 */
function renderStepIndicator(step) {
    const steps = [
        { num: 1, label: 'Details' },
        { num: 2, label: 'Review' },
        { num: 3, label: 'Confirm' }
    ];

    return steps.map((s, i) => `
        <div class="step">
            <div class="step-number ${s.num < step ? 'completed' : s.num === step ? 'active' : 'pending'}">
                ${s.num < step ? '<i data-lucide="check" class="w-4 h-4"></i>' : s.num}
            </div>
            <span class="text-sm ${s.num === step ? 'text-gray-900 font-medium' : 'text-gray-500'}">${s.label}</span>
        </div>
        ${i < steps.length - 1 ? `<div class="step-line ${s.num < step ? 'completed' : ''}"></div>` : ''}
    `).join('');
}

/**
 * Render Step 1 - Transfer Details
 */
function renderStep1(accounts, colorClass) {
    return `
        <div class="p-6">
            <h2 class="text-xl font-semibold text-gray-900 mb-6">Transfer Details</h2>

            <div class="space-y-6">
                <!-- From Account -->
                <div>
                    <label class="label">From Account</label>
                    <select id="from-account" class="select">
                        ${accounts.map(acc => `
                            <option value="${acc.id}" ${transferData.fromAccount === acc.id ? 'selected' : ''}>
                                ${escapeHtml(acc.name)} (${acc.account_number || acc.accountNumber}) - ${formatCurrency(acc.balance)}
                            </option>
                        `).join('')}
                    </select>
                </div>

                <!-- To Account Type Toggle -->
                <div>
                    <label class="label">Transfer To</label>
                    <div class="grid grid-cols-3 gap-2">
                        <button class="btn ${transferData.toType === 'internal' ? 'btn-primary' : 'btn-secondary'} to-type-btn" data-type="internal">
                            <i data-lucide="refresh-cw" class="w-4 h-4"></i>
                            Internal
                        </button>
                        <button class="btn ${transferData.toType === 'external' ? 'btn-primary' : 'btn-secondary'} to-type-btn" data-type="external">
                            <i data-lucide="send" class="w-4 h-4"></i>
                            External
                        </button>
                        <button class="btn ${transferData.toType === 'beneficiary' ? 'btn-primary' : 'btn-secondary'} to-type-btn" data-type="beneficiary">
                            <i data-lucide="bookmark" class="w-4 h-4"></i>
                            Saved
                        </button>
                    </div>
                </div>

                <!-- To Account (Internal) -->
                <div id="internal-fields" class="${transferData.toType === 'internal' ? '' : 'hidden'}">
                    <label class="label">To Account</label>
                    <select id="to-account" class="select">
                        ${accounts.filter(acc => acc.id !== transferData.fromAccount).map(acc => `
                            <option value="${acc.id}" ${transferData.toAccount === acc.id ? 'selected' : ''}>
                                ${escapeHtml(acc.name)} (${acc.account_number || acc.accountNumber})
                            </option>
                        `).join('')}
                    </select>
                </div>

                <!-- External Account Fields -->
                <div id="external-fields" class="${transferData.toType === 'external' ? '' : 'hidden'} space-y-4">
                    <div>
                        <label class="label">Routing Number</label>
                        <input type="text" id="routing-number" class="input" placeholder="9 digit routing number" maxlength="9" value="${transferData.externalRouting}">
                    </div>
                    <div>
                        <label class="label">Account Number</label>
                        <input type="text" id="external-account-number" class="input" placeholder="Account number" value="${transferData.externalAccount}">
                    </div>
                </div>

                <!-- Beneficiary (Saved Recipients) -->
                <div id="beneficiary-fields" class="${transferData.toType === 'beneficiary' ? '' : 'hidden'}">
                    <label class="label">Saved Recipient</label>
                    <select id="beneficiary" class="select">
                        <option value="">Select a saved recipient</option>
                        <option value="ben-001">John's Savings - Bank of America ****4521</option>
                        <option value="ben-002">Mom - Chase ****7890</option>
                    </select>
                </div>

                <!-- Amount -->
                <div>
                    <label class="label">Amount</label>
                    <div class="relative">
                        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                        <input type="text" id="amount" class="input pl-7" placeholder="0.00" value="${transferData.amount}">
                    </div>
                </div>

                <!-- Frequency -->
                <div>
                    <label class="label">Frequency</label>
                    <div class="grid grid-cols-2 gap-2">
                        <button class="btn ${transferData.frequency === 'once' ? 'btn-primary' : 'btn-secondary'} freq-btn" data-freq="once">
                            One-time
                        </button>
                        <button class="btn ${transferData.frequency === 'recurring' ? 'btn-primary' : 'btn-secondary'} freq-btn" data-freq="recurring">
                            Recurring
                        </button>
                    </div>
                </div>

                <!-- Schedule Date (for recurring) -->
                <div id="schedule-fields" class="${transferData.frequency === 'recurring' ? '' : 'hidden'}">
                    <label class="label">Schedule Date</label>
                    <input type="date" id="schedule-date" class="input" value="${transferData.scheduleDate}">
                </div>

                <!-- Memo -->
                <div>
                    <label class="label">Memo (Optional)</label>
                    <input type="text" id="memo" class="input" placeholder="Add a note" value="${transferData.memo}">
                </div>
            </div>
        </div>

        <!-- Footer -->
        <div class="px-6 py-4 border-t border-gray-200 flex justify-end">
            <button id="continue-btn" class="btn btn-primary bg-${colorClass}-600 hover:bg-${colorClass}-700">
                Continue
                <i data-lucide="arrow-right" class="w-4 h-4"></i>
            </button>
        </div>
    `;
}

/**
 * Render Step 2 - Review
 */
function renderStep2(accounts, colorClass) {
    const fromAccount = accounts.find(a => a.id === transferData.fromAccount);
    const toAccount = accounts.find(a => a.id === transferData.toAccount);
    const amount = parseFloat(transferData.amount) || 0;

    let toDisplay = '';
    if (transferData.toType === 'internal' && toAccount) {
        toDisplay = `${toAccount.name} (${toAccount.account_number || toAccount.accountNumber})`;
    } else if (transferData.toType === 'external') {
        toDisplay = `External Account ****${transferData.externalAccount.slice(-4)}`;
    } else {
        toDisplay = 'Saved Recipient';
    }

    return `
        <div class="p-6">
            <h2 class="text-xl font-semibold text-gray-900 mb-6">Review Transfer</h2>

            <div class="space-y-4">
                <div class="card p-4 bg-gray-50">
                    <div class="flex items-center justify-between py-2">
                        <span class="text-gray-500">From</span>
                        <span class="font-medium text-gray-900">${escapeHtml(fromAccount?.name)} (${fromAccount?.account_number || fromAccount?.accountNumber})</span>
                    </div>
                    <div class="flex items-center justify-between py-2 border-t border-gray-200">
                        <span class="text-gray-500">To</span>
                        <span class="font-medium text-gray-900">${escapeHtml(toDisplay)}</span>
                    </div>
                    <div class="flex items-center justify-between py-2 border-t border-gray-200">
                        <span class="text-gray-500">Amount</span>
                        <span class="text-xl font-bold text-gray-900">${formatCurrency(amount)}</span>
                    </div>
                    ${transferData.memo ? `
                        <div class="flex items-center justify-between py-2 border-t border-gray-200">
                            <span class="text-gray-500">Memo</span>
                            <span class="text-gray-900">${escapeHtml(transferData.memo)}</span>
                        </div>
                    ` : ''}
                    <div class="flex items-center justify-between py-2 border-t border-gray-200">
                        <span class="text-gray-500">Frequency</span>
                        <span class="text-gray-900">${transferData.frequency === 'once' ? 'One-time' : 'Recurring'}</span>
                    </div>
                </div>

                <!-- Fee disclosure -->
                <div class="alert alert-info">
                    <i data-lucide="info" class="w-5 h-5 flex-shrink-0"></i>
                    <div>
                        <p class="font-medium">No fees for this transfer</p>
                        <p class="text-sm opacity-80">Internal transfers between your AnyBank accounts are always free.</p>
                    </div>
                </div>
            </div>
        </div>

        <!-- Footer -->
        <div class="px-6 py-4 border-t border-gray-200 flex justify-between">
            <button id="back-btn" class="btn btn-secondary">
                <i data-lucide="arrow-left" class="w-4 h-4"></i>
                Back
            </button>
            <button id="confirm-btn" class="btn btn-primary bg-${colorClass}-600 hover:bg-${colorClass}-700">
                <i data-lucide="check" class="w-4 h-4"></i>
                Confirm Transfer
            </button>
        </div>
    `;
}

/**
 * Render Step 3 - Confirmation
 */
function renderStep3(success, colorClass, error = null) {
    const confirmationNumber = 'TRF' + Math.random().toString(36).substring(2, 10).toUpperCase();

    if (success) {
        return `
            <div class="p-8 text-center">
                <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
                    <i data-lucide="check-circle" class="w-8 h-8 text-green-600"></i>
                </div>
                <h2 class="text-2xl font-bold text-gray-900 mb-2">Transfer Complete!</h2>
                <p class="text-gray-500 mb-6">Your transfer has been successfully processed.</p>

                <div class="card p-4 bg-gray-50 mb-6 text-left">
                    <div class="flex justify-between py-2">
                        <span class="text-gray-500">Confirmation Number</span>
                        <span class="font-mono font-medium text-gray-900">${confirmationNumber}</span>
                    </div>
                    <div class="flex justify-between py-2 border-t border-gray-200">
                        <span class="text-gray-500">Amount</span>
                        <span class="font-bold text-gray-900">${formatCurrency(parseFloat(transferData.amount))}</span>
                    </div>
                    <div class="flex justify-between py-2 border-t border-gray-200">
                        <span class="text-gray-500">Date</span>
                        <span class="text-gray-900">${formatDate(new Date())}</span>
                    </div>
                </div>

                <div class="flex gap-3 justify-center">
                    <button id="new-transfer-btn" class="btn btn-secondary">
                        <i data-lucide="plus" class="w-4 h-4"></i>
                        Make Another Transfer
                    </button>
                    <a href="#/dashboard" class="btn btn-primary bg-${colorClass}-600 hover:bg-${colorClass}-700">
                        Back to Dashboard
                    </a>
                </div>
            </div>
        `;
    } else {
        return `
            <div class="p-8 text-center">
                <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
                    <i data-lucide="x-circle" class="w-8 h-8 text-red-600"></i>
                </div>
                <h2 class="text-2xl font-bold text-gray-900 mb-2">Transfer Failed</h2>
                <p class="text-gray-500 mb-6">${escapeHtml(error || 'We could not process your transfer at this time.')}</p>

                <div class="alert alert-error mb-6 text-left">
                    <i data-lucide="alert-circle" class="w-5 h-5 flex-shrink-0"></i>
                    <div>
                        <p class="font-medium">Access Denied: High Risk Score</p>
                        <p class="text-sm opacity-80">This transaction was blocked due to elevated risk factors. Please contact customer support if you believe this is an error.</p>
                    </div>
                </div>

                <div class="flex gap-3 justify-center">
                    <button id="retry-btn" class="btn btn-secondary">
                        <i data-lucide="refresh-cw" class="w-4 h-4"></i>
                        Try Again
                    </button>
                    <a href="#/dashboard" class="btn btn-primary">
                        Back to Dashboard
                    </a>
                </div>
            </div>
        `;
    }
}

/**
 * Attach event handlers for current step
 */
function attachStepHandlers() {
    const accounts = state.get('accounts') || [];
    const currentTenant = state.get('currentTenant');
    const colorClass = currentTenant.type === 'COMMERCIAL' ? 'purple' : 'blue';

    // Step 1 handlers
    if (currentStep === 1) {
        // To type toggle
        document.querySelectorAll('.to-type-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const type = btn.dataset.type;
                transferData.toType = type;

                // Update button states
                document.querySelectorAll('.to-type-btn').forEach(b => {
                    b.classList.remove('btn-primary');
                    b.classList.add('btn-secondary');
                });
                btn.classList.remove('btn-secondary');
                btn.classList.add('btn-primary');

                // Toggle field visibility
                document.getElementById('internal-fields').classList.toggle('hidden', type !== 'internal');
                document.getElementById('external-fields').classList.toggle('hidden', type !== 'external');
                document.getElementById('beneficiary-fields').classList.toggle('hidden', type !== 'beneficiary');
            });
        });

        // Frequency toggle
        document.querySelectorAll('.freq-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const freq = btn.dataset.freq;
                transferData.frequency = freq;

                document.querySelectorAll('.freq-btn').forEach(b => {
                    b.classList.remove('btn-primary');
                    b.classList.add('btn-secondary');
                });
                btn.classList.remove('btn-secondary');
                btn.classList.add('btn-primary');

                document.getElementById('schedule-fields').classList.toggle('hidden', freq !== 'recurring');
            });
        });

        // Continue button
        document.getElementById('continue-btn').addEventListener('click', () => {
            // Gather form data
            transferData.fromAccount = document.getElementById('from-account').value;
            transferData.amount = document.getElementById('amount').value;
            transferData.memo = document.getElementById('memo').value;

            if (transferData.toType === 'internal') {
                transferData.toAccount = document.getElementById('to-account').value;
            } else if (transferData.toType === 'external') {
                transferData.externalRouting = document.getElementById('routing-number').value;
                transferData.externalAccount = document.getElementById('external-account-number').value;
            }

            // Validate
            if (!transferData.amount || parseFloat(transferData.amount) <= 0) {
                showToast('Please enter a valid amount', 'error');
                return;
            }

            // Go to step 2
            currentStep = 2;
            renderCurrentStep(accounts, colorClass);
        });
    }

    // Step 2 handlers
    if (currentStep === 2) {
        document.getElementById('back-btn').addEventListener('click', () => {
            currentStep = 1;
            renderCurrentStep(accounts, colorClass);
        });

        document.getElementById('confirm-btn').addEventListener('click', async () => {
            await processTransfer(accounts, colorClass);
        });
    }

    // Step 3 handlers
    if (currentStep === 3) {
        const newTransferBtn = document.getElementById('new-transfer-btn');
        if (newTransferBtn) {
            newTransferBtn.addEventListener('click', () => {
                render(); // Reset and start over
            });
        }

        const retryBtn = document.getElementById('retry-btn');
        if (retryBtn) {
            retryBtn.addEventListener('click', () => {
                currentStep = 1;
                renderCurrentStep(accounts, colorClass);
            });
        }
    }
}

/**
 * Re-render current step
 */
function renderCurrentStep(accounts, colorClass) {
    const content = document.getElementById('transfer-content');

    // Update step indicator
    const stepsContainer = document.querySelector('.steps');
    if (stepsContainer) {
        stepsContainer.innerHTML = renderStepIndicator(currentStep);
    }

    // Render step content
    if (currentStep === 1) {
        content.innerHTML = renderStep1(accounts, colorClass);
    } else if (currentStep === 2) {
        content.innerHTML = renderStep2(accounts, colorClass);
    }

    if (window.lucide) lucide.createIcons();
    attachStepHandlers();
}

/**
 * Process the transfer
 */
async function processTransfer(accounts, colorClass) {
    const content = document.getElementById('transfer-content');
    const amount = parseFloat(transferData.amount);

    // Show loading
    content.innerHTML = `
        <div class="p-8 text-center">
            <div class="w-12 h-12 border-4 border-${colorClass}-600 border-t-transparent rounded-full spinner mx-auto mb-4"></div>
            <h2 class="text-xl font-semibold text-gray-900">Processing Transfer...</h2>
            <p class="text-gray-500 mt-2">Please wait while we process your transfer</p>
        </div>
    `;

    try {
        // Try API call
        await api.createTransfer(transferData.fromAccount, {
            to_account_id: transferData.toAccount,
            to_type: transferData.toType,
            external_routing: transferData.externalRouting,
            external_account: transferData.externalAccount,
            amount: amount,
            memo: transferData.memo,
            frequency: transferData.frequency
        });

        // Success
        currentStep = 3;
        content.innerHTML = renderStep3(true, colorClass);
        if (window.lucide) lucide.createIcons();
        attachStepHandlers();
    } catch (error) {
        console.warn('Transfer failed:', error);

        // For demo: simulate risk-based denial for large amounts
        if (amount >= 50000) {
            currentStep = 3;
            content.innerHTML = renderStep3(false, colorClass, 'High Risk Score (90)');
        } else {
            // Success for demo
            currentStep = 3;
            content.innerHTML = renderStep3(true, colorClass);
        }

        if (window.lucide) lucide.createIcons();
        attachStepHandlers();
    }
}

export default { render };
