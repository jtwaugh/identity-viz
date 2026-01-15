/**
 * Correlation View Component
 * Tree visualization showing how user actions trigger backend calls
 */

import debugApi from '../../api.js';
import debugState from '../../state.js';

let correlations = [];
let selectedCorrelation = null;

function render() {
    return `
        <div class="space-y-4">
            <div class="flex items-center justify-between">
                <h2 class="text-lg font-semibold text-slate-100">Request Correlation</h2>
                <div class="flex items-center gap-3">
                    <input type="text"
                           id="correlation-search"
                           placeholder="Search by correlation ID..."
                           class="debug-input w-64">
                    <button id="refresh-correlations" class="debug-btn debug-btn-secondary">
                        <i data-lucide="refresh-cw" class="w-4 h-4"></i>
                        Refresh
                    </button>
                </div>
            </div>

            <div class="grid grid-cols-3 gap-4">
                <!-- Correlation List -->
                <div class="col-span-1 debug-card">
                    <div class="debug-card-header">
                        <span class="text-sm font-medium">Request Chains</span>
                        <span class="text-xs text-slate-400">${correlations.length}</span>
                    </div>
                    <div class="max-h-[500px] overflow-y-auto" id="correlation-list">
                        ${renderCorrelationList()}
                    </div>
                </div>

                <!-- Correlation Tree -->
                <div class="col-span-2 debug-card">
                    <div class="debug-card-header">
                        <span class="text-sm font-medium">Request Flow</span>
                        ${selectedCorrelation ? `
                            <code class="text-xs text-slate-400">${selectedCorrelation.id?.substring(0, 16)}...</code>
                        ` : ''}
                    </div>
                    <div class="p-4 min-h-[400px]" id="correlation-tree">
                        ${selectedCorrelation ? renderCorrelationTree(selectedCorrelation) : renderEmptyState()}
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderCorrelationList() {
    if (correlations.length === 0) {
        return `
            <div class="p-4 text-center text-slate-500 text-sm">
                No correlated requests found
            </div>
        `;
    }

    return correlations.map((corr, index) => `
        <div class="p-3 border-b border-slate-700 cursor-pointer hover:bg-slate-800/50 ${selectedCorrelation?.id === corr.id ? 'bg-blue-500/10 border-l-2 border-l-blue-500' : ''}"
             data-correlation-index="${index}">
            <div class="flex items-center justify-between mb-1">
                <span class="text-sm font-medium text-slate-200">${corr.action || 'Unknown Action'}</span>
                <span class="text-xs ${corr.success ? 'text-green-400' : 'text-red-400'}">
                    ${corr.success ? '&#10004;' : '&#10006;'}
                </span>
            </div>
            <div class="flex items-center gap-2 text-xs text-slate-400">
                <code>${corr.id?.substring(0, 12)}...</code>
                <span>&#8226;</span>
                <span>${corr.requests?.length || 0} requests</span>
                <span>&#8226;</span>
                <span>${corr.totalDuration || 0}ms</span>
            </div>
        </div>
    `).join('');
}

function renderEmptyState() {
    return `
        <div class="flex items-center justify-center h-full text-slate-500">
            <div class="text-center">
                <div class="text-4xl mb-3">&#128268;</div>
                <div class="text-sm">Select a request chain to view the flow</div>
            </div>
        </div>
    `;
}

function renderCorrelationTree(correlation) {
    if (!correlation.requests || correlation.requests.length === 0) {
        return renderEmptyState();
    }

    // Build tree structure
    const rootRequest = correlation.requests.find(r => !r.parentId) || correlation.requests[0];

    return `
        <div class="space-y-2">
            <!-- Root User Action -->
            <div class="p-3 rounded bg-blue-500/10 border border-blue-500/30">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                        <span class="text-lg">&#128100;</span>
                        <span class="font-medium text-slate-200">${correlation.action || 'User Action'}</span>
                    </div>
                    <span class="text-xs text-slate-400">${new Date(correlation.timestamp).toLocaleTimeString()}</span>
                </div>
            </div>

            <!-- Request Tree -->
            <div class="ml-6">
                ${renderTreeNode(rootRequest, correlation.requests, 0)}
            </div>

            <!-- Summary -->
            <div class="mt-4 p-3 rounded bg-slate-800 border border-slate-700">
                <div class="grid grid-cols-4 gap-4 text-center">
                    <div>
                        <div class="text-xs text-slate-400">Total Requests</div>
                        <div class="text-lg font-semibold text-slate-200">${correlation.requests.length}</div>
                    </div>
                    <div>
                        <div class="text-xs text-slate-400">Total Duration</div>
                        <div class="text-lg font-semibold ${correlation.totalDuration > 1000 ? 'text-amber-400' : 'text-green-400'}">${correlation.totalDuration}ms</div>
                    </div>
                    <div>
                        <div class="text-xs text-slate-400">Success</div>
                        <div class="text-lg font-semibold text-green-400">${correlation.requests.filter(r => r.status >= 200 && r.status < 400).length}</div>
                    </div>
                    <div>
                        <div class="text-xs text-slate-400">Errors</div>
                        <div class="text-lg font-semibold ${correlation.requests.filter(r => r.status >= 400).length > 0 ? 'text-red-400' : 'text-slate-400'}">${correlation.requests.filter(r => r.status >= 400).length}</div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderTreeNode(request, allRequests, depth) {
    const children = allRequests.filter(r => r.parentId === request.id);
    const statusColor = request.status >= 200 && request.status < 400 ? 'text-green-400' : 'text-red-400';
    const nodeIcon = getNodeIcon(request);

    return `
        <div class="tree-node">
            <div class="tree-node-content p-2 rounded hover:bg-slate-800/50 cursor-pointer" data-request-id="${request.id}">
                <div class="flex items-center gap-2">
                    <span class="${request.status >= 200 && request.status < 400 ? 'text-green-400' : 'text-red-400'}">
                        ${nodeIcon}
                    </span>
                    <span class="method-badge method-${request.method?.toLowerCase() || 'get'} text-xs">
                        ${request.method || 'GET'}
                    </span>
                    <span class="text-sm text-slate-300 truncate flex-1">
                        ${request.url?.replace(/^https?:\/\/[^/]+/, '') || '/'}
                    </span>
                    <span class="text-xs ${statusColor}">${request.status || '-'}</span>
                    <span class="text-xs text-slate-500">${request.duration || 0}ms</span>
                </div>
            </div>
            ${children.length > 0 ? `
                <div class="ml-4">
                    ${children.map(child => renderTreeNode(child, allRequests, depth + 1)).join('')}
                </div>
            ` : ''}
        </div>
    `;
}

function getNodeIcon(request) {
    const url = request.url || '';
    if (url.includes('/auth') || url.includes('/token')) return '&#128274;'; // Lock
    if (url.includes('/opa') || url.includes('/policy')) return '&#128737;'; // Shield
    if (url.includes('/api')) return '&#128225;'; // API
    if (url.includes('keycloak')) return '&#128273;'; // Key
    return '&#128196;'; // Document
}

async function loadCorrelations() {
    try {
        const requests = debugState.get('network.requests') || [];

        // Group requests by correlation ID
        const grouped = {};
        requests.forEach(req => {
            const corrId = req.correlationId || req.id;
            if (!grouped[corrId]) {
                grouped[corrId] = {
                    id: corrId,
                    requests: [],
                    timestamp: req.timestamp,
                    action: req.action || 'API Request'
                };
            }
            grouped[corrId].requests.push(req);
        });

        // Calculate totals
        correlations = Object.values(grouped).map(corr => ({
            ...corr,
            totalDuration: corr.requests.reduce((sum, r) => sum + (r.duration || 0), 0),
            success: corr.requests.every(r => !r.status || (r.status >= 200 && r.status < 400))
        })).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        updateView();
    } catch (error) {
        console.error('Failed to load correlations:', error);
        correlations = [];
        updateView();
    }
}

function updateView() {
    const list = document.getElementById('correlation-list');
    if (list) {
        list.innerHTML = renderCorrelationList();
    }

    const tree = document.getElementById('correlation-tree');
    if (tree) {
        tree.innerHTML = selectedCorrelation ? renderCorrelationTree(selectedCorrelation) : renderEmptyState();
    }
}

function showRequestDetails(requestId) {
    const request = selectedCorrelation?.requests?.find(r => r.id === requestId);
    if (!request) return;

    debugState.openSlideOver('Request Details', {
        component: 'network/request-detail',
        props: request
    });
}

function init() {
    loadCorrelations();

    // Subscribe to request changes
    debugState.subscribe('network.requests', loadCorrelations);

    document.getElementById('correlation-search')?.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        const filtered = correlations.filter(c =>
            c.id?.toLowerCase().includes(query) ||
            c.action?.toLowerCase().includes(query)
        );
        // Update list with filtered results
        const list = document.getElementById('correlation-list');
        if (list) {
            correlations = filtered;
            list.innerHTML = renderCorrelationList();
        }
    });

    document.getElementById('refresh-correlations')?.addEventListener('click', loadCorrelations);

    // Correlation selection
    document.addEventListener('click', (e) => {
        const corrItem = e.target.closest('[data-correlation-index]');
        const reqNode = e.target.closest('[data-request-id]');

        if (corrItem) {
            const index = parseInt(corrItem.getAttribute('data-correlation-index'));
            selectedCorrelation = correlations[index];
            updateView();
        } else if (reqNode) {
            const requestId = reqNode.getAttribute('data-request-id');
            showRequestDetails(requestId);
        }
    });

    if (window.lucide) window.lucide.createIcons();
}

export default { render, init };
