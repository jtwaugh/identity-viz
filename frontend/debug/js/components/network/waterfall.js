/**
 * Waterfall Chart Component
 * Horizontal timeline visualization of requests
 */

import debugState from '../../state.js';

let requests = [];
let timeScale = 2000; // ms to display
let zoomLevel = 1;

function render() {
    requests = debugState.get('network.requests') || [];

    return `
        <div class="space-y-4">
            <div class="flex items-center justify-between">
                <h2 class="text-lg font-semibold text-slate-100">Request Waterfall</h2>
                <div class="flex items-center gap-3">
                    <div class="flex items-center gap-2">
                        <button id="zoom-out" class="debug-btn debug-btn-secondary text-xs py-1 px-2">
                            <i data-lucide="zoom-out" class="w-4 h-4"></i>
                        </button>
                        <span class="text-xs text-slate-400 w-16 text-center">${Math.round(zoomLevel * 100)}%</span>
                        <button id="zoom-in" class="debug-btn debug-btn-secondary text-xs py-1 px-2">
                            <i data-lucide="zoom-in" class="w-4 h-4"></i>
                        </button>
                    </div>
                    <select id="time-scale" class="debug-select">
                        <option value="1000" ${timeScale === 1000 ? 'selected' : ''}>1 second</option>
                        <option value="2000" ${timeScale === 2000 ? 'selected' : ''}>2 seconds</option>
                        <option value="5000" ${timeScale === 5000 ? 'selected' : ''}>5 seconds</option>
                        <option value="10000" ${timeScale === 10000 ? 'selected' : ''}>10 seconds</option>
                    </select>
                    <button id="clear-waterfall" class="debug-btn debug-btn-secondary">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                        Clear
                    </button>
                </div>
            </div>

            <div class="debug-card">
                <!-- Time scale header -->
                <div class="border-b border-slate-700 p-3 flex">
                    <div class="w-48 flex-shrink-0 text-xs font-medium text-slate-400 uppercase tracking-wider">
                        Request
                    </div>
                    <div class="flex-1 relative" id="time-scale-header">
                        ${renderTimeScale()}
                    </div>
                </div>

                <!-- Waterfall rows -->
                <div class="waterfall-container max-h-[500px] overflow-y-auto" id="waterfall-rows">
                    ${renderWaterfallRows()}
                </div>
            </div>

            <!-- Legend -->
            <div class="flex items-center gap-6 text-xs text-slate-400">
                <div class="flex items-center gap-2">
                    <div class="w-4 h-2 rounded waterfall-bar-success"></div>
                    <span>Success (2xx)</span>
                </div>
                <div class="flex items-center gap-2">
                    <div class="w-4 h-2 rounded waterfall-bar-error"></div>
                    <span>Error (4xx/5xx)</span>
                </div>
                <div class="flex items-center gap-2">
                    <div class="w-4 h-2 rounded waterfall-bar-pending"></div>
                    <span>Pending</span>
                </div>
            </div>
        </div>
    `;
}

function renderTimeScale() {
    const intervals = 5;
    const intervalMs = timeScale / intervals;

    return `
        <div class="flex justify-between text-xs text-slate-500">
            ${Array.from({ length: intervals + 1 }, (_, i) => `
                <span>${formatMs(i * intervalMs)}</span>
            `).join('')}
        </div>
        <div class="absolute inset-x-0 bottom-0 h-px bg-slate-700 flex justify-between">
            ${Array.from({ length: intervals + 1 }, (_, i) => `
                <div class="w-px h-2 bg-slate-600"></div>
            `).join('')}
        </div>
    `;
}

