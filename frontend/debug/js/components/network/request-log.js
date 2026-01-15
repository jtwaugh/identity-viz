/**
 * Request Log Component
 * Displays HTTP request/response log
 */

import debugApi from '../../api.js';
import debugState from '../../state.js';

let requests = [];
let sortColumn = 'timestamp';
let sortDirection = 'desc';
let methodFilter = 'all';
let statusFilter = 'all';
let searchQuery = '';

const METHOD_CLASSES = {
    GET: 'method-get',
    POST: 'method-post',
    PUT: 'method-put',
    PATCH: 'method-patch',
    DELETE: 'method-delete'
};

function getStatusClass(status) {
    if (status >= 200 && status < 300) return 'status-2xx';
    if (status >= 300 && status < 400) return 'status-3xx';
    if (status >= 400 && status < 500) return 'status-4xx';
    if (status >= 500) return 'status-5xx';
    return 'bg-slate-700 text-slate-400';
}

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
    // Get requests from state (populated by SSE events)
    requests = debugState.get('network.requests') || [];

    return `
        <div class="space-y-4">
            <div class="flex items-center justify-between">
                <h2 class="text-lg font-semibold text-slate-100">Request Log</h2>
                <div class="flex items-center gap-3">
                    <select id="method-filter" class="debug-select">
                        <option value="all">All Methods</option>
                        <option value="GET">GET</option>
                        <option value="POST">POST</option>
                        <option value="PUT">PUT</option>
                        <option value="PATCH">PATCH</option>
                        <option value="DELETE">DELETE</option>
                    </select>
                    <select id="status-filter" class="debug-select">
                        <option value="all">All Status</option>
                        <option value="2xx">2xx Success</option>
                        <option value="3xx">3xx Redirect</option>
                        <option value="4xx">4xx Client Error</option>
                        <option value="5xx">5xx Server Error</option>
                    </select>
                    <input type="text"
                           id="request-search"
                           placeholder="Filter by URL..."
                           class="debug-input w-48"
                           value="${searchQuery}">
                    <button id="clear-requests" class="debug-btn debug-btn-secondary">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                        Clear
                    </button>
                </div>
            </div>

            <div class="debug-card">
                <div class="overflow-x-auto max-h-[600px]">
                    <table class="debug-table">
                        <thead>
                            <tr>
                                <th class="w-24 cursor-pointer hover:bg-slate-700/50" data-sort="timestamp">Time</th>
                                <th class="w-16">Method</th>
                                <th class="cursor-pointer hover:bg-slate-700/50" data-sort="url">URL</th>
                                <th class="w-20">Status</th>
                                <th class="w-20 text-right cursor-pointer hover:bg-slate-700/50" data-sort="duration">Duration</th>
                                <th class="w-20">Actions</th>
                            </tr>
                        </thead>
                        <tbody id="requests-tbody">
                            ${renderTableBody()}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
}

function renderTableBody() {
    const filtered = filterAndSortRequests();

    if (filtered.length === 0) {
        return `
            <tr>
                <td colspan="6" class="text-center text-slate-500 py-8">
                    ${searchQuery || methodFilter !== 'all' || statusFilter !== 'all'
                        ? 'No requests match your filters'
                        : 'No requests captured yet'}
                </td>
            </tr>
        `;
    }

    return filtered.map((req, index) => {
        const methodClass = METHOD_CLASSES[req.method] || 'method-get';
        const statusClass = getStatusClass(req.status);
        const urlPath = req.url?.replace(/^https?:\/\/[^/]+/, '') || req.url;

        return `
            <tr class="clickable" data-request-id="${req.id}">
                <td class="text-slate-400 text-xs font-mono">
                    ${formatDate(req.timestamp)}
                </td>
                <td>
                    <span class="method-badge ${methodClass}">${req.method}</span>
                </td>
                <td class="text-sm">
                    <span class="text-slate-300 truncate block max-w-md" title="${req.url}">
                        ${urlPath}
                    </span>
                </td>
                <td>
                    <span class="status-code ${statusClass}">${req.status || '-'}</span>
                </td>
                <td class="text-right font-mono text-sm ${req.duration > 1000 ? 'text-amber-400' : 'text-slate-400'}">
                    ${req.duration ? `${req.duration}ms` : '-'}
                </td>
                <td>
                    <button class="debug-btn debug-btn-secondary text-xs py-1 px-2 view-request" data-request-id="${req.id}">
                        View
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function filterAndSortRequests() {
    let filtered = [...requests];

    if (methodFilter !== 'all') {
        filtered = filtered.filter(r => r.method === methodFilter);
    }

    if (statusFilter !== 'all') {
        filtered = filtered.filter(r => {
            const status = r.status || 0;
            switch (statusFilter) {
                case '2xx': return status >= 200 && status < 300;
                case '3xx': return status >= 300 && status < 400;
                case '4xx': return status >= 400 && status < 500;
                case '5xx': return status >= 500;
                default: return true;
            }
        });
    }

    if (searchQuery) {
        const query = searchQuery.toLowerCase();
        filtered = filtered.filter(r => r.url?.toLowerCase().includes(query));
    }

    filtered.sort((a, b) => {
        let aVal = a[sortColumn] || '';
        let bVal = b[sortColumn] || '';

        if (sortColumn === 'timestamp') {
            aVal = new Date(aVal).getTime();
            bVal = new Date(bVal).getTime();
        }

        if (sortColumn === 'duration') {
            aVal = parseInt(aVal) || 0;
            bVal = parseInt(bVal) || 0;
        }

        if (typeof aVal === 'string') {
            aVal = aVal.toLowerCase();
            bVal = bVal.toLowerCase();
        }

        return sortDirection === 'asc' ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1);
    });

    return filtered;
}

