/**
 * Demo Controls Component
 * Controls for resetting data, injecting risk, simulating time, and service failures
 */

import debugApi from '../../api.js';
import debugState from '../../state.js';

// Risk presets
const RISK_PRESETS = {
    low: { score: 10, factors: {} },
    medium: { score: 45, factors: { off_hours: true, high_velocity: true } },
    high: { score: 85, factors: { new_device: true, unusual_location: true, vpn_proxy: true, high_velocity: true } }
};

// Time presets
const TIME_PRESETS = [
    { label: 'Business Hours (9 AM)', value: '09:00' },
    { label: 'Lunch Time (12 PM)', value: '12:00' },
    { label: 'End of Day (5 PM)', value: '17:00' },
    { label: 'After Hours (10 PM)', value: '22:00' },
    { label: 'Midnight', value: '00:00' },
    { label: 'Weekend', value: 'weekend' }
];

let currentRiskFactors = {};
let simulatedTime = null;
let serviceFailures = {
    backend: false,
    postgres: false,
    keycloak: false,
    opa: false
};

function render() {
    return `
        <div class="space-y-6">
            <h2 class="text-lg font-semibold text-slate-100">Demo Controls</h2>

            <!-- Data Reset Section -->
            <div class="debug-card">
                <div class="debug-card-header">
                    <span class="text-sm font-medium">Data Reset</span>
                    <span class="text-xs text-slate-400">Reset demo data to initial state</span>
                </div>
                <div class="debug-card-body">
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <button class="debug-btn debug-btn-danger reset-btn" data-reset="all">
                            <i data-lucide="refresh-cw" class="w-4 h-4"></i>
                            Reset All
                        </button>
                        <button class="debug-btn debug-btn-secondary reset-btn" data-reset="users">
                            <i data-lucide="users" class="w-4 h-4"></i>
                            Reset Users
                        </button>
                        <button class="debug-btn debug-btn-secondary reset-btn" data-reset="sessions">
                            <i data-lucide="activity" class="w-4 h-4"></i>
                            Reset Sessions
                        </button>
                        <button class="debug-btn debug-btn-secondary reset-btn" data-reset="audit">
                            <i data-lucide="file-text" class="w-4 h-4"></i>
                            Reset Audit
                        </button>
                    </div>
                </div>
            </div>

            <!-- Risk Injection Section -->
            <div class="debug-card">
                <div class="debug-card-header">
                    <span class="text-sm font-medium">Risk Injection</span>
                    <span class="text-xs text-slate-400">Inject risk factors into current session</span>
                </div>
                <div class="debug-card-body space-y-4">
                    <!-- Presets -->
                    <div>
                        <div class="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Presets</div>
                        <div class="flex gap-3">
                            <button class="debug-btn debug-btn-success risk-preset" data-preset="low">
                                Low Risk (10)
                            </button>
                            <button class="debug-btn debug-btn-secondary risk-preset" data-preset="medium" style="background: rgba(245, 158, 11, 0.2); color: #fcd34d; border-color: rgba(245, 158, 11, 0.3);">
                                Medium Risk (45)
                            </button>
                            <button class="debug-btn debug-btn-danger risk-preset" data-preset="high">
                                High Risk (85)
                            </button>
                            <button class="debug-btn debug-btn-secondary" id="clear-risk">
                                Clear
                            </button>
                        </div>
                    </div>

                    <!-- Custom Factors -->
                    <div>
                        <div class="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Custom Factors</div>
                        <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
                            ${renderRiskFactorCheckboxes()}
                        </div>
                    </div>

                    <!-- Apply Button -->
                    <div class="flex justify-end">
                        <button class="debug-btn debug-btn-primary" id="apply-risk-factors">
                            Apply Risk Factors
                        </button>
                    </div>
                </div>
            </div>

            <!-- Time Simulation Section -->
            <div class="debug-card">
                <div class="debug-card-header">
                    <span class="text-sm font-medium">Time Simulation</span>
                    <span class="text-xs text-slate-400">Simulate different times for policy testing</span>
                </div>
                <div class="debug-card-body space-y-4">
                    <!-- Current Time Display -->
                    <div class="p-3 bg-slate-900 rounded flex items-center justify-between">
                        <div>
                            <div class="text-xs text-slate-400">Current Simulated Time</div>
                            <div class="text-lg font-mono text-slate-200" id="current-time-display">
                                ${simulatedTime ? new Date(simulatedTime).toLocaleString() : 'Real Time'}
                            </div>
                        </div>
                        ${simulatedTime ? `
                            <span class="px-2 py-1 text-xs rounded bg-amber-500/20 text-amber-400">Simulated</span>
                        ` : `
                            <span class="px-2 py-1 text-xs rounded bg-green-500/20 text-green-400">Live</span>
                        `}
                    </div>

                    <!-- Time Presets -->
                    <div>
                        <div class="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Presets</div>
                        <div class="flex flex-wrap gap-2">
                            ${TIME_PRESETS.map(preset => `
                                <button class="debug-btn debug-btn-secondary text-xs py-1 time-preset" data-time="${preset.value}">
                                    ${preset.label}
                                </button>
                            `).join('')}
                        </div>
                    </div>

                    <!-- Custom DateTime -->
                    <div class="flex items-end gap-3">
                        <div class="flex-1">
                            <label class="text-xs font-medium text-slate-400 block mb-1">Custom Date/Time</label>
                            <input type="datetime-local"
                                   id="custom-datetime"
                                   class="debug-input">
                        </div>
                        <button class="debug-btn debug-btn-primary" id="set-custom-time">
                            Set Time
                        </button>
                        <button class="debug-btn debug-btn-secondary" id="clear-time">
                            Reset to Live
                        </button>
                    </div>
                </div>
            </div>

            <!-- Service Simulation Section -->
            <div class="debug-card">
                <div class="debug-card-header">
                    <span class="text-sm font-medium">Service Simulation</span>
                    <span class="text-xs text-slate-400">Simulate service failures for testing</span>
                </div>
                <div class="debug-card-body">
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                        ${renderServiceToggles()}
                    </div>
                    <div class="mt-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded text-xs text-amber-300">
                        <strong>Warning:</strong> Enabling service failures will cause errors in the main application. Use for testing error handling only.
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderRiskFactorCheckboxes() {
    const factors = [
        { id: 'new_device', label: 'New Device', weight: 30 },
        { id: 'unusual_location', label: 'Unusual Location', weight: 25 },
        { id: 'off_hours', label: 'Off Hours', weight: 15 },
        { id: 'high_velocity', label: 'High Velocity', weight: 20 },
        { id: 'failed_auth', label: 'Failed Auth', weight: 10 },
        { id: 'vpn_proxy', label: 'VPN/Proxy', weight: 15 }
    ];

    return factors.map(factor => `
        <label class="flex items-center gap-2 p-3 rounded bg-slate-800 cursor-pointer hover:bg-slate-700 transition-colors">
            <input type="checkbox"
                   class="risk-factor-cb"
                   data-factor="${factor.id}"
                   ${currentRiskFactors[factor.id] ? 'checked' : ''}>
            <span class="text-sm text-slate-300">${factor.label}</span>
            <span class="text-xs text-slate-500 ml-auto">+${factor.weight}</span>
        </label>
    `).join('');
}

function renderServiceToggles() {
    const services = [
        { id: 'backend', label: 'Backend API', icon: 'server' },
        { id: 'postgres', label: 'PostgreSQL', icon: 'database' },
        { id: 'keycloak', label: 'Keycloak', icon: 'key' },
        { id: 'opa', label: 'OPA', icon: 'shield' }
    ];

    return services.map(service => `
        <div class="p-4 rounded bg-slate-800 ${serviceFailures[service.id] ? 'border border-red-500/50' : ''}">
            <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-2">
                    <i data-lucide="${service.icon}" class="w-4 h-4 text-slate-400"></i>
                    <span class="text-sm font-medium text-slate-200">${service.label}</span>
                </div>
                <span class="w-2 h-2 rounded-full ${serviceFailures[service.id] ? 'bg-red-500' : 'bg-green-500'}"></span>
            </div>
            <label class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox"
                       class="service-toggle"
                       data-service="${service.id}"
                       ${serviceFailures[service.id] ? 'checked' : ''}>
                <span class="text-xs text-slate-400">Simulate Failure</span>
            </label>
        </div>
    `).join('');
}

async function resetData(type) {
    try {
        let response;
        switch (type) {
            case 'all':
                response = await debugApi.resetAll();
                break;
            case 'users':
                response = await debugApi.resetUsers();
                break;
            case 'sessions':
                response = await debugApi.resetSessions();
                break;
            case 'audit':
                response = await debugApi.resetAudit();
                break;
        }
        showToast('success', `${type === 'all' ? 'All data' : type.charAt(0).toUpperCase() + type.slice(1)} reset successfully`);
    } catch (error) {
        console.error('Failed to reset data:', error);
        showToast('error', `Failed to reset ${type}`);
    }
}

async function applyRiskFactors() {
    try {
        let score = 0;
        Object.entries(currentRiskFactors).forEach(([factor, enabled]) => {
            if (enabled) {
                const weights = { new_device: 30, unusual_location: 25, off_hours: 15, high_velocity: 20, failed_auth: 10, vpn_proxy: 15 };
                score += weights[factor] || 0;
            }
        });

        await debugApi.injectRisk({ score, factors: currentRiskFactors });
        showToast('success', `Risk score ${score} applied`);
    } catch (error) {
        console.error('Failed to apply risk:', error);
        showToast('error', 'Failed to apply risk factors');
    }
}

async function setTime(timestamp) {
    try {
        await debugApi.setSimulatedTime(timestamp);
        simulatedTime = timestamp;
        updateTimeDisplay();
        showToast('success', 'Time simulation enabled');
    } catch (error) {
        console.error('Failed to set time:', error);
        showToast('error', 'Failed to set simulated time');
    }
}

async function clearTime() {
    try {
        await debugApi.clearSimulatedTime();
        simulatedTime = null;
        updateTimeDisplay();
        showToast('success', 'Time simulation cleared');
    } catch (error) {
        console.error('Failed to clear time:', error);
        showToast('error', 'Failed to clear simulated time');
    }
}

async function toggleServiceFailure(service, enabled) {
    try {
        await debugApi.simulateFailure(service, enabled);
        serviceFailures[service] = enabled;
        showToast(enabled ? 'warning' : 'success', `${service} failure ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
        console.error('Failed to toggle service failure:', error);
        showToast('error', 'Failed to toggle service failure');
    }
}

