/**
 * Request Detail Component
 * Detailed view of a single HTTP request
 */

import debugApi from '../../api.js';
import debugState from '../../state.js';

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

/**
 * Render request detail view
 * @param {Object} request - Request object
 */
function render(request) {
    if (!request) {
        return `
            <div class="empty-state">
                <div class="empty-state-icon">&#128269;</div>
                <div class="empty-state-title">No Request Selected</div>
                <div class="empty-state-description">Select a request from the log to view details</div>
            </div>
        `;
    }

    const methodClass = METHOD_CLASSES[request.method] || 'method-get';
    const statusClass = getStatusClass(request.status);

    return `
        <div class="space-y-6">
            <!-- Summary Header -->
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <span class="method-badge ${methodClass}">${request.method}</span>
                    <span class="status-code ${statusClass}">${request.status || 'Pending'}</span>
                    ${request.duration ? `
                        <span class="text-sm ${request.duration > 1000 ? 'text-amber-400' : 'text-slate-400'}">
                            ${request.duration}ms
                        </span>
                    ` : ''}
                </div>
                <span class="text-xs text-slate-500">
                    ${new Date(request.timestamp).toLocaleString()}
                </span>
            </div>

            <!-- URL -->
            <div class="p-3 bg-slate-900 rounded font-mono text-sm text-slate-300 break-all">
                ${request.url}
            </div>

            <!-- Tabs -->
            <div>
                <div class="debug-tabs" id="detail-tabs">
                    <div class="debug-tab active" data-tab="headers">Headers</div>
                    <div class="debug-tab" data-tab="request">Request</div>
                    <div class="debug-tab" data-tab="response">Response</div>
                    <div class="debug-tab" data-tab="timing">Timing</div>
                    <div class="debug-tab" data-tab="curl">cURL</div>
                </div>

                <div id="detail-tab-content" class="mt-4">
                    ${renderHeadersContent(request)}
                </div>
            </div>

            <!-- Actions -->
            <div class="flex gap-3 pt-4 border-t border-slate-700">
                <button class="debug-btn debug-btn-secondary flex-1" id="copy-curl-btn">
                    <i data-lucide="terminal" class="w-4 h-4"></i>
                    Copy as cURL
                </button>
                <button class="debug-btn debug-btn-secondary flex-1" id="copy-request-btn">
                    <i data-lucide="copy" class="w-4 h-4"></i>
                    Copy Request
                </button>
                <button class="debug-btn debug-btn-secondary flex-1" id="copy-response-btn">
                    <i data-lucide="clipboard" class="w-4 h-4"></i>
                    Copy Response
                </button>
            </div>
        </div>
    `;
}

function renderHeadersContent(request) {
    return `
        <div class="space-y-4">
            <div>
                <div class="flex items-center justify-between mb-2">
                    <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Request Headers</h4>
                    <span class="text-xs text-slate-500">${Object.keys(request.requestHeaders || {}).length} headers</span>
                </div>
                <div class="bg-slate-900 rounded p-3 font-mono text-xs space-y-1 max-h-48 overflow-y-auto">
                    ${Object.entries(request.requestHeaders || {}).map(([key, value]) => `
                        <div class="flex">
                            <span class="text-purple-400 w-40 flex-shrink-0">${key}:</span>
                            <span class="text-slate-300 break-all">${escapeHtml(String(value))}</span>
                        </div>
                    `).join('') || '<span class="text-slate-500">No headers</span>'}
                </div>
            </div>
            <div>
                <div class="flex items-center justify-between mb-2">
                    <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Response Headers</h4>
                    <span class="text-xs text-slate-500">${Object.keys(request.responseHeaders || {}).length} headers</span>
                </div>
                <div class="bg-slate-900 rounded p-3 font-mono text-xs space-y-1 max-h-48 overflow-y-auto">
                    ${Object.entries(request.responseHeaders || {}).map(([key, value]) => `
                        <div class="flex">
                            <span class="text-blue-400 w-40 flex-shrink-0">${key}:</span>
                            <span class="text-slate-300 break-all">${escapeHtml(String(value))}</span>
                        </div>
                    `).join('') || '<span class="text-slate-500">No headers</span>'}
                </div>
            </div>
        </div>
    `;
}

function renderRequestContent(request) {
    if (!request.requestBody) {
        return '<div class="text-slate-500 text-sm p-4">No request body</div>';
    }

    return `
        <div>
            <div class="flex items-center justify-between mb-2">
                <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Request Body</h4>
                <button class="text-xs text-slate-400 hover:text-slate-200 copy-body-btn" data-type="request">Copy</button>
            </div>
            <pre class="code-block bg-slate-900 p-3 rounded overflow-x-auto text-xs max-h-96"><code class="language-json">${JSON.stringify(request.requestBody, null, 2)}</code></pre>
        </div>
    `;
}

