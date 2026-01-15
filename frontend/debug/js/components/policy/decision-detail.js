/**
 * Decision Detail Component
 * Detailed view of a single OPA policy decision
 */

import debugState from '../../state.js';

function getRiskScoreClass(score) {
    if (score === null || score === undefined) return 'bg-slate-700 text-slate-400';
    if (score < 30) return 'bg-green-500/20 text-green-400';
    if (score < 50) return 'bg-amber-500/20 text-amber-400';
    return 'bg-red-500/20 text-red-400';
}

/**
 * Render decision detail view
 * @param {Object} decision - Decision object
 */
function render(decision) {
    if (!decision) {
        return `
            <div class="empty-state">
                <div class="empty-state-icon">&#128737;</div>
                <div class="empty-state-title">No Decision Selected</div>
                <div class="empty-state-description">Select a decision from the list to view details</div>
            </div>
        `;
    }

    return `
        <div class="space-y-6">
            <!-- Decision Result Banner -->
            <div class="p-4 rounded-lg ${decision.allowed ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'}">
                <div class="flex items-center gap-4">
                    <span class="text-3xl">${decision.allowed ? '&#10004;' : '&#10006;'}</span>
                    <div>
                        <div class="text-lg font-semibold ${decision.allowed ? 'text-green-400' : 'text-red-400'}">
                            ${decision.allowed ? 'Request Allowed' : 'Request Denied'}
                        </div>
                        ${!decision.allowed && decision.reason ? `
                            <div class="text-sm text-slate-400 mt-1">
                                <strong>Reason:</strong> ${decision.reason}
                            </div>
                        ` : ''}
                    </div>
                    <div class="ml-auto text-right">
                        <div class="text-xs text-slate-400">Decision Time</div>
                        <div class="text-sm font-mono text-slate-200">${decision.duration || 0}ms</div>
                    </div>
                </div>
            </div>

            <!-- Context Summary -->
            <div class="grid grid-cols-3 gap-4">
                <div class="debug-card">
                    <div class="p-4">
                        <div class="text-xs font-medium text-slate-400 uppercase tracking-wider">Action</div>
                        <div class="mt-2">
                            <span class="px-2 py-1 text-sm rounded bg-purple-500/20 text-purple-400 border border-purple-500/30">
                                ${decision.action || 'unknown'}
                            </span>
                        </div>
                    </div>
                </div>
                <div class="debug-card">
                    <div class="p-4">
                        <div class="text-xs font-medium text-slate-400 uppercase tracking-wider">Risk Score</div>
                        <div class="mt-2 flex items-center gap-2">
                            <span class="text-2xl font-bold ${getRiskScoreClass(decision.riskScore).split(' ')[1]}">
                                ${decision.riskScore ?? '-'}
                            </span>
                            <span class="text-xs text-slate-400">/ 100</span>
                        </div>
                    </div>
                </div>
                <div class="debug-card">
                    <div class="p-4">
                        <div class="text-xs font-medium text-slate-400 uppercase tracking-wider">Timestamp</div>
                        <div class="mt-2 text-sm text-slate-200">
                            ${new Date(decision.timestamp).toLocaleString()}
                        </div>
                    </div>
                </div>
            </div>

            <!-- User & Tenant Info -->
            <div class="debug-card">
                <div class="debug-card-header">
                    <span class="text-sm font-medium">Request Context</span>
                </div>
                <div class="debug-card-body">
                    <div class="grid grid-cols-2 gap-6">
                        <div>
                            <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">User</h4>
                            <div class="space-y-2 text-sm">
                                <div class="flex justify-between">
                                    <span class="text-slate-400">ID:</span>
                                    <code class="text-slate-300">${decision.user?.id || decision.userId || '-'}</code>
                                </div>
                                <div class="flex justify-between">
                                    <span class="text-slate-400">Email:</span>
                                    <span class="text-slate-300">${decision.user?.email || '-'}</span>
                                </div>
                            </div>
                        </div>
                        <div>
                            <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Tenant</h4>
                            <div class="space-y-2 text-sm">
                                <div class="flex justify-between">
                                    <span class="text-slate-400">ID:</span>
                                    <code class="text-slate-300">${decision.tenant?.id || decision.tenantId || '-'}</code>
                                </div>
                                <div class="flex justify-between">
                                    <span class="text-slate-400">Name:</span>
                                    <span class="text-slate-300">${decision.tenant?.name || '-'}</span>
                                </div>
                                <div class="flex justify-between">
                                    <span class="text-slate-400">Type:</span>
                                    <span class="text-slate-300">${decision.tenant?.type || '-'}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Policy Input -->
            <div class="debug-card">
                <div class="debug-card-header">
                    <span class="text-sm font-medium">Policy Input</span>
                    <button class="text-xs text-slate-400 hover:text-slate-200 copy-input-btn">Copy</button>
                </div>
                <div class="debug-card-body p-0">
                    <pre class="code-block m-0 rounded-none overflow-x-auto max-h-72"><code class="language-json">${JSON.stringify(decision.input || {}, null, 2)}</code></pre>
                </div>
            </div>

            <!-- Evaluation Trace -->
            ${decision.trace && decision.trace.length > 0 ? `
            <div class="debug-card">
                <div class="debug-card-header">
                    <span class="text-sm font-medium">Evaluation Trace</span>
                </div>
                <div class="debug-card-body">
                    ${renderEvaluationTrace(decision.trace)}
                </div>
            </div>
            ` : ''}

            <!-- Policy Output -->
            <div class="debug-card">
                <div class="debug-card-header">
                    <span class="text-sm font-medium">Policy Output</span>
                    <button class="text-xs text-slate-400 hover:text-slate-200 copy-output-btn">Copy</button>
                </div>
                <div class="debug-card-body p-0">
                    <pre class="code-block m-0 rounded-none overflow-x-auto max-h-48"><code class="language-json">${JSON.stringify(decision.output || { allow: decision.allowed }, null, 2)}</code></pre>
                </div>
            </div>
        </div>
    `;
}

