/**
 * Risk Breakdown Component
 * Visual breakdown of risk score calculation
 */

import debugApi from '../../api.js';
import debugState from '../../state.js';

// Risk factors with weights
const RISK_FACTORS = [
    { id: 'new_device', name: 'New Device', weight: 30, icon: '&#128241;' },
    { id: 'unusual_location', name: 'Unusual Location', weight: 25, icon: '&#128205;' },
    { id: 'off_hours', name: 'Off Hours Access', weight: 15, icon: '&#128337;' },
    { id: 'high_velocity', name: 'High Velocity', weight: 20, icon: '&#9889;' },
    { id: 'failed_auth', name: 'Failed Auth Attempts', weight: 10, icon: '&#9888;' },
    { id: 'vpn_proxy', name: 'VPN/Proxy Detected', weight: 15, icon: '&#128373;' }
];

// Action thresholds
const ACTION_THRESHOLDS = [
    { action: 'view_balance', threshold: 80, label: 'View Balance' },
    { action: 'view_transactions', threshold: 70, label: 'View Transactions' },
    { action: 'internal_transfer', threshold: 50, label: 'Internal Transfer' },
    { action: 'external_transfer', threshold: 30, label: 'External Transfer' },
    { action: 'wire_transfer', threshold: 10, label: 'Wire Transfer' }
];

let currentRiskScore = null;
let currentFactors = {};

