/**
 * Session Timeline Component
 * Vertical timeline showing all events in a session
 */

import debugApi from '../../api.js';
import debugState from '../../state.js';

let sessionId = null;
let events = [];
let expandedEvents = new Set();

// Event type icons
const EVENT_ICONS = {
    UI: '&#128433;',
    API: '&#128225;',
    OPA: '&#128737;',
    AUTH: '&#128274;',
    TOKEN: '&#127915;',
    CONTEXT_SWITCH: '&#128260;',
    ERROR: '&#9888;',
    DB: '&#128452;'
};

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
    sessionId = debugState.get('workflows.currentSession');

    return `
        <div class="space-y-4">
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-4">
                    <h2 class="text-lg font-semibold text-slate-100">Session Timeline</h2>
                    ${sessionId ? `
                        <code class="text-xs text-slate-400 bg-slate-800 px-2 py-1 rounded">${sessionId.substring(0, 16)}...</code>
                    ` : ''}
                </div>
                <div class="flex items-center gap-3">
                    <select id="session-select" class="debug-select">
                        <option value="">Select session...</option>
                    </select>
                    <button id="refresh-timeline" class="debug-btn debug-btn-secondary">
                        <i data-lucide="refresh-cw" class="w-4 h-4"></i>
                        Refresh
                    </button>
                    <button id="export-timeline" class="debug-btn debug-btn-secondary">
                        <i data-lucide="download" class="w-4 h-4"></i>
                        Export
                    </button>
                </div>
            </div>

            ${sessionId ? `
            <!-- Session Summary -->
            <div class="grid grid-cols-4 gap-4" id="timeline-summary">
                ${renderSummaryCards()}
            </div>
            ` : ''}

            <!-- Timeline -->
            <div class="debug-card">
                <div class="debug-card-header">
                    <span class="text-sm font-medium">Events Timeline</span>
                    <span class="text-xs text-slate-400">${events.length} events</span>
                </div>
                <div class="debug-card-body max-h-[600px] overflow-y-auto" id="timeline-container">
                    ${sessionId ? renderTimeline() : renderNoSession()}
                </div>
            </div>
        </div>
    `;
}

function renderNoSession() {
    return `
        <div class="flex items-center justify-center h-64 text-slate-500">
            <div class="text-center">
                <div class="text-4xl mb-3">&#128337;</div>
                <div class="text-sm">Select a session to view its timeline</div>
            </div>
        </div>
    `;
}

function renderSummaryCards() {
    const contextSwitches = events.filter(e => e.type === 'CONTEXT_SWITCH').length;
    const apiCalls = events.filter(e => e.type === 'API').length;
    const errors = events.filter(e => e.type === 'ERROR').length;
    const duration = events.length > 1
        ? Math.round((new Date(events[events.length - 1].timestamp) - new Date(events[0].timestamp)) / 1000)
        : 0;

    return `
        <div class="debug-card">
            <div class="p-4">
                <div class="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Events</div>
                <div class="text-2xl font-semibold text-slate-100 mt-1">${events.length}</div>
            </div>
        </div>
        <div class="debug-card">
            <div class="p-4">
                <div class="text-xs font-medium text-slate-400 uppercase tracking-wider">Context Switches</div>
                <div class="text-2xl font-semibold text-purple-400 mt-1">${contextSwitches}</div>
            </div>
        </div>
        <div class="debug-card">
            <div class="p-4">
                <div class="text-xs font-medium text-slate-400 uppercase tracking-wider">API Calls</div>
                <div class="text-2xl font-semibold text-blue-400 mt-1">${apiCalls}</div>
            </div>
        </div>
        <div class="debug-card">
            <div class="p-4">
                <div class="text-xs font-medium text-slate-400 uppercase tracking-wider">Errors</div>
                <div class="text-2xl font-semibold ${errors > 0 ? 'text-red-400' : 'text-slate-400'} mt-1">${errors}</div>
            </div>
        </div>
    `;
}

function renderTimeline() {
    if (events.length === 0) {
        return `
            <div class="flex items-center justify-center h-32 text-slate-500 text-sm">
                No events in this session
            </div>
        `;
    }

    return `
        <div class="timeline">
            ${events.map((event, index) => renderTimelineItem(event, index)).join('')}
        </div>
    `;
}

function renderTimelineItem(event, index) {
    const isExpanded = expandedEvents.has(event.id);
    const isContextSwitch = event.type === 'CONTEXT_SWITCH';
    const isError = event.type === 'ERROR';

    const itemClass = isContextSwitch ? 'context-switch' : (isError ? 'error' : 'success');
    const icon = EVENT_ICONS[event.type] || '&#128196;';

    return `
        <div class="timeline-item ${itemClass}" data-event-index="${index}">
            ${isContextSwitch ? `
                <div class="text-xs text-purple-400 font-semibold mb-2">CONTEXT SWITCH</div>
            ` : ''}

            <div class="flex items-start gap-3 cursor-pointer hover:bg-slate-800/30 p-2 rounded -ml-2" data-expand="${event.id}">
                <span class="text-lg flex-shrink-0">${icon}</span>
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                        <span class="text-xs text-slate-500">${formatDate(event.timestamp)}</span>
                        <span class="px-2 py-0.5 text-xs rounded event-badge-${event.type?.toLowerCase() || 'audit'}">
                            ${event.type || 'EVENT'}
                        </span>
                    </div>
                    <div class="text-sm text-slate-300 mt-1">${getEventSummary(event)}</div>
                </div>
                <span class="text-slate-500 text-xs transform transition-transform ${isExpanded ? 'rotate-180' : ''}">&#9660;</span>
            </div>

            ${isExpanded ? renderExpandedEvent(event) : ''}
        </div>
    `;
}

