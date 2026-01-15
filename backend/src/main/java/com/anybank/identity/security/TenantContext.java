package com.anybank.identity.security;

import com.anybank.identity.dto.TenantDto.MembershipRole;
import com.anybank.identity.dto.TenantDto.TenantType;
import lombok.Builder;
import lombok.Data;

import java.util.UUID;

public class TenantContext {

    private static final ThreadLocal<TenantInfo> CONTEXT = new ThreadLocal<>();

    public static void setCurrentTenant(TenantInfo tenantInfo) {
        CONTEXT.set(tenantInfo);
    }

    public static TenantInfo getCurrentTenant() {
        return CONTEXT.get();
    }

    public static UUID getCurrentTenantId() {
        TenantInfo info = CONTEXT.get();
        return info != null ? info.getTenantId() : null;
    }

    public static MembershipRole getCurrentRole() {
        TenantInfo info = CONTEXT.get();
        return info != null ? info.getRole() : null;
    }

    public static TenantType getCurrentTenantType() {
        TenantInfo info = CONTEXT.get();
        return info != null ? info.getTenantType() : null;
    }

    public static void clear() {
        CONTEXT.remove();
    }

    @Data
    @Builder
    public static class TenantInfo {
        private UUID tenantId;
        private TenantType tenantType;
        private MembershipRole role;
        private UUID userId;
        private String userEmail;
    }
}