function render() {
    // Get current risk data from state or use defaults
    const riskData = debugState.get('policy.currentRisk') || {
        score: 0,
        factors: {}
    };
    currentRiskScore = riskData.score;
    currentFactors = riskData.factors;

    return `
        <div class="space-y-6">
            <div class="flex items-center justify-between">
                <h2 class="text-lg font-semibold text-slate-100">Risk Analysis</h2>
                <button id="refresh-risk" class="debug-btn debug-btn-secondary">
                    <i data-lucide="refresh-cw" class="w-4 h-4"></i>
                    Refresh
                </button>
            </div>

            <!-- Current Risk Score -->
            <div class="debug-card">
                <div class="debug-card-header">
                    <span class="text-sm font-medium">Current Risk Score</span>
                </div>
                <div class="debug-card-body">
                    <div class="flex items-center gap-6">
                        <div class="text-center">
                            <div class="text-5xl font-bold ${getRiskScoreColor(currentRiskScore)}">
                                ${currentRiskScore ?? 0}
                            </div>
                            <div class="text-xs text-slate-400 mt-1">out of 100</div>
                        </div>
                        <div class="flex-1">
                            <div class="risk-bar h-4 rounded-full relative">
                                <div class="risk-indicator" style="left: ${currentRiskScore ?? 0}%"></div>
                            </div>
                            <div class="flex justify-between text-xs text-slate-500 mt-2">
                                <span>Low Risk</span>
                                <span>Medium</span>
                                <span>High Risk</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Risk Factors Breakdown -->
            <div class="debug-card">
                <div class="debug-card-header">
                    <span class="text-sm font-medium">Risk Factors</span>
                    <span class="text-xs text-slate-400">Click to toggle simulation</span>
                </div>
                <div class="debug-card-body">
                    <div class="space-y-4">
                        ${RISK_FACTORS.map(factor => renderFactorBar(factor)).join('')}
                    </div>
                </div>
            </div>

            <!-- Action Thresholds -->
            <div class="debug-card">
                <div class="debug-card-header">
                    <span class="text-sm font-medium">Action Thresholds</span>
                    <span class="text-xs text-slate-400">Actions blocked at current risk level</span>
                </div>
                <div class="debug-card-body">
                    <div class="space-y-3">
                        ${ACTION_THRESHOLDS.map(action => renderThresholdBar(action)).join('')}
                    </div>
                </div>
            </div>

            <!-- Risk Calculator -->
            <div class="debug-card">
                <div class="debug-card-header">
                    <span class="text-sm font-medium">Risk Calculator</span>
                </div>
                <div class="debug-card-body">
                    <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
                        ${RISK_FACTORS.map(factor => `
                            <label class="flex items-center gap-2 p-3 rounded bg-slate-800 cursor-pointer hover:bg-slate-700 transition-colors">
                                <input type="checkbox"
                                       class="risk-factor-checkbox"
                                       data-factor="${factor.id}"
                                       data-weight="${factor.weight}"
                                       ${currentFactors[factor.id] ? 'checked' : ''}>
                                <span class="text-sm text-slate-300">${factor.name}</span>
                                <span class="text-xs text-slate-500 ml-auto">+${factor.weight}</span>
                            </label>
                        `).join('')}
                    </div>
                    <div class="mt-4 flex items-center justify-between">
                        <div class="text-sm text-slate-400">
                            Calculated Score: <span class="font-semibold ${getRiskScoreColor(currentRiskScore)}">${currentRiskScore ?? 0}</span>
                        </div>
                        <div class="flex gap-2">
                            <button id="apply-risk" class="debug-btn debug-btn-primary">
                                Apply to Session
                            </button>
                            <button id="reset-risk" class="debug-btn debug-btn-secondary">
                                Reset
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderFactorBar(factor) {
    const isActive = currentFactors[factor.id];
    const contribution = isActive ? factor.weight : 0;

    return `
        <div class="flex items-center gap-4 factor-row" data-factor="${factor.id}">
            <div class="w-8 text-center text-lg">${factor.icon}</div>
            <div class="flex-1">
                <div class="flex items-center justify-between mb-1">
                    <span class="text-sm text-slate-300">${factor.name}</span>
                    <span class="text-xs ${isActive ? 'text-red-400' : 'text-slate-500'}">
                        ${isActive ? `+${factor.weight}` : '0'}
                    </span>
                </div>
                <div class="h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div class="h-full ${isActive ? 'bg-red-500' : 'bg-slate-700'} transition-all duration-300"
                         style="width: ${(contribution / factor.weight) * 100}%"></div>
                </div>
            </div>
            <div class="text-xs text-slate-500 w-16 text-right">
                max ${factor.weight}
            </div>
        </div>
    `;
}

function renderThresholdBar(action) {
    const blocked = currentRiskScore >= action.threshold;

    return `
        <div class="flex items-center gap-4">
            <div class="w-32 text-sm text-slate-300">${action.label}</div>
            <div class="flex-1 relative">
                <div class="h-6 bg-slate-800 rounded overflow-hidden">
                    <!-- Green zone (allowed) -->
                    <div class="absolute inset-y-0 left-0 bg-green-500/30"
                         style="width: ${action.threshold}%"></div>
                    <!-- Current score indicator -->
                    <div class="absolute top-0 bottom-0 w-0.5 bg-white"
                         style="left: ${currentRiskScore ?? 0}%"></div>
                    <!-- Threshold marker -->
                    <div class="absolute top-0 bottom-0 w-0.5 bg-red-500"
                         style="left: ${action.threshold}%"></div>
                </div>
                <div class="absolute -top-1 text-xs text-red-400"
                     style="left: ${action.threshold}%; transform: translateX(-50%)">
                    ${action.threshold}
                </div>
            </div>
            <div class="w-20">
                <span class="px-2 py-0.5 text-xs rounded ${blocked ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}">
                    ${blocked ? 'Blocked' : 'Allowed'}
                </span>
            </div>
        </div>
    `;
}

function getRiskScoreColor(score) {
    if (score === null || score === undefined) return 'text-slate-400';
    if (score < 30) return 'text-green-400';
    if (score < 50) return 'text-amber-400';
    return 'text-red-400';
}

function calculateRiskScore() {
    let score = 0;
    RISK_FACTORS.forEach(factor => {
        if (currentFactors[factor.id]) {
            score += factor.weight;
        }
    });
    return Math.min(100, score);
}

function updateView() {
    currentRiskScore = calculateRiskScore();

    // Update all factor bars
    RISK_FACTORS.forEach(factor => {
        const row = document.querySelector(`.factor-row[data-factor="${factor.id}"]`);
        if (row) {
            row.innerHTML = renderFactorBar(factor).replace(/<div[^>]*factor-row[^>]*>/, '').replace(/<\/div>$/, '');
        }
    });

    // Update threshold bars
    const thresholdContainer = document.querySelector('.debug-card:nth-child(3) .debug-card-body');
    if (thresholdContainer) {
        thresholdContainer.innerHTML = `
            <div class="space-y-3">
                ${ACTION_THRESHOLDS.map(action => renderThresholdBar(action)).join('')}
            </div>
        `;
    }

    // Update score display
    const scoreDisplay = document.querySelector('.text-5xl');
    if (scoreDisplay) {
        scoreDisplay.textContent = currentRiskScore;
        scoreDisplay.className = `text-5xl font-bold ${getRiskScoreColor(currentRiskScore)}`;
    }

    // Update score indicator position
    const indicator = document.querySelector('.risk-indicator');
    if (indicator) {
        indicator.style.left = `${currentRiskScore}%`;
    }

    // Update state
    debugState.set('policy.currentRisk', {
        score: currentRiskScore,
        factors: { ...currentFactors }
    });
}

async function applyRiskToSession() {
    try {
        await debugApi.injectRisk({
            score: currentRiskScore,
            factors: currentFactors
        });
        window.debugApp?.showToast('success', `Risk score ${currentRiskScore} applied to session`);
    } catch (error) {
        console.error('Failed to apply risk:', error);
        window.debugApp?.showToast('error', 'Failed to apply risk factors');
    }
}

async function resetRisk() {
    try {
        currentFactors = {};
        currentRiskScore = 0;

        // Uncheck all checkboxes
        document.querySelectorAll('.risk-factor-checkbox').forEach(cb => {
            cb.checked = false;
        });

        await debugApi.clearRisk();
        updateView();
        window.debugApp?.showToast('success', 'Risk factors cleared');
    } catch (error) {
        console.error('Failed to reset risk:', error);
    }
}

function init() {
    // Checkbox handlers
    document.querySelectorAll('.risk-factor-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const factorId = e.target.getAttribute('data-factor');
            currentFactors[factorId] = e.target.checked;
            updateView();
        });
    });

    // Apply button
    document.getElementById('apply-risk')?.addEventListener('click', applyRiskToSession);

    // Reset button
    document.getElementById('reset-risk')?.addEventListener('click', resetRisk);

    // Refresh button
    document.getElementById('refresh-risk')?.addEventListener('click', async () => {
        try {
            const health = await debugApi.getHealth();
            // Update from current session risk if available
            if (health?.riskScore !== undefined) {
                currentRiskScore = health.riskScore;
                updateView();
            }
        } catch (error) {
            console.error('Failed to refresh risk:', error);
        }
    });

    if (window.lucide) window.lucide.createIcons();
}

export default { render, init };
