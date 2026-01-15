/**
 * Service Health Component
 * Displays health status and metrics for all services
 */

import debugApi from '../../api.js';
import debugState from '../../state.js';

let healthData = {
    backend: { status: 'unknown', metrics: {} },
    postgres: { status: 'unknown', metrics: {} },
    keycloak: { status: 'unknown', metrics: {} },
    opa: { status: 'unknown', metrics: {} }
};

const SERVICE_CONFIG = {
    backend: {
        name: 'Backend API',
        icon: 'server',
        url: 'backend:8000',
        color: 'blue'
    },
    postgres: {
        name: 'PostgreSQL',
        icon: 'database',
        url: 'postgres:5432',
        color: 'green'
    },
    keycloak: {
        name: 'Keycloak',
        icon: 'key',
        url: 'keycloak:8080',
        color: 'purple'
    },
    opa: {
        name: 'Open Policy Agent',
        icon: 'shield',
        url: 'opa:8181',
        color: 'amber'
    }
};

function render() {
    return `
        <div class="space-y-6">
            <div class="flex items-center justify-between">
                <h2 class="text-lg font-semibold text-slate-100">Service Health</h2>
                <div class="flex items-center gap-3">
                    <span class="text-xs text-slate-400">Last updated: <span id="last-updated">-</span></span>
                    <button id="refresh-health" class="debug-btn debug-btn-secondary">
                        <i data-lucide="refresh-cw" class="w-4 h-4"></i>
                        Refresh
                    </button>
                </div>
            </div>

            <!-- Service Cards Grid -->
            <div class="grid grid-cols-2 gap-4" id="health-grid">
                ${Object.keys(SERVICE_CONFIG).map(service => renderServiceCard(service)).join('')}
            </div>

            <!-- Performance Metrics -->
            <div class="debug-card">
                <div class="debug-card-header">
                    <span class="text-sm font-medium">Performance Metrics</span>
                </div>
                <div class="debug-card-body">
                    <div class="grid grid-cols-3 gap-6" id="performance-metrics">
                        ${renderPerformanceMetrics()}
                    </div>
                </div>
            </div>

            <!-- Recent Errors -->
            <div class="debug-card">
                <div class="debug-card-header">
                    <span class="text-sm font-medium">Recent Errors</span>
                    <span class="text-xs text-slate-400" id="error-count">0 errors</span>
                </div>
                <div class="debug-card-body max-h-64 overflow-y-auto" id="error-list">
                    ${renderErrorList()}
                </div>
            </div>
        </div>
    `;
}

function renderServiceCard(serviceId) {
    const config = SERVICE_CONFIG[serviceId];
    const health = healthData[serviceId] || { status: 'unknown', metrics: {} };
    const statusColor = getStatusColor(health.status);

    return `
        <div class="debug-card service-card" data-service="${serviceId}">
            <div class="p-4">
                <!-- Header -->
                <div class="flex items-center justify-between mb-4">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-lg bg-${config.color}-500/20 flex items-center justify-center">
                            <i data-lucide="${config.icon}" class="w-5 h-5 text-${config.color}-400"></i>
                        </div>
                        <div>
                            <div class="font-medium text-slate-200">${config.name}</div>
                            <div class="text-xs text-slate-500">${config.url}</div>
                        </div>
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="status-dot status-${statusColor}"></span>
                        <span class="text-sm ${statusColor === 'success' ? 'text-green-400' : statusColor === 'warning' ? 'text-amber-400' : 'text-red-400'}">
                            ${health.status || 'Unknown'}
                        </span>
                    </div>
                </div>

                <!-- Metrics -->
                <div class="grid grid-cols-3 gap-4 text-center">
                    <div>
                        <div class="text-xs text-slate-400">CPU</div>
                        <div class="text-lg font-semibold text-slate-200">${health.metrics?.cpu || '-'}%</div>
                    </div>
                    <div>
                        <div class="text-xs text-slate-400">Memory</div>
                        <div class="text-lg font-semibold text-slate-200">${health.metrics?.memory || '-'}%</div>
                    </div>
                    <div>
                        <div class="text-xs text-slate-400">Connections</div>
                        <div class="text-lg font-semibold text-slate-200">${health.metrics?.connections || '-'}</div>
                    </div>
                </div>

                <!-- Response Time -->
                ${health.metrics?.responseTime !== undefined ? `
                    <div class="mt-4 pt-4 border-t border-slate-700">
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-slate-400">Response Time</span>
                            <span class="text-sm font-mono ${health.metrics.responseTime > 500 ? 'text-amber-400' : 'text-green-400'}">
                                ${health.metrics.responseTime}ms
                            </span>
                        </div>
                        <div class="mt-2 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div class="h-full ${health.metrics.responseTime > 500 ? 'bg-amber-500' : 'bg-green-500'}"
                                 style="width: ${Math.min(100, health.metrics.responseTime / 10)}%"></div>
                        </div>
                    </div>
                ` : ''}
            </div>
        </div>
    `;
}

