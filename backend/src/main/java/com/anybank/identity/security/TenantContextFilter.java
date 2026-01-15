package com.anybank.identity.security;

import com.anybank.identity.dto.TenantDto.MembershipRole;
import com.anybank.identity.dto.TenantDto.TenantType;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.annotation.Order;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.UUID;

@Component
@Order(1)
@Slf4j
public class TenantContextFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        try {
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();

            if (authentication != null && authentication.getPrincipal() instanceof Jwt jwt) {
                TenantContext.TenantInfo tenantInfo = extractTenantInfo(jwt);
                if (tenantInfo != null) {
                    TenantContext.setCurrentTenant(tenantInfo);
                    log.debug("Tenant context set: tenantId={}, role={}",
                            tenantInfo.getTenantId(), tenantInfo.getRole());
                }
            }

            filterChain.doFilter(request, response);
        } finally {
            TenantContext.clear();
        }
    }

    private TenantContext.TenantInfo extractTenantInfo(Jwt jwt) {
        String tenantIdClaim = jwt.getClaimAsString("tenant_id");
        if (tenantIdClaim == null || tenantIdClaim.isEmpty()) {
            return null;
        }

        try {
            UUID tenantId = UUID.fromString(tenantIdClaim);

            String tenantTypeClaim = jwt.getClaimAsString("tenant_type");
            TenantType tenantType = tenantTypeClaim != null ?
                    TenantType.valueOf(tenantTypeClaim) : TenantType.CONSUMER;

            String roleClaim = jwt.getClaimAsString("role");
            MembershipRole role = roleClaim != null ?
                    MembershipRole.valueOf(roleClaim) : MembershipRole.VIEWER;

            return TenantContext.TenantInfo.builder()
                    .tenantId(tenantId)
                    .tenantType(tenantType)
                    .role(role)
                    .userEmail(jwt.getClaimAsString("email"))
                    .build();
        } catch (IllegalArgumentException e) {
            log.warn("Invalid tenant info in JWT: {}", e.getMessage());
            return null;
        }
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        return path.startsWith("/actuator") ||
               path.startsWith("/swagger") ||
               path.startsWith("/v3/api-docs");
    }
}
