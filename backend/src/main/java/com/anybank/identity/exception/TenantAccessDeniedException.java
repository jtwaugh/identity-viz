package com.anybank.identity.exception;

import java.util.UUID;

/**
 * Exception thrown when a user attempts to access a tenant they don't have access to.
 *
 * This occurs during token exchange or when attempting actions in a tenant
 * where the user has no valid membership.
 */
public class TenantAccessDeniedException extends RuntimeException {

    private final UUID userId;
    private final UUID tenantId;

    public TenantAccessDeniedException(String message) {
        super(message);
        this.userId = null;
        this.tenantId = null;
    }

    public TenantAccessDeniedException(UUID userId, UUID tenantId) {
        super(String.format("User %s does not have access to tenant %s", userId, tenantId));
        this.userId = userId;
        this.tenantId = tenantId;
    }

    public TenantAccessDeniedException(UUID userId, UUID tenantId, String message) {
        super(message);
        this.userId = userId;
        this.tenantId = tenantId;
    }

    public TenantAccessDeniedException(UUID userId, UUID tenantId, String message, Throwable cause) {
        super(message, cause);
        this.userId = userId;
        this.tenantId = tenantId;
    }

    public UUID getUserId() {
        return userId;
    }

    public UUID getTenantId() {
        return tenantId;
    }
}