function renderPerformanceMetrics() {
    const backend = healthData.backend?.metrics || {};

    return `
        <div>
            <div class="text-xs text-slate-400 mb-2">Response Times</div>
            <div class="space-y-2">
                <div class="flex justify-between">
                    <span class="text-sm text-slate-300">Average</span>
                    <span class="text-sm font-mono text-slate-200">${backend.avgResponseTime || '-'}ms</span>
                </div>
                <div class="flex justify-between">
                    <span class="text-sm text-slate-300">P95</span>
                    <span class="text-sm font-mono text-slate-200">${backend.p95ResponseTime || '-'}ms</span>
                </div>
                <div class="flex justify-between">
                    <span class="text-sm text-slate-300">P99</span>
                    <span class="text-sm font-mono text-slate-200">${backend.p99ResponseTime || '-'}ms</span>
                </div>
            </div>
        </div>
        <div>
            <div class="text-xs text-slate-400 mb-2">Throughput</div>
            <div class="space-y-2">
                <div class="flex justify-between">
                    <span class="text-sm text-slate-300">Requests/min</span>
                    <span class="text-sm font-mono text-slate-200">${backend.requestsPerMinute || '-'}</span>
                </div>
                <div class="flex justify-between">
                    <span class="text-sm text-slate-300">Active Requests</span>
                    <span class="text-sm font-mono text-slate-200">${backend.activeRequests || '-'}</span>
                </div>
                <div class="flex justify-between">
                    <span class="text-sm text-slate-300">Queue Depth</span>
                    <span class="text-sm font-mono text-slate-200">${backend.queueDepth || '-'}</span>
                </div>
            </div>
        </div>
        <div>
            <div class="text-xs text-slate-400 mb-2">Error Rates</div>
            <div class="space-y-2">
                <div class="flex justify-between">
                    <span class="text-sm text-slate-300">Error Rate</span>
                    <span class="text-sm font-mono ${(backend.errorRate || 0) > 1 ? 'text-red-400' : 'text-green-400'}">
                        ${backend.errorRate || 0}%
                    </span>
                </div>
                <div class="flex justify-between">
                    <span class="text-sm text-slate-300">4xx Errors</span>
                    <span class="text-sm font-mono text-slate-200">${backend.clientErrors || 0}</span>
                </div>
                <div class="flex justify-between">
                    <span class="text-sm text-slate-300">5xx Errors</span>
                    <span class="text-sm font-mono ${(backend.serverErrors || 0) > 0 ? 'text-red-400' : 'text-slate-200'}">
                        ${backend.serverErrors || 0}
                    </span>
                </div>
            </div>
        </div>
    `;
}

function renderErrorList() {
    const errors = getAllErrors();

    if (errors.length === 0) {
        return `
            <div class="text-center text-slate-500 py-8">
                <div class="text-2xl mb-2">&#10004;</div>
                <div class="text-sm">No recent errors</div>
            </div>
        `;
    }

    return errors.map(error => `
        <div class="flex items-start gap-3 p-3 border-b border-slate-700 last:border-0">
            <span class="text-red-400 mt-0.5">&#9888;</span>
            <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                    <span class="text-xs text-slate-400">${error.timestamp}</span>
                    <span class="px-2 py-0.5 text-xs rounded bg-slate-700 text-slate-300">${error.service}</span>
                </div>
                <div class="text-sm text-slate-300 mt-1">${error.message}</div>
            </div>
        </div>
    `).join('');
}

function getStatusColor(status) {
    switch (status?.toLowerCase()) {
        case 'healthy':
        case 'up':
        case 'ok':
            return 'success';
        case 'degraded':
        case 'warning':
            return 'warning';
        case 'unhealthy':
        case 'down':
        case 'error':
            return 'error';
        default:
            return 'info';
    }
}

function getAllErrors() {
    const errors = [];
    Object.entries(healthData).forEach(([service, data]) => {
        if (data.errors) {
            data.errors.forEach(err => {
                errors.push({
                    service,
                    timestamp: new Date(err.timestamp).toLocaleTimeString(),
                    message: err.message
                });
            });
        }
    });
    return errors.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 20);
}

async function loadHealth() {
    try {
        const response = await debugApi.getHealth();

        if (response) {
            // Update health data
            Object.keys(SERVICE_CONFIG).forEach(service => {
                if (response[service]) {
                    healthData[service] = {
                        status: response[service].status || 'unknown',
                        metrics: response[service].metrics || {},
                        errors: response[service].errors || []
                    };
                }
            });

            // Update state
            debugState.set('health', healthData);

            // Update UI
            updateView();
        }
    } catch (error) {
        console.error('Failed to load health:', error);

        // Mark all services as unknown on error
        Object.keys(healthData).forEach(service => {
            healthData[service].status = 'unknown';
        });
        updateView();
    }
}

function updateView() {
    // Update service cards
    const grid = document.getElementById('health-grid');
    if (grid) {
        grid.innerHTML = Object.keys(SERVICE_CONFIG).map(service => renderServiceCard(service)).join('');
        if (window.lucide) window.lucide.createIcons();
    }

    // Update performance metrics
    const metrics = document.getElementById('performance-metrics');
    if (metrics) {
        metrics.innerHTML = renderPerformanceMetrics();
    }

    // Update error list
    const errorList = document.getElementById('error-list');
    if (errorList) {
        errorList.innerHTML = renderErrorList();
    }

    // Update error count
    const errorCount = document.getElementById('error-count');
    if (errorCount) {
        const count = getAllErrors().length;
        errorCount.textContent = `${count} error${count !== 1 ? 's' : ''}`;
    }

    // Update last updated
    const lastUpdated = document.getElementById('last-updated');
    if (lastUpdated) {
        lastUpdated.textContent = new Date().toLocaleTimeString();
    }
}

function init() {
    // Load initial health data
    loadHealth();

    // Auto-refresh every 10 seconds
    const refreshInterval = setInterval(loadHealth, 10000);

    // Refresh button
    document.getElementById('refresh-health')?.addEventListener('click', loadHealth);

    // Subscribe to health updates from SSE
    debugState.subscribe('health', (data) => {
        if (data) {
            healthData = data;
            updateView();
        }
    });

    if (window.lucide) window.lucide.createIcons();

    return () => {
        clearInterval(refreshInterval);
    };
}

export default { render, init };
