/**
 * Policy Browser Component
 * Browse and view OPA policy rules
 */

import debugApi from '../../api.js';
import debugState from '../../state.js';

let policies = [];
let selectedPolicy = null;

function render() {
    return `
        <div class="space-y-4">
            <div class="flex items-center justify-between">
                <h2 class="text-lg font-semibold text-slate-100">Policy Browser</h2>
                <div class="flex items-center gap-3">
                    <button id="refresh-policies" class="debug-btn debug-btn-secondary">
                        <i data-lucide="refresh-cw" class="w-4 h-4"></i>
                        Refresh
                    </button>
                    <button id="test-policy" class="debug-btn debug-btn-primary">
                        <i data-lucide="play" class="w-4 h-4"></i>
                        Test Policy
                    </button>
                </div>
            </div>

            <div class="grid grid-cols-3 gap-4">
                <!-- Policy List -->
                <div class="col-span-1 debug-card">
                    <div class="debug-card-header">
                        <span class="text-sm font-medium">Loaded Policies</span>
                        <span class="text-xs text-slate-400">${policies.length}</span>
                    </div>
                    <div class="max-h-[500px] overflow-y-auto" id="policy-list">
                        ${renderPolicyList()}
                    </div>
                </div>

                <!-- Policy Content -->
                <div class="col-span-2 debug-card">
                    <div class="debug-card-header">
                        <span class="text-sm font-medium">
                            ${selectedPolicy ? selectedPolicy.name || selectedPolicy.id : 'Select a policy'}
                        </span>
                        ${selectedPolicy ? `
                            <button class="text-xs text-slate-400 hover:text-slate-200 copy-policy-btn">
                                Copy
                            </button>
                        ` : ''}
                    </div>
                    <div class="debug-card-body p-0" id="policy-content">
                        ${selectedPolicy ? renderPolicyContent(selectedPolicy) : renderEmptyState()}
                    </div>
                </div>
            </div>

            <!-- Policy Test Panel -->
            <div class="debug-card" id="test-panel" style="display: none;">
                <div class="debug-card-header">
                    <span class="text-sm font-medium">Test Policy Evaluation</span>
                    <button class="text-xs text-slate-400 hover:text-slate-200" id="close-test-panel">
                        Close
                    </button>
                </div>
                <div class="debug-card-body">
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Input JSON</h4>
                            <textarea id="test-input"
                                      class="w-full h-64 bg-slate-900 border border-slate-700 rounded p-3 font-mono text-xs text-slate-300 focus:outline-none focus:border-blue-500"
                                      placeholder='{"user": {"id": "..."}, "action": "view_balance", ...}'></textarea>
                        </div>
                        <div>
                            <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Result</h4>
                            <div id="test-result" class="h-64 bg-slate-900 border border-slate-700 rounded p-3 overflow-auto">
                                <span class="text-slate-500 text-sm">Enter input and click "Run Test"</span>
                            </div>
                        </div>
                    </div>
                    <div class="flex justify-end mt-4">
                        <button id="run-test" class="debug-btn debug-btn-primary">
                            <i data-lucide="play" class="w-4 h-4"></i>
                            Run Test
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderPolicyList() {
    if (policies.length === 0) {
        return `
            <div class="p-4 text-center text-slate-500 text-sm">
                No policies loaded
            </div>
        `;
    }

    return policies.map((policy, index) => `
        <div class="p-3 border-b border-slate-700 cursor-pointer hover:bg-slate-800/50 ${selectedPolicy?.id === policy.id ? 'bg-blue-500/10 border-l-2 border-l-blue-500' : ''}"
             data-policy-index="${index}">
            <div class="flex items-center gap-2">
                <i data-lucide="file-text" class="w-4 h-4 text-slate-400"></i>
                <span class="text-sm font-medium text-slate-200">${policy.name || policy.id}</span>
            </div>
            ${policy.package ? `
                <div class="text-xs text-slate-500 mt-1 ml-6">${policy.package}</div>
            ` : ''}
        </div>
    `).join('');
}

function renderEmptyState() {
    return `
        <div class="flex items-center justify-center h-64 text-slate-500">
            <div class="text-center">
                <div class="text-4xl mb-3">&#128196;</div>
                <div class="text-sm">Select a policy to view its content</div>
            </div>
        </div>
    `;
}

function renderPolicyContent(policy) {
    const content = policy.raw || policy.content || JSON.stringify(policy, null, 2);
    const isRego = content.includes('package') || content.includes('default');

    return `
        <pre class="code-block m-0 rounded-none h-[400px] overflow-auto"><code class="${isRego ? 'language-go' : 'language-json'}">${escapeHtml(content)}</code></pre>
    `;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function loadPolicies() {
    try {
        const response = await debugApi.getPolicies();
        policies = response?.policies || response || [];

        // Add some default structure if response is raw
        if (!Array.isArray(policies)) {
            policies = [{ id: 'main', name: 'Main Policy', raw: policies }];
        }

        debugState.set('policy.policies', policies);
        updateView();
    } catch (error) {
        console.error('Failed to load policies:', error);
        policies = [];
        updateView();
    }
}

function updateView() {
    const list = document.getElementById('policy-list');
    if (list) {
        list.innerHTML = renderPolicyList();
        if (window.lucide) window.lucide.createIcons();
    }

    const content = document.getElementById('policy-content');
    if (content) {
        content.innerHTML = selectedPolicy ? renderPolicyContent(selectedPolicy) : renderEmptyState();

        if (window.hljs) {
            content.querySelectorAll('pre code').forEach(block => {
                window.hljs.highlightElement(block);
            });
        }
    }
}

async function runPolicyTest() {
    const inputEl = document.getElementById('test-input');
    const resultEl = document.getElementById('test-result');

    if (!inputEl || !resultEl) return;

    const inputText = inputEl.value.trim();
    if (!inputText) {
        resultEl.innerHTML = '<span class="text-amber-400">Please enter input JSON</span>';
        return;
    }

    try {
        const input = JSON.parse(inputText);
        resultEl.innerHTML = '<span class="text-slate-400">Evaluating...</span>';

        const result = await debugApi.evaluatePolicy(input);

        const allowed = result?.result?.allow ?? result?.allow ?? false;
        resultEl.innerHTML = `
            <div class="space-y-3">
                <div class="p-3 rounded ${allowed ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'}">
                    <span class="${allowed ? 'text-green-400' : 'text-red-400'} font-semibold">
                        ${allowed ? '&#10004; ALLOW' : '&#10006; DENY'}
                    </span>
                </div>
                <div>
                    <div class="text-xs text-slate-400 mb-1">Full Result:</div>
                    <pre class="text-xs text-slate-300 overflow-x-auto"><code class="language-json">${JSON.stringify(result, null, 2)}</code></pre>
                </div>
            </div>
        `;

        if (window.hljs) {
            resultEl.querySelectorAll('pre code').forEach(block => {
                window.hljs.highlightElement(block);
            });
        }
    } catch (error) {
        if (error instanceof SyntaxError) {
            resultEl.innerHTML = `<span class="text-red-400">Invalid JSON: ${error.message}</span>`;
        } else {
            resultEl.innerHTML = `<span class="text-red-400">Error: ${error.message}</span>`;
        }
    }
}

function showTestPanel() {
    const panel = document.getElementById('test-panel');
    if (panel) {
        panel.style.display = 'block';
    }
}

function hideTestPanel() {
    const panel = document.getElementById('test-panel');
    if (panel) {
        panel.style.display = 'none';
    }
}

function init() {
    loadPolicies();

    // Refresh button
    document.getElementById('refresh-policies')?.addEventListener('click', loadPolicies);

    // Test policy button
    document.getElementById('test-policy')?.addEventListener('click', showTestPanel);

    // Close test panel
    document.getElementById('close-test-panel')?.addEventListener('click', hideTestPanel);

    // Run test button
    document.getElementById('run-test')?.addEventListener('click', runPolicyTest);

    // Policy selection
    document.addEventListener('click', (e) => {
        const policyItem = e.target.closest('[data-policy-index]');
        if (policyItem) {
            const index = parseInt(policyItem.getAttribute('data-policy-index'));
            selectedPolicy = policies[index];
            updateView();
        }
    });

    // Copy policy
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('copy-policy-btn')) {
            const content = selectedPolicy?.raw || selectedPolicy?.content || JSON.stringify(selectedPolicy, null, 2);
            navigator.clipboard.writeText(content);
            window.debugApp?.showToast('success', 'Policy copied');
        }
    });

    if (window.lucide) window.lucide.createIcons();
}

export default { render, init };