function renderExpandedEvent(event) {
    const data = event.data || event;

    return `
        <div class="mt-2 ml-8 p-3 bg-slate-900 rounded text-xs">
            ${event.type === 'TOKEN' && data.token ? `
                <div class="mb-3">
                    <div class="text-slate-400 mb-1">Decoded Token:</div>
                    <pre class="text-slate-300 overflow-x-auto"><code class="language-json">${JSON.stringify(decodeJWT(data.token), null, 2)}</code></pre>
                </div>
            ` : ''}

            ${event.type === 'API' ? `
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <div class="text-slate-400 mb-1">Request</div>
                        <div class="text-slate-300">
                            <span class="method-badge method-${(data.method || 'GET').toLowerCase()} text-xs">${data.method || 'GET'}</span>
                            <span class="ml-2">${data.url || data.path || '/'}</span>
                        </div>
                    </div>
                    <div>
                        <div class="text-slate-400 mb-1">Response</div>
                        <div class="text-slate-300">
                            <span class="status-code ${data.status >= 200 && data.status < 400 ? 'status-2xx' : 'status-4xx'}">${data.status || '-'}</span>
                            <span class="ml-2">${data.duration || 0}ms</span>
                        </div>
                    </div>
                </div>
            ` : ''}

            <div class="mt-3">
                <div class="text-slate-400 mb-1">Raw Data:</div>
                <pre class="text-slate-300 overflow-x-auto max-h-48"><code class="language-json">${JSON.stringify(data, null, 2)}</code></pre>
            </div>
        </div>
    `;
}

function getEventSummary(event) {
    const data = event.data || event;

    switch (event.type) {
        case 'CONTEXT_SWITCH':
            return `Switched to ${data.tenant?.name || data.tenantId || 'new context'}`;
        case 'API':
            return `${data.method || 'GET'} ${data.path || data.url || '/'}`;
        case 'TOKEN':
            return data.action || 'Token event';
        case 'AUTH':
            return data.event || 'Authentication event';
        case 'OPA':
            return `${data.action || 'policy check'} - ${data.allowed ? 'Allow' : 'Deny'}`;
        case 'ERROR':
            return data.message || 'Error occurred';
        default:
            return data.message || data.action || 'Event';
    }
}

function decodeJWT(token) {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return { error: 'Invalid token format' };
        return {
            header: JSON.parse(atob(parts[0])),
            payload: JSON.parse(atob(parts[1]))
        };
    } catch {
        return { error: 'Failed to decode token' };
    }
}

async function loadSessions() {
    try {
        const response = await debugApi.getSessions();
        const sessions = response?.sessions || response || [];

        const select = document.getElementById('session-select');
        if (select) {
            select.innerHTML = '<option value="">Select session...</option>';
            sessions.forEach(session => {
                const option = document.createElement('option');
                option.value = session.id;
                option.textContent = `${session.user?.email || session.id.substring(0, 12)} - ${new Date(session.started_at).toLocaleTimeString()}`;
                if (session.id === sessionId) option.selected = true;
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Failed to load sessions:', error);
    }
}

async function loadTimeline() {
    if (!sessionId) {
        events = [];
        updateView();
        return;
    }

    try {
        const response = await debugApi.getSessionTimeline(sessionId);
        events = response?.events || response || [];
        debugState.set('workflows.sessionEvents', events);
        updateView();
    } catch (error) {
        console.error('Failed to load timeline:', error);
        events = [];
        updateView();
    }
}

function updateView() {
    const container = document.getElementById('timeline-container');
    if (container) {
        container.innerHTML = sessionId ? renderTimeline() : renderNoSession();
    }

    const summary = document.getElementById('timeline-summary');
    if (summary) {
        summary.innerHTML = renderSummaryCards();
    }

    // Highlight code
    if (window.hljs) {
        document.querySelectorAll('#timeline-container pre code').forEach(block => {
            window.hljs.highlightElement(block);
        });
    }
}

async function exportTimeline(format = 'json') {
    if (!sessionId) return;

    try {
        const data = await debugApi.exportSession(sessionId, format);
        const blob = new Blob(
            [format === 'json' ? JSON.stringify(data, null, 2) : data],
            { type: format === 'json' ? 'application/json' : 'text/csv' }
        );
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `session-${sessionId}.${format}`;
        a.click();
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Failed to export timeline:', error);
    }
}

function init() {
    loadSessions();

    if (sessionId) {
        loadTimeline();
    }

    // Session select
    document.getElementById('session-select')?.addEventListener('change', (e) => {
        sessionId = e.target.value;
        debugState.set('workflows.currentSession', sessionId);
        loadTimeline();
    });

    // Refresh button
    document.getElementById('refresh-timeline')?.addEventListener('click', loadTimeline);

    // Export button
    document.getElementById('export-timeline')?.addEventListener('click', () => exportTimeline('json'));

    // Expand/collapse events
    document.addEventListener('click', (e) => {
        const expandBtn = e.target.closest('[data-expand]');
        if (expandBtn) {
            const eventId = expandBtn.getAttribute('data-expand');
            if (expandedEvents.has(eventId)) {
                expandedEvents.delete(eventId);
            } else {
                expandedEvents.add(eventId);
            }
            updateView();
        }
    });

    if (window.lucide) window.lucide.createIcons();
}

export default { render, init };