function renderWaterfallRows() {
    if (requests.length === 0) {
        return `
            <div class="p-8 text-center text-slate-500">
                <div class="text-4xl mb-3">&#128202;</div>
                <div class="text-sm">No requests to display</div>
            </div>
        `;
    }

    // Sort by timestamp
    const sortedRequests = [...requests].sort((a, b) =>
        new Date(a.timestamp) - new Date(b.timestamp)
    );

    // Find the earliest timestamp as reference
    const startTime = new Date(sortedRequests[0].timestamp).getTime();

    return sortedRequests.map((req, index) => {
        const reqStart = new Date(req.timestamp).getTime() - startTime;
        const duration = req.duration || 50; // minimum visible width

        // Calculate position and width as percentage
        const leftPercent = (reqStart / timeScale) * 100 * zoomLevel;
        const widthPercent = Math.max(0.5, (duration / timeScale) * 100 * zoomLevel);

        // Determine bar color
        let barClass = 'waterfall-bar-pending';
        if (req.status) {
            barClass = req.status >= 200 && req.status < 400 ? 'waterfall-bar-success' : 'waterfall-bar-error';
        }

        const urlPath = req.url?.replace(/^https?:\/\/[^/]+/, '') || '/';

        return `
            <div class="waterfall-row hover:bg-slate-800/30 cursor-pointer" data-request-id="${req.id}">
                <div class="waterfall-label flex items-center gap-2">
                    <span class="method-badge method-${req.method?.toLowerCase() || 'get'} text-xs py-0 px-1">
                        ${req.method || 'GET'}
                    </span>
                    <span class="truncate text-xs" title="${req.url}">${urlPath}</span>
                </div>
                <div class="waterfall-bar-container">
                    <div class="waterfall-bar ${barClass}"
                         style="left: ${leftPercent}%; width: ${widthPercent}%"
                         title="${req.method} ${urlPath} - ${duration}ms">
                    </div>
                    ${leftPercent < 95 ? `
                        <span class="absolute text-xs text-slate-500" style="left: calc(${leftPercent + widthPercent}% + 4px); top: 50%; transform: translateY(-50%);">
                            ${duration}ms
                        </span>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
}

function formatMs(ms) {
    if (ms >= 1000) {
        return `${(ms / 1000).toFixed(1)}s`;
    }
    return `${Math.round(ms)}ms`;
}

function updateWaterfall() {
    const rows = document.getElementById('waterfall-rows');
    if (rows) {
        rows.innerHTML = renderWaterfallRows();
    }

    const header = document.getElementById('time-scale-header');
    if (header) {
        header.innerHTML = renderTimeScale();
    }
}

function showRequestDetails(requestId) {
    const request = requests.find(r => r.id === requestId);
    if (!request) return;

    debugState.openSlideOver('Request Details', {
        component: 'network/request-detail',
        props: request
    });
}

function init() {
    // Subscribe to request changes
    debugState.subscribe('network.requests', () => {
        requests = debugState.get('network.requests') || [];
        updateWaterfall();
    });

    // Zoom controls
    document.getElementById('zoom-in')?.addEventListener('click', () => {
        zoomLevel = Math.min(4, zoomLevel * 1.5);
        updateWaterfall();
        updateZoomDisplay();
    });

    document.getElementById('zoom-out')?.addEventListener('click', () => {
        zoomLevel = Math.max(0.25, zoomLevel / 1.5);
        updateWaterfall();
        updateZoomDisplay();
    });

    // Time scale selector
    document.getElementById('time-scale')?.addEventListener('change', (e) => {
        timeScale = parseInt(e.target.value);
        updateWaterfall();
    });

    // Clear button
    document.getElementById('clear-waterfall')?.addEventListener('click', () => {
        debugState.set('network.requests', []);
    });

    // Row click handler
    document.addEventListener('click', (e) => {
        const row = e.target.closest('.waterfall-row');
        if (row) {
            const requestId = row.getAttribute('data-request-id');
            showRequestDetails(requestId);
        }
    });

    if (window.lucide) window.lucide.createIcons();
}

function updateZoomDisplay() {
    const zoomDisplay = document.querySelector('#zoom-out + span');
    if (zoomDisplay) {
        zoomDisplay.textContent = `${Math.round(zoomLevel * 100)}%`;
    }
}

export default { render, init };