function renderEvaluationTrace(trace) {
    if (!Array.isArray(trace) || trace.length === 0) {
        return '<span class="text-slate-500 text-sm">No evaluation trace available</span>';
    }

    return `
        <div class="space-y-2">
            ${trace.map((step, index) => `
                <div class="flex items-start gap-3 p-2 rounded ${step.result ? 'bg-green-500/5' : 'bg-red-500/5'}">
                    <span class="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs
                                ${step.result ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}">
                        ${step.result ? '&#10004;' : '&#10006;'}
                    </span>
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2">
                            <span class="text-sm font-medium ${step.result ? 'text-green-400' : 'text-red-400'}">
                                ${step.rule || step.name || `Rule ${index + 1}`}
                            </span>
                            ${step.duration ? `
                                <span class="text-xs text-slate-500">${step.duration}ms</span>
                            ` : ''}
                        </div>
                        ${step.message ? `
                            <div class="text-xs text-slate-400 mt-1">${step.message}</div>
                        ` : ''}
                        ${step.expression ? `
                            <code class="text-xs text-slate-500 block mt-1">${step.expression}</code>
                        ` : ''}
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function init(decision) {
    if (!decision) return;

    // Setup copy handlers
    document.querySelector('.copy-input-btn')?.addEventListener('click', () => {
        navigator.clipboard.writeText(JSON.stringify(decision.input, null, 2));
        showToast('Copied input');
    });

    document.querySelector('.copy-output-btn')?.addEventListener('click', () => {
        navigator.clipboard.writeText(JSON.stringify(decision.output, null, 2));
        showToast('Copied output');
    });

    // Highlight code
    if (window.hljs) {
        document.querySelectorAll('pre code').forEach(block => {
            window.hljs.highlightElement(block);
        });
    }
}

function showToast(message) {
    if (window.debugApp?.showToast) {
        window.debugApp.showToast('success', message);
    }
}

export default { render, init };
