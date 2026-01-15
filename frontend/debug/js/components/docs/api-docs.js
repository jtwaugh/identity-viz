/**
 * API Documentation Component
 * Embeds Swagger UI for API documentation
 */

function render() {
    return `
        <div class="space-y-4">
            <div class="flex items-center justify-between">
                <h2 class="text-lg font-semibold text-slate-100">API Documentation</h2>
                <div class="flex items-center gap-3">
                    <a href="/swagger-ui.html"
                       target="_blank"
                       class="debug-btn debug-btn-secondary">
                        <i data-lucide="external-link" class="w-4 h-4"></i>
                        Open in New Tab
                    </a>
                    <a href="/v3/api-docs"
                       target="_blank"
                       class="debug-btn debug-btn-secondary">
                        <i data-lucide="file-json" class="w-4 h-4"></i>
                        OpenAPI JSON
                    </a>
                </div>
            </div>

            <!-- Quick Reference -->
            <div class="debug-card">
                <div class="debug-card-header">
                    <span class="text-sm font-medium">Quick Reference</span>
                </div>
                <div class="debug-card-body">
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                            <div class="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Auth</div>
                            <div class="space-y-1 text-sm">
                                <div class="flex items-center gap-2">
                                    <span class="method-badge method-get text-xs">GET</span>
                                    <span class="text-slate-300">/auth/me</span>
                                </div>
                                <div class="flex items-center gap-2">
                                    <span class="method-badge method-post text-xs">POST</span>
                                    <span class="text-slate-300">/auth/token/exchange</span>
                                </div>
                                <div class="flex items-center gap-2">
                                    <span class="method-badge method-post text-xs">POST</span>
                                    <span class="text-slate-300">/auth/logout</span>
                                </div>
                            </div>
                        </div>
                        <div>
                            <div class="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Tenants</div>
                            <div class="space-y-1 text-sm">
                                <div class="flex items-center gap-2">
                                    <span class="method-badge method-get text-xs">GET</span>
                                    <span class="text-slate-300">/api/tenants</span>
                                </div>
                                <div class="flex items-center gap-2">
                                    <span class="method-badge method-get text-xs">GET</span>
                                    <span class="text-slate-300">/api/tenants/{id}</span>
                                </div>
                                <div class="flex items-center gap-2">
                                    <span class="method-badge method-post text-xs">POST</span>
                                    <span class="text-slate-300">/api/tenants/{id}/switch</span>
                                </div>
                            </div>
                        </div>
                        <div>
                            <div class="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Accounts</div>
                            <div class="space-y-1 text-sm">
                                <div class="flex items-center gap-2">
                                    <span class="method-badge method-get text-xs">GET</span>
                                    <span class="text-slate-300">/api/accounts</span>
                                </div>
                                <div class="flex items-center gap-2">
                                    <span class="method-badge method-get text-xs">GET</span>
                                    <span class="text-slate-300">/api/accounts/{id}</span>
                                </div>
                                <div class="flex items-center gap-2">
                                    <span class="method-badge method-post text-xs">POST</span>
                                    <span class="text-slate-300">/api/accounts/{id}/transfer</span>
                                </div>
                            </div>
                        </div>
                        <div>
                            <div class="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Admin</div>
                            <div class="space-y-1 text-sm">
                                <div class="flex items-center gap-2">
                                    <span class="method-badge method-get text-xs">GET</span>
                                    <span class="text-slate-300">/api/admin/users</span>
                                </div>
                                <div class="flex items-center gap-2">
                                    <span class="method-badge method-post text-xs">POST</span>
                                    <span class="text-slate-300">/api/admin/users/invite</span>
                                </div>
                                <div class="flex items-center gap-2">
                                    <span class="method-badge method-delete text-xs">DEL</span>
                                    <span class="text-slate-300">/api/admin/users/{id}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Swagger UI Iframe -->
            <div class="debug-card">
                <div class="debug-card-header">
                    <span class="text-sm font-medium">Interactive API Explorer</span>
                    <button id="reload-swagger" class="text-xs text-slate-400 hover:text-slate-200">
                        <i data-lucide="refresh-cw" class="w-3 h-3 inline"></i>
                        Reload
                    </button>
                </div>
                <div class="relative" style="height: 700px;">
                    <iframe id="swagger-frame"
                            src="/swagger-ui.html"
                            class="w-full h-full border-0 rounded-b bg-white"
                            title="Swagger UI">
                    </iframe>
                    <div id="swagger-loading" class="absolute inset-0 flex items-center justify-center bg-slate-800">
                        <div class="text-center">
                            <div class="spinner mx-auto mb-3"></div>
                            <div class="text-sm text-slate-400">Loading API documentation...</div>
                        </div>
                    </div>
                    <div id="swagger-error" class="absolute inset-0 flex items-center justify-center bg-slate-800 hidden">
                        <div class="text-center">
                            <div class="text-4xl mb-3">&#9888;</div>
                            <div class="text-sm text-slate-400 mb-4">Failed to load Swagger UI</div>
                            <button class="debug-btn debug-btn-primary" id="retry-swagger">
                                Retry
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Debug Endpoints -->
            <div class="debug-card">
                <div class="debug-card-header">
                    <span class="text-sm font-medium">Debug Endpoints</span>
                    <span class="text-xs text-slate-400">Available only in development</span>
                </div>
                <div class="debug-card-body">
                    <div class="grid grid-cols-2 gap-6">
                        <div>
                            <div class="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Data</div>
                            <div class="space-y-1 text-sm">
                                <div class="flex items-center gap-2">
                                    <span class="method-badge method-get text-xs">GET</span>
                                    <span class="text-slate-300">/debug/data/users</span>
                                </div>
                                <div class="flex items-center gap-2">
                                    <span class="method-badge method-get text-xs">GET</span>
                                    <span class="text-slate-300">/debug/data/tenants</span>
                                </div>
                                <div class="flex items-center gap-2">
                                    <span class="method-badge method-get text-xs">GET</span>
                                    <span class="text-slate-300">/debug/data/sessions</span>
                                </div>
                            </div>
                        </div>
                        <div>
                            <div class="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Controls</div>
                            <div class="space-y-1 text-sm">
                                <div class="flex items-center gap-2">
                                    <span class="method-badge method-post text-xs">POST</span>
                                    <span class="text-slate-300">/debug/controls/reset/*</span>
                                </div>
                                <div class="flex items-center gap-2">
                                    <span class="method-badge method-post text-xs">POST</span>
                                    <span class="text-slate-300">/debug/controls/risk/inject</span>
                                </div>
                                <div class="flex items-center gap-2">
                                    <span class="method-badge method-get text-xs">GET</span>
                                    <span class="text-slate-300">/debug/events/stream</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function init() {
    const iframe = document.getElementById('swagger-frame');
    const loading = document.getElementById('swagger-loading');
    const error = document.getElementById('swagger-error');

    if (iframe) {
        // Handle iframe load
        iframe.addEventListener('load', () => {
            if (loading) loading.style.display = 'none';
            if (error) error.classList.add('hidden');
        });

        // Handle iframe error
        iframe.addEventListener('error', () => {
            if (loading) loading.style.display = 'none';
            if (error) error.classList.remove('hidden');
        });

        // Check if iframe loaded after timeout
        setTimeout(() => {
            try {
                // Try to access iframe content (will fail if not loaded)
                const doc = iframe.contentDocument || iframe.contentWindow?.document;
                if (!doc || doc.readyState !== 'complete') {
                    if (loading) loading.style.display = 'none';
                    if (error) error.classList.remove('hidden');
                }
            } catch (e) {
                // Cross-origin, assume it loaded
                if (loading) loading.style.display = 'none';
            }
        }, 5000);
    }

    // Reload button
    document.getElementById('reload-swagger')?.addEventListener('click', () => {
        if (iframe) {
            if (loading) loading.style.display = 'flex';
            if (error) error.classList.add('hidden');
            iframe.src = iframe.src;
        }
    });

    // Retry button
    document.getElementById('retry-swagger')?.addEventListener('click', () => {
        if (iframe) {
            if (loading) loading.style.display = 'flex';
            if (error) error.classList.add('hidden');
            iframe.src = iframe.src;
        }
    });

    if (window.lucide) window.lucide.createIcons();
}

export default { render, init };
