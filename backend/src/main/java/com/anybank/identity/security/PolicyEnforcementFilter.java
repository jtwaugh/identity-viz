package com.anybank.identity.security;

import com.anybank.identity.dto.TenantDto.MembershipRole;
import com.anybank.identity.dto.TenantDto.TenantType;
import com.anybank.identity.exception.PolicyDeniedException;
import com.anybank.identity.service.PolicyService;
import com.anybank.identity.service.PolicyService.PolicyInput;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Component
@Order(3)
@RequiredArgsConstructor
@Slf4j
public class PolicyEnforcementFilter extends OncePerRequestFilter {

    private final PolicyService policyService;
    private final ObjectMapper objectMapper;

    private static final Set<String> SENSITIVE_PATHS = Set.of(
            "/api/accounts/*/transfer",
            "/api/admin/"
    );

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {

        if (!requiresPolicyCheck(request)) {
            filterChain.doFilter(request, response);
            return;
        }

        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (!(authentication != null && authentication.getPrincipal() instanceof Jwt jwt)) {
            filterChain.doFilter(request, response);
            return;
        }

        try {
            PolicyInput input = buildPolicyInput(request, jwt);
            if (input != null && !policyService.checkPolicy(input)) {
                Integer riskScore = (Integer) request.getAttribute(RiskEvaluationFilter.RISK_SCORE_ATTRIBUTE);
                throw new PolicyDeniedException(
                        mapRequestToAction(request),
                        "Access denied by policy",
                        riskScore
                );
            }
            filterChain.doFilter(request, response);
        } catch (PolicyDeniedException e) {
            log.warn("Policy denied: {}", e.getMessage());
            sendErrorResponse(response, e);
        }
    }

    private boolean requiresPolicyCheck(HttpServletRequest request) {
        String path = request.getRequestURI();
        String method = request.getMethod();

        // POST/PUT/DELETE on sensitive paths require policy check
        if (Set.of("POST", "PUT", "DELETE", "PATCH").contains(method)) {
            for (String pattern : SENSITIVE_PATHS) {
                if (pathMatches(path, pattern)) {
                    return true;
                }
            }
        }

        return false;
    }

    private boolean pathMatches(String path, String pattern) {
        String regex = pattern.replace("*", "[^/]+");
        return path.matches(regex);
    }

    private PolicyInput buildPolicyInput(HttpServletRequest request, Jwt jwt) {
        TenantContext.TenantInfo tenantInfo = TenantContext.getCurrentTenant();
        if (tenantInfo == null) {
            return null;
        }

        Integer riskScore = (Integer) request.getAttribute(RiskEvaluationFilter.RISK_SCORE_ATTRIBUTE);
        if (riskScore == null) {
            riskScore = 0;
        }

        String userAgent = request.getHeader("User-Agent");
        String ipAddress = getClientIp(request);

        return new PolicyInput(
                new PolicyService.UserContext(
                        tenantInfo.getUserId(),
                        tenantInfo.getUserEmail(),
                        tenantInfo.getRole() != null ? tenantInfo.getRole() : MembershipRole.VIEWER
                ),
                new PolicyService.TenantContext(
                        tenantInfo.getTenantId(),
                        tenantInfo.getTenantType() != null ? tenantInfo.getTenantType() : TenantType.CONSUMER
                ),
                mapRequestToAction(request),
                new PolicyService.ResourceContext(
                        extractResourceType(request),
                        extractResourceId(request)
                ),
                new PolicyService.RequestContext(
                        "WEB",
                        ipAddress,
                        userAgent,
                        riskScore,
                        false
                )
        );
    }

    private String mapRequestToAction(HttpServletRequest request) {
        String path = request.getRequestURI();
        String method = request.getMethod();

        if (path.contains("/transfer")) {
            return "internal_transfer";
        }
        if (path.contains("/admin/users") && "POST".equals(method)) {
            return "manage_users";
        }
        if (path.contains("/admin/users") && "DELETE".equals(method)) {
            return "manage_users";
        }
        if (path.contains("/accounts") && "GET".equals(method)) {
            return "view_balance";
        }
        if (path.contains("/transactions")) {
            return "view_transactions";
        }

        return "unknown";
    }

    private String extractResourceType(HttpServletRequest request) {
        String path = request.getRequestURI();
        if (path.contains("/accounts")) return "account";
        if (path.contains("/tenants")) return "tenant";
        if (path.contains("/users")) return "user";
        return "unknown";
    }

    private UUID extractResourceId(HttpServletRequest request) {
        String path = request.getRequestURI();
        String[] segments = path.split("/");
        for (int i = 0; i < segments.length - 1; i++) {
            if (Set.of("accounts", "tenants", "users").contains(segments[i])) {
                try {
                    return UUID.fromString(segments[i + 1]);
                } catch (IllegalArgumentException e) {
                    return null;
                }
            }
        }
        return null;
    }

    private String getClientIp(HttpServletRequest request) {
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isEmpty()) {
            return xForwardedFor.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }

    private void sendErrorResponse(HttpServletResponse response, PolicyDeniedException e) throws IOException {
        response.setStatus(HttpStatus.FORBIDDEN.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);

        Map<String, Object> errorBody = Map.of(
                "error", Map.of(
                        "code", "POLICY_DENIED",
                        "message", e.getMessage(),
                        "action", e.getAction(),
                        "riskScore", e.getRiskScore() != null ? e.getRiskScore() : 0
                )
        );

        objectMapper.writeValue(response.getOutputStream(), errorBody);
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        return path.startsWith("/actuator") ||
               path.startsWith("/swagger") ||
               path.startsWith("/v3/api-docs") ||
               path.startsWith("/auth/");
    }
}
