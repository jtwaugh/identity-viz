package com.anybank.identity.security;

import com.anybank.identity.dto.DebugEvent;
import com.anybank.identity.dto.DebugEvent.EventType;
import com.anybank.identity.entity.User;
import com.anybank.identity.repository.UserRepository;
import com.anybank.identity.service.DebugEventService;
import com.anybank.identity.service.RiskService;
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

@Component
@Order(2)
@RequiredArgsConstructor
@Slf4j
public class RiskEvaluationFilter extends OncePerRequestFilter {

    public static final String RISK_SCORE_ATTRIBUTE = "riskScore";
    public static final String RISK_FACTORS_ATTRIBUTE = "riskFactors";

    private final RiskService riskService;
    private final UserRepository userRepository;
    private final DebugEventService debugEventService;

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();

        if (authentication != null && authentication.getPrincipal() instanceof Jwt jwt) {
            UUID userId = getUserId(jwt);
            RiskService.RiskResult riskResult = riskService.calculateRiskScoreWithDetails(request, userId);
            request.setAttribute(RISK_SCORE_ATTRIBUTE, riskResult.score());
            request.setAttribute(RISK_FACTORS_ATTRIBUTE, riskResult.factors());
            log.debug("Risk score calculated: {} for request to {}", riskResult.score(), request.getRequestURI());

            // Emit debug event with risk calculation details
            emitRiskScoreEvent(jwt, riskResult, request);
        }

        filterChain.doFilter(request, response);
    }

    private UUID getUserId(Jwt jwt) {
        String externalId = jwt.getSubject();
        return userRepository.findByExternalId(externalId)
                .map(User::getId)
                .orElse(null);
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        return path.startsWith("/actuator") ||
               path.startsWith("/swagger") ||
               path.startsWith("/v3/api-docs") ||
               path.startsWith("/auth/") ||
               path.startsWith("/debug");
    }

    /**
     * Emits a debug event with risk score calculation details.
     */
    private void emitRiskScoreEvent(Jwt jwt, RiskService.RiskResult riskResult, HttpServletRequest request) {
        try {
            TenantContext.TenantInfo tenantInfo = TenantContext.getCurrentTenant();

            Map<String, Object> details = new HashMap<>();
            details.put("riskScore", riskResult.score());
            details.put("factors", riskResult.factors());
            details.put("overrideActive", riskResult.overrideActive());
            details.put("path", request.getRequestURI());
            details.put("method", request.getMethod());
            details.put("userAgent", request.getHeader("User-Agent"));
            details.put("ipAddress", getClientIp(request));

            DebugEvent.Actor actor = DebugEvent.Actor.builder()
                    .email(jwt.getClaimAsString("email"))
                    .build();

            if (tenantInfo != null) {
                actor.setUserId(tenantInfo.getUserId());
                actor.setTenantId(tenantInfo.getTenantId());
                actor.setRole(tenantInfo.getRole() != null ? tenantInfo.getRole().name() : null);
            }

            DebugEvent event = DebugEvent.builder()
                    .id(UUID.randomUUID())
                    .timestamp(Instant.now())
                    .type(EventType.API)
                    .action("risk_score_calculated")
                    .actor(actor)
                    .details(details)
                    .build();

            debugEventService.emit(event);
        } catch (Exception e) {
            log.warn("Failed to emit risk score debug event: {}", e.getMessage());
        }
    }

    private String getClientIp(HttpServletRequest request) {
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isEmpty()) {
            return xForwardedFor.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
