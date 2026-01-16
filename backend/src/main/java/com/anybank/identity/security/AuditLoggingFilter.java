package com.anybank.identity.security;

import com.anybank.identity.dto.DebugEvent;
import com.anybank.identity.dto.DebugEvent.EventType;
import com.anybank.identity.entity.AuditLog.AuditOutcome;
import com.anybank.identity.service.AuditService;
import com.anybank.identity.service.DebugEventService;
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
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Filter that creates audit log entries for API requests.
 * Runs after the PolicyEnforcementFilter to capture the final outcome.
 */
@Component
@Order(4)
@RequiredArgsConstructor
@Slf4j
public class AuditLoggingFilter extends OncePerRequestFilter {

    private final AuditService auditService;
    private final DebugEventService debugEventService;

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        long startTime = System.currentTimeMillis();

        try {
            filterChain.doFilter(request, response);
        } finally {
            long duration = System.currentTimeMillis() - startTime;
            logRequest(request, response, duration);
        }
    }

    private void logRequest(HttpServletRequest request, HttpServletResponse response, long duration) {
        try {
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            TenantContext.TenantInfo tenantInfo = TenantContext.getCurrentTenant();

            UUID userId = tenantInfo != null ? tenantInfo.getUserId() : null;
            UUID tenantId = tenantInfo != null ? tenantInfo.getTenantId() : null;

            String action = mapRequestToAction(request);
            String resourceType = extractResourceType(request);
            UUID resourceId = extractResourceId(request);
            Integer riskScore = (Integer) request.getAttribute(RiskEvaluationFilter.RISK_SCORE_ATTRIBUTE);

            AuditOutcome outcome = determineOutcome(response.getStatus());

            // Log to audit service
            auditService.logAction(
                    userId,
                    tenantId,
                    action,
                    resourceType,
                    resourceId,
                    outcome,
                    riskScore,
                    getClientIp(request),
                    request.getHeader("User-Agent"),
                    buildMetadata(request, response, duration)
            );

            // Emit debug event
            emitAuditEvent(request, response, tenantInfo, action, resourceType, outcome, riskScore, duration);

        } catch (Exception e) {
            log.warn("Failed to log audit entry: {}", e.getMessage());
        }
    }

    private void emitAuditEvent(
            HttpServletRequest request,
            HttpServletResponse response,
            TenantContext.TenantInfo tenantInfo,
            String action,
            String resourceType,
            AuditOutcome outcome,
            Integer riskScore,
            long duration
    ) {
        try {
            Map<String, Object> details = new HashMap<>();
            details.put("action", action);
            details.put("resourceType", resourceType);
            details.put("outcome", outcome.name());
            details.put("statusCode", response.getStatus());
            details.put("duration", duration);
            details.put("path", request.getRequestURI());
            details.put("method", request.getMethod());
            if (riskScore != null) {
                details.put("riskScore", riskScore);
            }

            // Capture request source to distinguish test vs human traffic
            String requestSource = request.getHeader("X-Request-Source");
            if (requestSource != null && !requestSource.isEmpty()) {
                details.put("requestSource", requestSource);
            } else {
                details.put("requestSource", "user");  // Default to user traffic
            }

            DebugEvent.Actor actor = null;
            if (tenantInfo != null) {
                actor = DebugEvent.Actor.builder()
                        .userId(tenantInfo.getUserId())
                        .email(tenantInfo.getUserEmail())
                        .tenantId(tenantInfo.getTenantId())
                        .role(tenantInfo.getRole() != null ? tenantInfo.getRole().name() : null)
                        .build();
            }

            DebugEvent event = DebugEvent.builder()
                    .id(UUID.randomUUID())
                    .timestamp(Instant.now())
                    .type(EventType.AUDIT)
                    .action("audit_logged")
                    .actor(actor)
                    .details(details)
                    .build();

            debugEventService.emit(event);
        } catch (Exception e) {
            log.warn("Failed to emit audit debug event: {}", e.getMessage());
        }
    }

    private String mapRequestToAction(HttpServletRequest request) {
        String path = request.getRequestURI();
        String method = request.getMethod();

        if (path.contains("/transfer")) {
            return "transfer_funds";
        }
        if (path.contains("/accounts") && "GET".equals(method)) {
            return "view_accounts";
        }
        if (path.contains("/transactions")) {
            return "view_transactions";
        }
        if (path.contains("/tenants") && path.contains("/switch")) {
            return "context_switch";
        }
        if (path.contains("/tenants")) {
            return "GET".equals(method) ? "view_tenants" : "manage_tenant";
        }
        if (path.contains("/admin/users")) {
            return "manage_users";
        }
        if (path.contains("/auth")) {
            return "authentication";
        }

        return String.format("%s_%s", method.toLowerCase(), "api_request");
    }

    private String extractResourceType(HttpServletRequest request) {
        String path = request.getRequestURI();
        if (path.contains("/accounts")) return "account";
        if (path.contains("/tenants")) return "tenant";
        if (path.contains("/users")) return "user";
        if (path.contains("/auth")) return "auth";
        return "api";
    }

    private UUID extractResourceId(HttpServletRequest request) {
        String path = request.getRequestURI();
        String[] segments = path.split("/");
        for (int i = 0; i < segments.length - 1; i++) {
            if (segments[i].equals("accounts") || segments[i].equals("tenants") || segments[i].equals("users")) {
                try {
                    return UUID.fromString(segments[i + 1]);
                } catch (IllegalArgumentException e) {
                    return null;
                }
            }
        }
        return null;
    }

    private AuditOutcome determineOutcome(int statusCode) {
        if (statusCode >= 200 && statusCode < 300) {
            return AuditOutcome.SUCCESS;
        }
        if (statusCode == 403) {
            return AuditOutcome.DENIED;
        }
        return AuditOutcome.ERROR;
    }

    private String getClientIp(HttpServletRequest request) {
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isEmpty()) {
            return xForwardedFor.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }

    private Map<String, Object> buildMetadata(HttpServletRequest request, HttpServletResponse response, long duration) {
        Map<String, Object> metadata = new HashMap<>();
        metadata.put("path", request.getRequestURI());
        metadata.put("method", request.getMethod());
        metadata.put("statusCode", response.getStatus());
        metadata.put("duration", duration);
        metadata.put("correlationId", CorrelationIdFilter.getCurrentCorrelationId());
        return metadata;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        return path.startsWith("/actuator") ||
               path.startsWith("/swagger") ||
               path.startsWith("/v3/api-docs") ||
               path.startsWith("/debug");
    }
}
