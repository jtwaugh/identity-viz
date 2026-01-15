package com.anybank.identity.security;

import com.anybank.identity.dto.DebugEvent;
import com.anybank.identity.dto.DebugEvent.EventType;
import com.anybank.identity.dto.TenantDto;
import com.anybank.identity.dto.TenantDto.MembershipRole;
import com.anybank.identity.dto.TenantDto.TenantType;
import com.anybank.identity.entity.User;
import com.anybank.identity.repository.UserRepository;
import com.anybank.identity.service.DebugEventService;
import com.anybank.identity.service.TenantService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.annotation.Order;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Component
@Order(1)
@RequiredArgsConstructor
@Slf4j
public class TenantContextFilter extends OncePerRequestFilter {

    private final DebugEventService debugEventService;
    private final TenantService tenantService;
    private final UserRepository userRepository;

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        log.info("TenantContextFilter processing request: {} {}", request.getMethod(), request.getRequestURI());
        try {
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            log.info("Authentication present: {}, type: {}", authentication != null,
                    authentication != null ? authentication.getClass().getSimpleName() : "null");

            if (authentication != null && authentication.getPrincipal() instanceof Jwt jwt) {
                // First try to extract from JWT claims
                TenantContext.TenantInfo tenantInfo = extractTenantInfo(jwt);

                // Fallback: try to extract from X-Tenant-ID header
                if (tenantInfo == null) {
                    tenantInfo = extractTenantInfoFromHeader(request, jwt);
                }

                if (tenantInfo != null) {
                    TenantContext.setCurrentTenant(tenantInfo);
                    log.debug("Tenant context set: tenantId={}, role={}",
                            tenantInfo.getTenantId(), tenantInfo.getRole());

                    // Emit debug event for tenant context extraction
                    emitTenantContextEvent(tenantInfo, request);
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

    /**
     * Extract tenant info from X-Tenant-ID header as fallback when JWT doesn't have tenant claims.
     * This is used when token exchange hasn't happened yet but user has selected a tenant in the UI.
     */
    private TenantContext.TenantInfo extractTenantInfoFromHeader(HttpServletRequest request, Jwt jwt) {
        String tenantIdHeader = request.getHeader("X-Tenant-ID");
        log.debug("X-Tenant-ID header value: {}", tenantIdHeader);
        if (tenantIdHeader == null || tenantIdHeader.isEmpty()) {
            log.debug("No X-Tenant-ID header found in request to {}", request.getRequestURI());
            return null;
        }

        try {
            UUID tenantId = UUID.fromString(tenantIdHeader);
            String email = jwt.getClaimAsString("email");

            // Look up user by email to get their membership info
            User user = userRepository.findByEmail(email).orElse(null);
            if (user == null) {
                log.warn("User not found for email: {}", email);
                return null;
            }

            // Get tenant info for this user
            TenantDto tenant = tenantService.getTenantForUser(user.getId(), tenantId);
            if (tenant == null) {
                log.warn("User {} does not have access to tenant {}", email, tenantId);
                return null;
            }

            TenantContext.TenantInfo info = TenantContext.TenantInfo.builder()
                    .tenantId(tenantId)
                    .tenantType(tenant.getType())
                    .role(tenant.getRole())
                    .userEmail(email)
                    .userId(user.getId())
                    .build();
            log.info("Successfully extracted tenant info from header: tenantId={}, role={}", tenantId, tenant.getRole());
            return info;
        } catch (IllegalArgumentException e) {
            log.warn("Invalid tenant ID in header: {}", e.getMessage());
            return null;
        } catch (Exception e) {
            log.warn("Failed to extract tenant info from header: {}", e.getMessage());
            return null;
        }
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        return path.startsWith("/actuator") ||
               path.startsWith("/swagger") ||
               path.startsWith("/v3/api-docs") ||
               path.startsWith("/debug");
    }

    /**
     * Emits a debug event when tenant context is extracted from the JWT.
     */
    private void emitTenantContextEvent(TenantContext.TenantInfo tenantInfo, HttpServletRequest request) {
        try {
            Map<String, Object> details = new HashMap<>();
            details.put("tenantId", tenantInfo.getTenantId());
            details.put("tenantType", tenantInfo.getTenantType());
            details.put("role", tenantInfo.getRole());
            details.put("userEmail", tenantInfo.getUserEmail());
            details.put("userId", tenantInfo.getUserId());
            details.put("path", request.getRequestURI());
            details.put("method", request.getMethod());

            DebugEvent event = DebugEvent.builder()
                    .id(UUID.randomUUID())
                    .timestamp(java.time.Instant.now())
                    .type(EventType.AUTH)
                    .action("tenant_context_extracted")
                    .actor(DebugEvent.Actor.builder()
                            .userId(tenantInfo.getUserId())
                            .email(tenantInfo.getUserEmail())
                            .tenantId(tenantInfo.getTenantId())
                            .role(tenantInfo.getRole() != null ? tenantInfo.getRole().name() : null)
                            .build())
                    .details(details)
                    .build();

            debugEventService.emit(event);
        } catch (Exception e) {
            log.warn("Failed to emit tenant context debug event: {}", e.getMessage());
        }
    }
}