function updateTimeDisplay() {
    const display = document.getElementById('current-time-display');
    if (display) {
        display.textContent = simulatedTime ? new Date(simulatedTime).toLocaleString() : 'Real Time';
    }
}

function showToast(type, message) {
    if (window.debugApp?.showToast) {
        window.debugApp.showToast(type, message);
    }
}

function init() {
    // Reset buttons
    document.querySelectorAll('.reset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const type = btn.getAttribute('data-reset');
            if (confirm(`Are you sure you want to reset ${type === 'all' ? 'all data' : type}?`)) {
                resetData(type);
            }
        });
    });

    // Risk presets
    document.querySelectorAll('.risk-preset').forEach(btn => {
        btn.addEventListener('click', () => {
            const preset = btn.getAttribute('data-preset');
            currentRiskFactors = { ...RISK_PRESETS[preset].factors };

            // Update checkboxes
            document.querySelectorAll('.risk-factor-cb').forEach(cb => {
                cb.checked = currentRiskFactors[cb.getAttribute('data-factor')] || false;
            });

            applyRiskFactors();
        });
    });

    // Clear risk
    document.getElementById('clear-risk')?.addEventListener('click', async () => {
        currentRiskFactors = {};
        document.querySelectorAll('.risk-factor-cb').forEach(cb => {
            cb.checked = false;
        });
        try {
            await debugApi.clearRisk();
            showToast('success', 'Risk factors cleared');
        } catch (error) {
            console.error('Failed to clear risk:', error);
        }
    });

    // Risk factor checkboxes
    document.querySelectorAll('.risk-factor-cb').forEach(cb => {
        cb.addEventListener('change', () => {
            currentRiskFactors[cb.getAttribute('data-factor')] = cb.checked;
        });
    });

    // Apply risk button
    document.getElementById('apply-risk-factors')?.addEventListener('click', applyRiskFactors);

    // Time presets
    document.querySelectorAll('.time-preset').forEach(btn => {
        btn.addEventListener('click', () => {
            const timeValue = btn.getAttribute('data-time');
            let timestamp;

            if (timeValue === 'weekend') {
                const now = new Date();
                const daysUntilSaturday = (6 - now.getDay() + 7) % 7 || 7;
                timestamp = new Date(now.getTime() + daysUntilSaturday * 24 * 60 * 60 * 1000);
                timestamp.setHours(10, 0, 0, 0);
            } else {
                const [hours, minutes] = timeValue.split(':');
                timestamp = new Date();
                timestamp.setHours(parseInt(hours), parseInt(minutes), 0, 0);
            }

            setTime(timestamp.toISOString());
        });
    });

    // Custom time
    document.getElementById('set-custom-time')?.addEventListener('click', () => {
        const input = document.getElementById('custom-datetime');
        if (input?.value) {
            setTime(new Date(input.value).toISOString());
        }
    });

    // Clear time
    document.getElementById('clear-time')?.addEventListener('click', clearTime);

    // Service toggles
    document.querySelectorAll('.service-toggle').forEach(toggle => {
        toggle.addEventListener('change', () => {
            const service = toggle.getAttribute('data-service');
            toggleServiceFailure(service, toggle.checked);
        });
    });

    if (window.lucide) window.lucide.createIcons();
}

export default { render, init };
