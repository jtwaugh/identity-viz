/**
 * Replay Controls Component
 * Step through session events with before/after state comparison
 */

import debugApi from '../../api.js';
import debugState from '../../state.js';

let sessionId = null;
let events = [];
let currentStep = 0;
let isPlaying = false;
let playInterval = null;
let playSpeed = 1000; // ms between steps

function render() {
    sessionId = debugState.get('workflows.currentSession');
    events = debugState.get('workflows.sessionEvents') || [];

    return `
        <div class="space-y-4">
            <div class="flex items-center justify-between">
                <h2 class="text-lg font-semibold text-slate-100">Session Replay</h2>
                <div class="flex items-center gap-3">
                    <select id="replay-session-select" class="debug-select">
                        <option value="">Select session...</option>
                    </select>
                    <select id="playback-speed" class="debug-select">
                        <option value="2000">0.5x Speed</option>
                        <option value="1000" selected>1x Speed</option>
                        <option value="500">2x Speed</option>
                        <option value="250">4x Speed</option>
                    </select>
                </div>
            </div>

            ${sessionId && events.length > 0 ? renderReplayInterface() : renderNoSession()}
        </div>
    `;
}

function renderNoSession() {
    return `
        <div class="debug-card">
            <div class="flex items-center justify-center h-64 text-slate-500">
                <div class="text-center">
                    <div class="text-4xl mb-3">&#9654;</div>
                    <div class="text-sm">Select a session to replay</div>
                    <div class="text-xs mt-2 text-slate-600">View the Session Timeline first to select a session</div>
                </div>
            </div>
        </div>
    `;
}

function renderReplayInterface() {
    const currentEvent = events[currentStep];
    const prevEvent = currentStep > 0 ? events[currentStep - 1] : null;

    return `
        <!-- Step Indicator -->
        <div class="debug-card">
            <div class="p-4">
                <div class="flex items-center justify-between mb-3">
                    <span class="text-sm font-medium text-slate-300">
                        Step ${currentStep + 1} of ${events.length}
                    </span>
                    <span class="text-xs text-slate-400">
                        ${currentEvent ? new Date(currentEvent.timestamp).toLocaleString() : '-'}
                    </span>
                </div>

                <!-- Progress Bar -->
                <div class="relative h-2 bg-slate-800 rounded-full overflow-hidden mb-4">
                    <div class="absolute inset-y-0 left-0 bg-blue-500 transition-all duration-300"
                         style="width: ${((currentStep + 1) / events.length) * 100}%"></div>
                </div>

                <!-- Playback Controls -->
                <div class="flex items-center justify-center gap-4">
                    <button id="step-first" class="debug-btn debug-btn-secondary py-2 px-3" ${currentStep === 0 ? 'disabled' : ''}>
                        <i data-lucide="skip-back" class="w-4 h-4"></i>
                    </button>
                    <button id="step-back" class="debug-btn debug-btn-secondary py-2 px-3" ${currentStep === 0 ? 'disabled' : ''}>
                        <i data-lucide="chevron-left" class="w-4 h-4"></i>
                    </button>
                    <button id="play-pause" class="debug-btn ${isPlaying ? 'debug-btn-danger' : 'debug-btn-primary'} py-2 px-6">
                        <i data-lucide="${isPlaying ? 'pause' : 'play'}" class="w-5 h-5"></i>
                        <span class="ml-2">${isPlaying ? 'Pause' : 'Play'}</span>
                    </button>
                    <button id="step-forward" class="debug-btn debug-btn-secondary py-2 px-3" ${currentStep >= events.length - 1 ? 'disabled' : ''}>
                        <i data-lucide="chevron-right" class="w-4 h-4"></i>
                    </button>
                    <button id="step-last" class="debug-btn debug-btn-secondary py-2 px-3" ${currentStep >= events.length - 1 ? 'disabled' : ''}>
                        <i data-lucide="skip-forward" class="w-4 h-4"></i>
                    </button>
                </div>

                <!-- Progress Slider -->
                <div class="mt-4">
                    <input type="range"
                           id="progress-slider"
                           min="0"
                           max="${events.length - 1}"
                           value="${currentStep}"
                           class="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer">
                </div>
            </div>
        </div>

        <!-- Current Step Details -->
        <div class="debug-card">
            <div class="debug-card-header">
                <span class="text-sm font-medium">Current Event</span>
                ${currentEvent ? `
                    <span class="px-2 py-0.5 text-xs rounded event-badge-${currentEvent.type?.toLowerCase() || 'audit'}">
                        ${currentEvent.type || 'EVENT'}
                    </span>
                ` : ''}
            </div>
            <div class="debug-card-body">
                ${currentEvent ? renderEventDetails(currentEvent) : '<span class="text-slate-500">No event</span>'}
            </div>
        </div>

        <!-- Before/After State Comparison -->
        <div class="grid grid-cols-2 gap-4">
            <div class="debug-card">
                <div class="debug-card-header">
                    <span class="text-sm font-medium">Before State</span>
                </div>
                <div class="debug-card-body p-0 max-h-64 overflow-auto">
                    ${prevEvent ? `
                        <pre class="code-block m-0 rounded-none text-xs"><code class="language-json">${JSON.stringify(getEventState(prevEvent), null, 2)}</code></pre>
                    ` : '<div class="p-4 text-slate-500 text-sm">Initial state</div>'}
                </div>
            </div>
            <div class="debug-card">
                <div class="debug-card-header">
                    <span class="text-sm font-medium">After State</span>
                </div>
                <div class="debug-card-body p-0 max-h-64 overflow-auto">
                    ${currentEvent ? `
                        <pre class="code-block m-0 rounded-none text-xs"><code class="language-json">${JSON.stringify(getEventState(currentEvent), null, 2)}</code></pre>
                    ` : '<div class="p-4 text-slate-500 text-sm">No state</div>'}
                </div>
            </div>
        </div>
    `;
}

