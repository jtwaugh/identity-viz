/**
 * UI Utilities Module
 * Toast notifications, loading states, and other UI helpers
 */

import state from './state.js';

/**
 * Show loading overlay
 * @param {string} text - Loading text
 */
export function showLoading(text = 'Loading...') {
    state.update({
        'ui.loading': true,
        'ui.loadingText': text
    });

    const overlay = document.getElementById('loading-overlay');
    const loadingText = document.getElementById('loading-text');

    if (overlay) {
        overlay.classList.remove('hidden');
    }
    if (loadingText) {
        loadingText.textContent = text;
    }
}

/**
 * Hide loading overlay
 */
export function hideLoading() {
    state.set('ui.loading', false);

    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.classList.add('hidden');
    }
}

/**
 * Show toast notification
 * @param {string} message - Toast message
 * @param {string} type - Toast type (success, error, warning, info)
 * @param {number} duration - Duration in ms (default 5000)
 */
export function showToast(message, type = 'info', duration = 5000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const icons = {
        success: 'check-circle',
        error: 'x-circle',
        warning: 'alert-triangle',
        info: 'info'
    };

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <i data-lucide="${icons[type]}" class="w-5 h-5 flex-shrink-0"></i>
        <div class="flex-1">
            <p class="text-sm font-medium text-gray-900">${escapeHtml(message)}</p>
        </div>
        <button onclick="this.parentElement.remove()" class="text-gray-400 hover:text-gray-600">
            <i data-lucide="x" class="w-4 h-4"></i>
        </button>
    `;

    container.appendChild(toast);

    // Initialize icons in the toast
    if (window.lucide) {
        lucide.createIcons({ nodes: [toast] });
    }

    // Auto-remove after duration
    if (duration > 0) {
        setTimeout(() => {
            toast.style.animation = 'slideIn 0.3s ease reverse';
            setTimeout(() => toast.remove(), 280);
        }, duration);
    }
}

/**
 * Show modal dialog
 * @param {Object} options - Modal options
 * @returns {Promise} Resolves with result when closed
 */
export function showModal(options) {
    const {
        title,
        content,
        confirmText = 'Confirm',
        cancelText = 'Cancel',
        confirmClass = 'btn-primary',
        showCancel = true,
        onConfirm,
        onCancel
    } = options;

    return new Promise((resolve) => {
        const container = document.getElementById('modal-container');
        if (!container) {
            resolve(false);
            return;
        }

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2 class="text-lg font-semibold text-gray-900">${escapeHtml(title)}</h2>
                </div>
                <div class="modal-body">
                    ${typeof content === 'string' ? content : ''}
                </div>
                <div class="modal-footer">
                    ${showCancel ? `<button class="btn btn-secondary modal-cancel">${escapeHtml(cancelText)}</button>` : ''}
                    <button class="btn ${confirmClass} modal-confirm">${escapeHtml(confirmText)}</button>
                </div>
            </div>
        `;

        // Insert custom content if it's an element
        if (content instanceof HTMLElement) {
            modal.querySelector('.modal-body').appendChild(content);
        }

        // Close on backdrop click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal(false);
            }
        });

        // Cancel button
        const cancelBtn = modal.querySelector('.modal-cancel');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => closeModal(false));
        }

        // Confirm button
        const confirmBtn = modal.querySelector('.modal-confirm');
        confirmBtn.addEventListener('click', async () => {
            if (onConfirm) {
                const result = await onConfirm();
                if (result !== false) {
                    closeModal(true);
                }
            } else {
                closeModal(true);
            }
        });

        function closeModal(result) {
            if (result === false && onCancel) {
                onCancel();
            }
            modal.remove();
            resolve(result);
        }

        container.appendChild(modal);

        // Initialize icons
        if (window.lucide) {
            lucide.createIcons({ nodes: [modal] });
        }
    });
}

/**
 * Show confirmation dialog
 * @param {string} message - Confirmation message
 * @param {Object} options - Additional options
 * @returns {Promise<boolean>} True if confirmed
 */