function renderResponseContent(request) {
    if (request.error) {
        return `
            <div class="p-4 bg-red-500/10 border border-red-500/30 rounded">
                <div class="text-xs font-semibold text-red-400 uppercase tracking-wider mb-2">Error</div>
                <div class="text-sm text-red-300">${request.error}</div>
            </div>
        `;
    }

    if (!request.responseBody) {
        return '<div class="text-slate-500 text-sm p-4">No response body</div>';
    }

    return `
        <div>
            <div class="flex items-center justify-between mb-2">
                <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Response Body</h4>
                <button class="text-xs text-slate-400 hover:text-slate-200 copy-body-btn" data-type="response">Copy</button>
            </div>
            <pre class="code-block bg-slate-900 p-3 rounded overflow-x-auto text-xs max-h-96"><code class="language-json">${JSON.stringify(request.responseBody, null, 2)}</code></pre>
        </div>
    `;
}

function renderTimingContent(request) {
    return `
        <div class="space-y-3">
            <div class="p-4 bg-slate-900 rounded">
                <div class="flex justify-between items-center">
                    <span class="text-sm text-slate-400">Total Duration</span>
                    <span class="text-lg font-mono ${request.duration > 1000 ? 'text-amber-400' : 'text-green-400'}">
                        ${request.duration || 0}ms
                    </span>
                </div>
            </div>

            <!-- Visual timeline -->
            <div class="p-4 bg-slate-900 rounded">
                <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Request Timeline</h4>
                <div class="relative h-6 bg-slate-800 rounded overflow-hidden">
                    <div class="absolute left-0 top-0 h-full bg-blue-500/50 rounded"
                         style="width: ${Math.min(100, (request.duration || 0) / 20)}%">
                    </div>
                </div>
                <div class="flex justify-between mt-2 text-xs text-slate-500">
                    <span>0ms</span>
                    <span>2000ms</span>
                </div>
            </div>

            <div class="grid grid-cols-2 gap-4">
                <div class="p-4 bg-slate-900 rounded">
                    <div class="text-xs text-slate-400 mb-1">Started</div>
                    <div class="text-sm font-mono text-slate-200">
                        ${new Date(request.timestamp).toLocaleTimeString('en-US', {
                            hour12: false,
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                            fractionalSecondDigits: 3
                        })}
                    </div>
                </div>
                <div class="p-4 bg-slate-900 rounded">
                    <div class="text-xs text-slate-400 mb-1">Completed</div>
                    <div class="text-sm font-mono text-slate-200">
                        ${request.duration ? new Date(new Date(request.timestamp).getTime() + request.duration).toLocaleTimeString('en-US', {
                            hour12: false,
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                            fractionalSecondDigits: 3
                        }) : '-'}
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderCurlContent(request) {
    const curl = debugApi.generateCurl(request);

    return `
        <div>
            <div class="flex items-center justify-between mb-2">
                <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wider">cURL Command</h4>
                <button class="text-xs text-slate-400 hover:text-slate-200 copy-curl-inline">Copy</button>
            </div>
            <pre class="code-block bg-slate-900 p-3 rounded overflow-x-auto text-xs text-green-400">${curl}</pre>
        </div>
    `;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function init(request) {
    if (!request) return;

    // Setup tab handlers
    const tabs = document.querySelectorAll('#detail-tabs .debug-tab');
    const content = document.getElementById('detail-tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            const tabName = tab.getAttribute('data-tab');
            switch (tabName) {
                case 'headers':
                    content.innerHTML = renderHeadersContent(request);
                    break;
                case 'request':
                    content.innerHTML = renderRequestContent(request);
                    break;
                case 'response':
                    content.innerHTML = renderResponseContent(request);
                    break;
                case 'timing':
                    content.innerHTML = renderTimingContent(request);
                    break;
                case 'curl':
                    content.innerHTML = renderCurlContent(request);
                    break;
            }

            // Re-highlight code
            if (window.hljs) {
                content.querySelectorAll('pre code').forEach(block => {
                    window.hljs.highlightElement(block);
                });
            }

            // Setup copy handlers
            setupCopyHandlers(request);
        });
    });

    // Action buttons
    document.getElementById('copy-curl-btn')?.addEventListener('click', () => {
        navigator.clipboard.writeText(debugApi.generateCurl(request));
        showToast('Copied cURL command');
    });

    document.getElementById('copy-request-btn')?.addEventListener('click', () => {
        navigator.clipboard.writeText(JSON.stringify({
            method: request.method,
            url: request.url,
            headers: request.requestHeaders,
            body: request.requestBody
        }, null, 2));
        showToast('Copied request');
    });

    document.getElementById('copy-response-btn')?.addEventListener('click', () => {
        navigator.clipboard.writeText(JSON.stringify(request.responseBody, null, 2));
        showToast('Copied response');
    });

    setupCopyHandlers(request);

    if (window.lucide) window.lucide.createIcons();
    if (window.hljs) {
        document.querySelectorAll('#detail-tab-content pre code').forEach(block => {
            window.hljs.highlightElement(block);
        });
    }
}

function setupCopyHandlers(request) {
    document.querySelectorAll('.copy-body-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const type = btn.getAttribute('data-type');
            const data = type === 'request' ? request.requestBody : request.responseBody;
            navigator.clipboard.writeText(JSON.stringify(data, null, 2));
            showToast(`Copied ${type} body`);
        });
    });

    document.querySelector('.copy-curl-inline')?.addEventListener('click', () => {
        navigator.clipboard.writeText(debugApi.generateCurl(request));
        showToast('Copied cURL command');
    });
}

function showToast(message) {
    if (window.debugApp?.showToast) {
        window.debugApp.showToast('success', message);
    }
}

export default { render, init };