function renderEventDetails(event) {
    const data = event.data || event;

    return `
        <div class="space-y-3">
            <div class="grid grid-cols-3 gap-4">
                <div>
                    <div class="text-xs text-slate-400">Type</div>
                    <div class="text-sm text-slate-200">${event.type || 'Unknown'}</div>
                </div>
                <div>
                    <div class="text-xs text-slate-400">Timestamp</div>
                    <div class="text-sm text-slate-200">${new Date(event.timestamp).toLocaleTimeString()}</div>
                </div>
                <div>
                    <div class="text-xs text-slate-400">Duration</div>
                    <div class="text-sm text-slate-200">${data.duration || '-'}ms</div>
                </div>
            </div>

            ${event.type === 'API' ? `
                <div class="p-3 bg-slate-900 rounded">
                    <div class="flex items-center gap-2 mb-2">
                        <span class="method-badge method-${(data.method || 'GET').toLowerCase()}">${data.method || 'GET'}</span>
                        <span class="text-sm text-slate-300">${data.url || data.path || '/'}</span>
                    </div>
                    <div class="flex items-center gap-4 text-xs">
                        <span class="status-code ${data.status >= 200 && data.status < 400 ? 'status-2xx' : 'status-4xx'}">
                            ${data.status || '-'}
                        </span>
                        <span class="text-slate-400">${data.duration || 0}ms</span>
                    </div>
                </div>
            ` : ''}

            ${event.type === 'CONTEXT_SWITCH' ? `
                <div class="p-3 bg-purple-500/10 border border-purple-500/30 rounded">
                    <div class="text-sm text-purple-300">
                        Switched to: <strong>${data.tenant?.name || data.tenantId || 'New Context'}</strong>
                    </div>
                </div>
            ` : ''}

            ${event.type === 'OPA' ? `
                <div class="p-3 ${data.allowed ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'} rounded">
                    <div class="text-sm ${data.allowed ? 'text-green-300' : 'text-red-300'}">
                        ${data.action || 'Policy Check'}: <strong>${data.allowed ? 'ALLOWED' : 'DENIED'}</strong>
                    </div>
                </div>
            ` : ''}
        </div>
    `;
}

function getEventState(event) {
    // Extract relevant state from event
    return {
        type: event.type,
        timestamp: event.timestamp,
        data: event.data || {},
        context: event.context || {}
    };
}

async function loadSessions() {
    try {
        const response = await debugApi.getSessions();
        const sessions = response?.sessions || response || [];

        const select = document.getElementById('replay-session-select');
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

async function loadEvents() {
    if (!sessionId) return;

    try {
        const response = await debugApi.getSessionTimeline(sessionId);
        events = response?.events || response || [];
        debugState.set('workflows.sessionEvents', events);
        currentStep = 0;
        updateView();
    } catch (error) {
        console.error('Failed to load events:', error);
    }
}

function updateView() {
    const container = document.querySelector('.space-y-4');
    if (container) {
        // Just update the dynamic parts
        const mainContent = container.querySelectorAll('.debug-card');
        if (mainContent.length > 0 && sessionId && events.length > 0) {
            container.innerHTML = render();
            setupEventHandlers();
            highlightCode();
        }
    }
}

function highlightCode() {
    if (window.hljs) {
        document.querySelectorAll('pre code').forEach(block => {
            window.hljs.highlightElement(block);
        });
    }
}

function goToStep(step) {
    currentStep = Math.max(0, Math.min(events.length - 1, step));
    updateView();
}

function play() {
    if (isPlaying) return;

    isPlaying = true;
    playInterval = setInterval(() => {
        if (currentStep >= events.length - 1) {
            pause();
        } else {
            currentStep++;
            updateView();
        }
    }, playSpeed);
    updateView();
}

function pause() {
    isPlaying = false;
    if (playInterval) {
        clearInterval(playInterval);
        playInterval = null;
    }
    updateView();
}

function setupEventHandlers() {
    // Session select
    document.getElementById('replay-session-select')?.addEventListener('change', (e) => {
        sessionId = e.target.value;
        debugState.set('workflows.currentSession', sessionId);
        loadEvents();
    });

    // Playback speed
    document.getElementById('playback-speed')?.addEventListener('change', (e) => {
        playSpeed = parseInt(e.target.value);
        if (isPlaying) {
            pause();
            play();
        }
    });

    // Play/Pause
    document.getElementById('play-pause')?.addEventListener('click', () => {
        if (isPlaying) {
            pause();
        } else {
            play();
        }
    });

    // Step controls
    document.getElementById('step-first')?.addEventListener('click', () => goToStep(0));
    document.getElementById('step-back')?.addEventListener('click', () => goToStep(currentStep - 1));
    document.getElementById('step-forward')?.addEventListener('click', () => goToStep(currentStep + 1));
    document.getElementById('step-last')?.addEventListener('click', () => goToStep(events.length - 1));

    // Progress slider
    document.getElementById('progress-slider')?.addEventListener('input', (e) => {
        goToStep(parseInt(e.target.value));
    });

    if (window.lucide) window.lucide.createIcons();
}

function init() {
    loadSessions();

    if (sessionId) {
        loadEvents();
    }

    setupEventHandlers();
}

export default { render, init };
