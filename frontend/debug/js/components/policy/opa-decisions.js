/**
 * OPA Decisions Component
 * Displays policy decisions from Open Policy Agent
 */

import debugApi from '../../api.js';
import debugState from '../../state.js';

let decisions = [];
let sortColumn = 'timestamp';
let sortDirection = 'desc';
let decisionFilter = 'all';
let actionFilter = 'all';

function formatDate(timestamp) {
    if (!timestamp) return '-';
    return new Date(timestamp).toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        fractionalSecondDigits: 3
    });
}

function render() {
    decisions = debugState.get('policy.decisions') || [];

    return `
        <div class="space-y-4">
            <div class="flex items-center justify-between">
                <h2 class="text-lg font-semibold text-slate-100">OPA Decisions</h2>
                <div class="flex items-center gap-3">
                    <select id="decision-filter" class="debug-select">
                        <option value="all">All Decisions</option>
                        <option value="allow">Allowed</option>
                        <option value="deny">Denied</option>
                    </select>
                    <select id="action-filter" class="debug-select">
                        <option value="all">All Actions</option>
                        <option value="view_balance">View Balance</option>
                        <option value="view_transactions">View Transactions</option>
                        <option value="internal_transfer">Internal Transfer</option>
                        <option value="external_transfer">External Transfer</option>
                        <option value="wire_transfer">Wire Transfer</option>
                        <option value="manage_users">Manage Users</option>
                    </select>
                    <button id="clear-decisions" class="debug-btn debug-btn-secondary">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                        Clear
                    </button>
                </div>
            </div>

            <!-- Summary Cards -->
            <div class="grid grid-cols-4 gap-4" id="decisions-summary">
                ${renderSummaryCards()}
            </div>

            <div class="debug-card">
                <div class="overflow-x-auto max-h-[500px]">
                    <table class="debug-table">
                        <thead>
                            <tr>
                                <th class="cursor-pointer hover:bg-slate-700/50" data-sort="timestamp">Timestamp</th>
                                <th>Action</th>
                                <th>User</th>
                                <th>Tenant</th>
                                <th class="text-center">Risk Score</th>
                                <th class="text-center">Decision</th>
                                <th class="text-right">Duration</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="decisions-tbody">
                            ${renderTableBody()}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
}

function renderSummaryCards() {
    const total = decisions.length;
    const allowed = decisions.filter(d => d.allowed).length;
    const denied = decisions.filter(d => !d.allowed).length;
    const avgDuration = total > 0
        ? Math.round(decisions.reduce((sum, d) => sum + (d.duration || 0), 0) / total)
        : 0;

    return `
        <div class="debug-card">
            <div class="p-4">
                <div class="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Decisions</div>
                <div class="text-2xl font-semibold text-slate-100 mt-1">${total}</div>
            </div>
        </div>
        <div class="debug-card">
            <div class="p-4">
                <div class="text-xs font-medium text-slate-400 uppercase tracking-wider">Allowed</div>
                <div class="text-2xl font-semibold text-green-400 mt-1">${allowed}</div>
            </div>
        </div>
        <div class="debug-card">
            <div class="p-4">
                <div class="text-xs font-medium text-slate-400 uppercase tracking-wider">Denied</div>
                <div class="text-2xl font-semibold ${denied > 0 ? 'text-red-400' : 'text-slate-400'} mt-1">${denied}</div>
            </div>
        </div>
        <div class="debug-card">
            <div class="p-4">
                <div class="text-xs font-medium text-slate-400 uppercase tracking-wider">Avg Duration</div>
                <div class="text-2xl font-semibold ${avgDuration > 100 ? 'text-amber-400' : 'text-slate-100'} mt-1">${avgDuration}ms</div>
            </div>
        </div>
    `;
}

function renderTableBody() {
    const filtered = filterAndSortDecisions();

    if (filtered.length === 0) {
        return `
            <tr>
                <td colspan="8" class="text-center text-slate-500 py-8">
                    No OPA decisions captured
                </td>
            </tr>
        `;
    }

    return filtered.map((decision, index) => `
        <tr class="clickable" data-decision-index="${index}">
            <td class="text-slate-400 text-xs font-mono">
                ${formatDate(decision.timestamp)}
            </td>
            <td>
                <span class="px-2 py-0.5 text-xs rounded bg-purple-500/20 text-purple-400 border border-purple-500/30">
                    ${decision.action || 'unknown'}
                </span>
            </td>
            <td class="text-sm text-slate-300">
                ${decision.user?.email || decision.userId?.substring(0, 12) || '-'}
            </td>
            <td class="text-sm text-slate-400">
                ${decision.tenant?.name || decision.tenantId?.substring(0, 8) || '-'}
            </td>
            <td class="text-center">
                <span class="px-2 py-0.5 text-xs rounded font-mono ${getRiskScoreClass(decision.riskScore)}">
                    ${decision.riskScore ?? '-'}
                </span>
            </td>
            <td class="text-center">
                ${decision.allowed
                    ? '<span class="px-2 py-0.5 text-xs rounded decision-allow">&#10004; Allow</span>'
                    : '<span class="px-2 py-0.5 text-xs rounded decision-deny">&#10006; Deny</span>'
                }
            </td>
            <td class="text-right font-mono text-sm ${decision.duration > 100 ? 'text-amber-400' : 'text-slate-400'}">
                ${decision.duration ? `${decision.duration}ms` : '-'}
            </td>
            <td>
                <button class="debug-btn debug-btn-secondary text-xs py-1 px-2 view-decision" data-decision-index="${index}">
                    View
                </button>
            </td>
        </tr>
    `).join('');
}

function getRiskScoreClass(score) {
    if (score === null || score === undefined) return 'bg-slate-700 text-slate-400';
    if (score < 30) return 'bg-green-500/20 text-green-400';
    if (score < 50) return 'bg-amber-500/20 text-amber-400';
    return 'bg-red-500/20 text-red-400';
}

function filterAndSortDecisions() {
    let filtered = [...decisions];

    if (decisionFilter !== 'all') {
        filtered = filtered.filter(d =>
            decisionFilter === 'allow' ? d.allowed : !d.allowed
        );
    }

    if (actionFilter !== 'all') {
        filtered = filtered.filter(d => d.action === actionFilter);
    }

    filtered.sort((a, b) => {
        let aVal = a[sortColumn] || '';
        let bVal = b[sortColumn] || '';

        if (sortColumn === 'timestamp') {
            aVal = new Date(aVal).getTime();
            bVal = new Date(bVal).getTime();
        }

        return sortDirection === 'asc' ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1);
    });

    return filtered;
}

function updateView() {
    decisions = debugState.get('policy.decisions') || [];

    const tbody = document.getElementById('decisions-tbody');
    if (tbody) {
        tbody.innerHTML = renderTableBody();
    }

    const summary = document.getElementById('decisions-summary');
    if (summary) {
        summary.innerHTML = renderSummaryCards();
    }
}

function showDecisionDetails(decisionIndex) {
    const decision = decisions[decisionIndex];
    if (!decision) return;

    const html = `
        <div class="space-y-6">
            <!-- Decision Result -->
            <div class="p-4 rounded ${decision.allowed ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'}">
                <div class="flex items-center gap-3">
                    <span class="text-2xl">${decision.allowed ? '&#10004;' : '&#10006;'}</span>
                    <div>
                        <div class="font-semibold ${decision.allowed ? 'text-green-400' : 'text-red-400'}">
                            ${decision.allowed ? 'Request Allowed' : 'Request Denied'}
                        </div>
                        ${!decision.allowed && decision.reason ? `
                            <div class="text-sm text-slate-400 mt-1">${decision.reason}</div>
                        ` : ''}
                    </div>
                </div>
            </div>

            <!-- Summary -->
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Action</h4>
                    <span class="px-2 py-0.5 text-xs rounded bg-purple-500/20 text-purple-400">${decision.action}</span>
                </div>
                <div>
                    <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Risk Score</h4>
                    <span class="px-2 py-0.5 text-xs rounded font-mono ${getRiskScoreClass(decision.riskScore)}">
                        ${decision.riskScore ?? '-'}
                    </span>
                </div>
                <div>
                    <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">User</h4>
                    <span class="text-sm text-slate-300">${decision.user?.email || decision.userId || '-'}</span>
                </div>
                <div>
                    <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Tenant</h4>
                    <span class="text-sm text-slate-300">${decision.tenant?.name || decision.tenantId || '-'}</span>
                </div>
                <div>
                    <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Duration</h4>
                    <span class="text-sm font-mono text-slate-300">${decision.duration || 0}ms</span>
                </div>
                <div>
                    <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Timestamp</h4>
                    <span class="text-sm text-slate-300">${new Date(decision.timestamp).toLocaleString()}</span>
                </div>
            </div>

            <!-- Input JSON -->
            <div>
                <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Policy Input</h4>
                <pre class="code-block bg-slate-900 p-3 rounded overflow-x-auto text-xs max-h-64"><code class="language-json">${JSON.stringify(decision.input || {}, null, 2)}</code></pre>
            </div>

            <!-- Evaluation Trace -->
            ${decision.trace ? `
            <div>
                <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Evaluation Trace</h4>
                <div class="bg-slate-900 rounded p-3 space-y-2">
                    ${renderEvaluationTrace(decision.trace)}
                </div>
            </div>
            ` : ''}

            <!-- Output JSON -->
            <div>
                <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Policy Output</h4>
                <pre class="code-block bg-slate-900 p-3 rounded overflow-x-auto text-xs max-h-64"><code class="language-json">${JSON.stringify(decision.output || { allow: decision.allowed }, null, 2)}</code></pre>
            </div>

            <!-- Actions -->
            <div class="flex gap-3">
                <button class="debug-btn debug-btn-secondary flex-1" id="copy-input-btn">
                    Copy Input
                </button>
                <button class="debug-btn debug-btn-secondary flex-1" id="copy-output-btn">
                    Copy Output
                </button>
            </div>
        </div>
    `;

    debugState.openSlideOver('Policy Decision Details', { html });

    setTimeout(() => {
        if (window.hljs) {
            document.querySelectorAll('#slide-over-content pre code').forEach(block => {
                window.hljs.highlightElement(block);
            });
        }

        document.getElementById('copy-input-btn')?.addEventListener('click', () => {
            navigator.clipboard.writeText(JSON.stringify(decision.input, null, 2));
        });

        document.getElementById('copy-output-btn')?.addEventListener('click', () => {
            navigator.clipboard.writeText(JSON.stringify(decision.output, null, 2));
        });
    }, 10);
}

function renderEvaluationTrace(trace) {
    if (!Array.isArray(trace)) return '<span class="text-slate-500">No trace available</span>';

    return trace.map(step => `
        <div class="flex items-start gap-2 text-xs">
            <span class="${step.result ? 'text-green-400' : 'text-red-400'}">
                ${step.result ? '&#10004;' : '&#10006;'}
            </span>
            <div>
                <span class="text-slate-300">${step.rule || step.name || 'rule'}</span>
                ${step.message ? `<span class="text-slate-500 ml-2">${step.message}</span>` : ''}
            </div>
        </div>
    `).join('');
}

function init() {
    // Subscribe to decision changes
    debugState.subscribe('policy.decisions', updateView);

    document.getElementById('decision-filter')?.addEventListener('change', (e) => {
        decisionFilter = e.target.value;
        updateView();
    });

    document.getElementById('action-filter')?.addEventListener('change', (e) => {
        actionFilter = e.target.value;
        updateView();
    });

    document.getElementById('clear-decisions')?.addEventListener('click', () => {
        debugState.set('policy.decisions', []);
    });

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
        const viewBtn = e.target.closest('.view-decision');
        const row = e.target.closest('[data-decision-index]');

        if (viewBtn) {
            showDecisionDetails(parseInt(viewBtn.getAttribute('data-decision-index')));
        } else if (row && !e.target.closest('button')) {
            showDecisionDetails(parseInt(row.getAttribute('data-decision-index')));
        }
    });

    if (window.lucide) window.lucide.createIcons();
}

export default { render, init };