function updateTableBody() {
    requests = debugState.get('network.requests') || [];
    const tbody = document.getElementById('requests-tbody');
    if (tbody) {
        tbody.innerHTML = renderTableBody();
    }
}

function showRequestDetails(requestId) {
    const request = requests.find(r => r.id === requestId);
    if (!request) return;

    const methodClass = METHOD_CLASSES[request.method] || 'method-get';
    const statusClass = getStatusClass(request.status);

    const html = `
        <div class="space-y-4">
            <!-- Summary -->
            <div class="flex items-center gap-3">
                <span class="method-badge ${methodClass}">${request.method}</span>
                <span class="status-code ${statusClass}">${request.status || '-'}</span>
                <span class="text-sm text-slate-400">${request.duration ? `${request.duration}ms` : '-'}</span>
            </div>

            <div class="text-sm text-slate-300 font-mono break-all bg-slate-900 p-2 rounded">
                ${request.url}
            </div>

            <!-- Tabs -->
            <div class="debug-tabs">
                <div class="debug-tab active" data-tab="headers">Headers</div>
                <div class="debug-tab" data-tab="body">Request Body</div>
                <div class="debug-tab" data-tab="response">Response</div>
                <div class="debug-tab" data-tab="timing">Timing</div>
                <div class="debug-tab" data-tab="curl">cURL</div>
            </div>

            <!-- Tab Content -->
            <div id="tab-content">
                ${renderHeadersTab(request)}
            </div>

            <!-- Actions -->
            <div class="flex gap-3">
                <button id="copy-curl" class="debug-btn debug-btn-secondary flex-1">
                    <i data-lucide="terminal" class="w-4 h-4"></i>
                    Copy as cURL
                </button>
                <button id="copy-response" class="debug-btn debug-btn-secondary flex-1">
                    <i data-lucide="copy" class="w-4 h-4"></i>
                    Copy Response
                </button>
            </div>
        </div>
    `;

    debugState.openSlideOver('Request Details', { html });

    // Setup tab handlers
    setTimeout(() => {
        setupDetailTabs(request);
        if (window.lucide) window.lucide.createIcons();
    }, 10);
}

function renderHeadersTab(request) {
    return `
        <div class="space-y-4">
            <div>
                <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Request Headers</h4>
                <div class="bg-slate-900 rounded p-3 font-mono text-xs space-y-1">
                    ${Object.entries(request.requestHeaders || {}).map(([key, value]) => `
                        <div><span class="text-purple-400">${key}:</span> <span class="text-slate-300">${value}</span></div>
                    `).join('') || '<span class="text-slate-500">No headers</span>'}
                </div>
            </div>
            <div>
                <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Response Headers</h4>
                <div class="bg-slate-900 rounded p-3 font-mono text-xs space-y-1">
                    ${Object.entries(request.responseHeaders || {}).map(([key, value]) => `
                        <div><span class="text-blue-400">${key}:</span> <span class="text-slate-300">${value}</span></div>
                    `).join('') || '<span class="text-slate-500">No headers</span>'}
                </div>
            </div>
        </div>
    `;
}

