/**
 * Live Events Bottom Panel Component
 * Shows real-time events from the system
 */

import debugState from '../state.js';
import { EVENT_ICONS } from '../sse.js';

// Event type colors
const EVENT_COLORS = {
    UI: 'event-badge-ui',
    API: 'event-badge-api',
    OPA: 'event-badge-opa',
    DB: 'event-badge-db',
    AUTH: 'event-badge-auth',
    TOKEN: 'event-badge-token',
    AUDIT: 'event-badge-audit',
    ERROR: 'event-badge-error'
};

/**
 * Format timestamp for display
 */
function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        fractionalSecondDigits: 3
    });
}

/**
 * Get event summary text
 */
function getEventSummary(event) {
    const data = event.data || {};

    switch (event.type) {
        case 'UI':
            return data.action || data.message || 'UI interaction';
        case 'API':
            return `${data.method || 'GET'} ${data.path || data.url || '/'}`;
        case 'OPA':
            return `${data.action || 'policy check'} ${data.allowed ? '(allow)' : '(deny)'}`;
        case 'DB':
            return `${data.operation || 'query'} ${data.table || ''}`;
        case 'AUTH':
            return data.event || data.message || 'Auth event';
        case 'TOKEN':
            return data.action || data.message || 'Token event';
        case 'AUDIT':
            return `${data.action || 'action'} by ${data.user || 'unknown'}`;
        case 'ERROR':
            return data.message || 'Error occurred';
        default:
            return data.message || JSON.stringify(data).slice(0, 50);
    }
}

/**
 * Render a single event row
 */
function renderEventRow(event) {
    const colorClass = EVENT_COLORS[event.type] || 'event-badge-audit';
    const icon = EVENT_ICONS[event.type] || '&#128196;';
    const summary = getEventSummary(event);

    // Check if this is test traffic (requestSource is in details from backend)
    const data = event.data || {};
    const details = data.details || {};
    const requestSource = details.requestSource || data.requestSource;
    const isTestTraffic = requestSource && requestSource !== 'user';
    const testBadge = isTestTraffic
        ? `<span class="px-1.5 py-0.5 text-xs rounded bg-purple-600/30 text-purple-300 border border-purple-500/30" title="Source: ${requestSource}">TEST</span>`
        : '';

    return `
        <div class="flex items-center gap-3 px-3 py-1.5 hover:bg-slate-800/50 cursor-pointer border-b border-slate-700/30"
             data-event-id="${event.id}">
            <span class="text-slate-500 w-20 flex-shrink-0">${formatTimestamp(event.timestamp)}</span>
            <span class="event-badge ${colorClass}">
                <span>${icon}</span>
                <span>${event.type}</span>
            </span>
            ${testBadge}
            <span class="text-slate-300 truncate flex-1">${summary}</span>
        </div>
    `;
}

/**
 * Check if an event is from test traffic
 */
function isTestTrafficEvent(event) {
    const data = event.data || {};
    const details = data.details || {};
    const requestSource = details.requestSource || data.requestSource;
    return requestSource && requestSource !== 'user';
}

/**
 * Render all events
 */
function renderEvents() {
    const events = debugState.get('events') || [];
    const filter = debugState.get('eventsFilter') || 'all';

    // Filter events
    let filteredEvents;
    if (filter === 'all') {
        filteredEvents = events;
    } else if (filter === 'test-only') {
        filteredEvents = events.filter(e => isTestTrafficEvent(e));
    } else if (filter === 'user-only') {
        filteredEvents = events.filter(e => !isTestTrafficEvent(e));
    } else {
        filteredEvents = events.filter(e => e.type === filter);
    }

    if (filteredEvents.length === 0) {
        return `
            <div class="flex items-center justify-center h-full text-slate-500 text-sm">
                ${filter === 'all' ? 'No events yet' : `No ${filter} events`}
            </div>
        `;
    }

    return filteredEvents.map(renderEventRow).join('');
}

/**
 * Update the event count badge
 */
function updateEventCount() {
    const events = debugState.get('events') || [];
    const countEl = document.getElementById('event-count');
    if (countEl) {
        countEl.textContent = events.length;
    }
}

/**
 * Export events to JSON
 */
function exportEvents() {
    const events = debugState.get('events') || [];
    const blob = new Blob([JSON.stringify(events, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `debug-events-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

/**
 * Initialize the live events panel
 */
export function initLiveEvents() {
    const container = document.getElementById('events-container');
    const filterSelect = document.getElementById('event-filter');
    const pauseBtn = document.getElementById('pause-events-btn');
    const clearBtn = document.getElementById('clear-events-btn');
    const exportBtn = document.getElementById('export-events-btn');

    if (!container) return;

    // Initial render
    container.innerHTML = renderEvents();
    updateEventCount();

    // Filter change handler
    if (filterSelect) {
        filterSelect.addEventListener('change', (e) => {
            debugState.set('eventsFilter', e.target.value);
            container.innerHTML = renderEvents();
        });
    }

    // Pause/Resume handler
    if (pauseBtn) {
        pauseBtn.addEventListener('click', () => {
            const isPaused = debugState.get('eventsPaused');
            debugState.set('eventsPaused', !isPaused);
            pauseBtn.textContent = isPaused ? 'Pause' : 'Resume';
            pauseBtn.classList.toggle('bg-amber-600/20', !isPaused);
        });
    }

    // Clear handler
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            debugState.clearEvents();
        });
    }

    // Export handler
    if (exportBtn) {
        exportBtn.addEventListener('click', exportEvents);
    }

    // Subscribe to events changes
    debugState.subscribe('events', () => {
        container.innerHTML = renderEvents();
        updateEventCount();

        // Auto-scroll to top (newest events)
        container.scrollTop = 0;
    });

    // Event click handler - show details
    container.addEventListener('click', (e) => {
        const row = e.target.closest('[data-event-id]');
        if (row) {
            const eventId = row.getAttribute('data-event-id');
            const events = debugState.get('events') || [];
            const event = events.find(e => e.id === eventId);

            if (event) {
                showEventDetails(event);
            }
        }
    });
}

/**
 * Show event details in slide-over
 */
function showEventDetails(event) {
    const html = `
        <div class="space-y-4">
            <div class="flex items-center gap-3">
                <span class="event-badge ${EVENT_COLORS[event.type] || 'event-badge-audit'}">
                    <span>${EVENT_ICONS[event.type] || '&#128196;'}</span>
                    <span>${event.type}</span>
                </span>
                <span class="text-sm text-slate-400">${formatTimestamp(event.timestamp)}</span>
            </div>

            <div>
                <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Event ID</h4>
                <code class="text-sm text-slate-300 font-mono">${event.id}</code>
            </div>

            <div>
                <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Data</h4>
                <pre class="code-block bg-slate-900 p-3 rounded overflow-x-auto"><code class="language-json">${JSON.stringify(event.data, null, 2)}</code></pre>
            </div>
        </div>
    `;

    debugState.openSlideOver(`${event.type} Event Details`, { html });

    // Highlight JSON
    setTimeout(() => {
        if (window.hljs) {
            document.querySelectorAll('#slide-over-content pre code').forEach(block => {
                window.hljs.highlightElement(block);
            });
        }
    }, 10);
}

export default {
    initLiveEvents,
    renderEvents,
    exportEvents
};