export function confirm(message, options = {}) {
    return showModal({
        title: options.title || 'Confirm',
        content: `<p class="text-gray-600">${escapeHtml(message)}</p>`,
        confirmText: options.confirmText || 'Confirm',
        cancelText: options.cancelText || 'Cancel',
        confirmClass: options.danger ? 'btn-danger' : 'btn-primary'
    });
}

/**
 * Format currency amount
 * @param {number} amount - Amount to format
 * @param {string} currency - Currency code (default USD)
 * @returns {string} Formatted amount
 */
export function formatCurrency(amount, currency = 'USD') {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
}

/**
 * Format date
 * @param {string|Date} date - Date to format
 * @param {Object} options - Intl.DateTimeFormat options
 * @returns {string} Formatted date
 */
export function formatDate(date, options = {}) {
    const defaultOptions = {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    };
    return new Intl.DateTimeFormat('en-US', { ...defaultOptions, ...options }).format(new Date(date));
}

/**
 * Format relative time
 * @param {string|Date} date - Date to format
 * @returns {string} Relative time string
 */
export function formatRelativeTime(date) {
    const now = new Date();
    const past = new Date(date);
    const diffMs = now - past;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDate(date);
}

/**
 * Get greeting based on time of day
 * @returns {string} Greeting string
 */
export function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
}

/**
 * Escape HTML to prevent XSS
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
export function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
}

/**
 * Create element from HTML string
 * @param {string} html - HTML string
 * @returns {Element} DOM element
 */
export function createElement(html) {
    const template = document.createElement('template');
    template.innerHTML = html.trim();
    return template.content.firstChild;
}

/**
 * Get tenant type display info (icon, color, label)
 * @param {string} type - Tenant type
 * @returns {Object} Display info
 */
export function getTenantTypeInfo(type) {
    const types = {
        CONSUMER: { icon: 'user', color: 'consumer', label: 'Personal' },
        SMALL_BUSINESS: { icon: 'store', color: 'business', label: 'Small Business' },
        COMMERCIAL: { icon: 'briefcase', color: 'commercial', label: 'Commercial' },
        INVESTMENT: { icon: 'trending-up', color: 'investment', label: 'Investment' },
        TRUST: { icon: 'shield', color: 'trust', label: 'Trust' }
    };
    return types[type] || { icon: 'building', color: 'trust', label: type };
}

/**
 * Get role display info
 * @param {string} role - Role name
 * @returns {Object} Display info
 */
export function getRoleInfo(role) {
    const roles = {
        OWNER: { color: 'owner', label: 'Owner' },
        ADMIN: { color: 'admin', label: 'Admin' },
        OPERATOR: { color: 'operator', label: 'Operator' },
        VIEWER: { color: 'viewer', label: 'Viewer' }
    };
    return roles[role] || { color: 'viewer', label: role };
}

/**
 * Get account type display info
 * @param {string} type - Account type
 * @returns {Object} Display info
 */
export function getAccountTypeInfo(type) {
    const types = {
        CHECKING: { icon: 'wallet', label: 'Checking' },
        SAVINGS: { icon: 'piggy-bank', label: 'Savings' },
        MONEY_MARKET: { icon: 'landmark', label: 'Money Market' },
        CD: { icon: 'lock', label: 'Certificate of Deposit' },
        LOAN: { icon: 'credit-card', label: 'Loan' },
        CREDIT_LINE: { icon: 'credit-card', label: 'Credit Line' }
    };
    return types[type] || { icon: 'wallet', label: type };
}

/**
 * Mask account number (show last 4 digits)
 * @param {string} accountNumber - Account number
 * @returns {string} Masked account number
 */
export function maskAccountNumber(accountNumber) {
    if (!accountNumber) return '****';
    const last4 = accountNumber.slice(-4);
    return `****${last4}`;
}

// Export UI utilities
export default {
    showLoading,
    hideLoading,
    showToast,
    showModal,
    confirm,
    formatCurrency,
    formatDate,
    formatRelativeTime,
    getGreeting,
    escapeHtml,
    createElement,
    getTenantTypeInfo,
    getRoleInfo,
    getAccountTypeInfo,
    maskAccountNumber
};