function renderBodyTab(request) {
    const body = request.requestBody;
    if (!body) {
        return '<div class="text-slate-500 text-sm">No request body</div>';
    }

    return `
        <pre class="code-block bg-slate-900 p-3 rounded overflow-x-auto text-xs"><code class="language-json">${JSON.stringify(body, null, 2)}</code></pre>
    `;
}

function renderResponseTab(request) {
    const body = request.responseBody;
    if (!body) {
        return '<div class="text-slate-500 text-sm">No response body</div>';
    }

    return `
        <pre class="code-block bg-slate-900 p-3 rounded overflow-x-auto text-xs"><code class="language-json">${JSON.stringify(body, null, 2)}</code></pre>
    `;
}

function renderTimingTab(request) {
    return `
        <div class="space-y-3">
            <div class="flex justify-between items-center p-3 bg-slate-900 rounded">
                <span class="text-sm text-slate-400">Total Duration</span>
                <span class="text-sm font-mono text-slate-200">${request.duration || 0}ms</span>
            </div>
            <div class="flex justify-between items-center p-3 bg-slate-900 rounded">
                <span class="text-sm text-slate-400">Timestamp</span>
                <span class="text-sm font-mono text-slate-200">${new Date(request.timestamp).toLocaleString()}</span>
            </div>
        </div>
    `;
}

function renderCurlTab(request) {
    const curl = debugApi.generateCurl(request);
    return `
        <div class="relative">
            <pre class="code-block bg-slate-900 p-3 rounded overflow-x-auto text-xs text-slate-300">${curl}</pre>
            <button class="absolute top-2 right-2 px-2 py-1 text-xs bg-slate-700 rounded hover:bg-slate-600 text-slate-300" id="copy-curl-inline">
                Copy
            </button>
        </div>
    `;
}

function setupDetailTabs(request) {
    const tabs = document.querySelectorAll('.debug-tab');
    const content = document.getElementById('tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            const tabName = tab.getAttribute('data-tab');
            switch (tabName) {
                case 'headers':
                    content.innerHTML = renderHeadersTab(request);
                    break;
                case 'body':
                    content.innerHTML = renderBodyTab(request);
                    break;
                case 'response':
                    content.innerHTML = renderResponseTab(request);
                    break;
                case 'timing':
                    content.innerHTML = renderTimingTab(request);
                    break;
                case 'curl':
                    content.innerHTML = renderCurlTab(request);
                    document.getElementById('copy-curl-inline')?.addEventListener('click', () => {
                        navigator.clipboard.writeText(debugApi.generateCurl(request));
                    });
                    break;
            }

            if (window.hljs) {
                content.querySelectorAll('pre code').forEach(block => {
                    window.hljs.highlightElement(block);
                });
            }
        });
    });

    // Copy handlers
    document.getElementById('copy-curl')?.addEventListener('click', () => {
        navigator.clipboard.writeText(debugApi.generateCurl(request));
    });

    document.getElementById('copy-response')?.addEventListener('click', () => {
        navigator.clipboard.writeText(JSON.stringify(request.responseBody, null, 2));
    });
}

function init() {
    // Subscribe to request changes
    debugState.subscribe('network.requests', updateTableBody);

    document.getElementById('method-filter')?.addEventListener('change', (e) => {
        methodFilter = e.target.value;
        updateTableBody();
    });

    document.getElementById('status-filter')?.addEventListener('change', (e) => {
        statusFilter = e.target.value;
        updateTableBody();
    });

    document.getElementById('request-search')?.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        updateTableBody();
    });

    document.getElementById('clear-requests')?.addEventListener('click', () => {
        debugState.set('network.requests', []);
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
            updateTableBody();
        });
    });

    document.addEventListener('click', (e) => {
        const viewBtn = e.target.closest('.view-request');
        const row = e.target.closest('[data-request-id]');

        if (viewBtn) {
            showRequestDetails(viewBtn.getAttribute('data-request-id'));
        } else if (row && !e.target.closest('button')) {
            showRequestDetails(row.getAttribute('data-request-id'));
        }
    });

    if (window.lucide) window.lucide.createIcons();
}

export default { render, init };
