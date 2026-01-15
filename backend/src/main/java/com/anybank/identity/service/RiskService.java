package com.anybank.identity.service;

import com.anybank.identity.entity.AuditLog.AuditOutcome;
import com.anybank.identity.repository.AuditLogRepository;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class RiskService {

    private final AuditLogRepository auditLogRepository;
    private final DebugControlsService debugControlsService;

    /**
     * Result of risk calculation with breakdown of factors.
     */
    public record RiskResult(int score, Map<String, Object> factors, boolean overrideActive) {}

    private static final Set<String> SUSPICIOUS_USER_AGENTS = Set.of(
            "hacker", "bot", "crawler", "spider", "scraper"
    );

    /**
     * Calculates risk score - for backwards compatibility.
     */
    public int calculateRiskScore(HttpServletRequest request, UUID userId) {
        return calculateRiskScoreWithDetails(request, userId).score();
    }

    /**
     * Calculates risk score with detailed breakdown of factors.
     */
    public RiskResult calculateRiskScoreWithDetails(HttpServletRequest request, UUID userId) {
        // Check for debug override first
        Integer override = debugControlsService.getRiskOverride();
        if (override != null) {
            log.info("Using risk score override: {}", override);
            Map<String, Object> factors = new HashMap<>();
            factors.put("override", override);
            factors.put("reason", "Debug override active");
            return new RiskResult(override, factors, true);
        }

        Map<String, Object> factors = new HashMap<>();
        int riskScore = 0;

        String userAgent = request.getHeader("User-Agent");

        // Factor 1: New Device (+30)
        boolean newDevice = isNewDevice(userAgent, userId);
        factors.put("newDevice", Map.of("detected", newDevice, "score", newDevice ? 30 : 0));
        if (newDevice) {
            riskScore += 30;
            log.debug("Risk +30: New device detected");
        }

        // Factor 2: Off Hours (+15)
        boolean offHours = isOffHours();
        factors.put("offHours", Map.of("detected", offHours, "score", offHours ? 15 : 0));
        if (offHours) {
            riskScore += 15;
            log.debug("Risk +15: Off-hours access");
        }

        // Factor 3: High Velocity (+20)
        boolean highVelocity = userId != null && isHighVelocity(userId);
        factors.put("highVelocity", Map.of("detected", highVelocity, "score", highVelocity ? 20 : 0));
        if (highVelocity) {
            riskScore += 20;
            log.debug("Risk +20: High velocity detected");
        }

        // Factor 4: Failed Auth Attempts (+10 per)
        int failedAttempts = userId != null ? countRecentFailedAttempts(userId) : 0;
        int failureRisk = Math.min(failedAttempts * 10, 30);
        factors.put("failedAttempts", Map.of("count", failedAttempts, "score", failureRisk));
        if (failedAttempts > 0) {
            riskScore += failureRisk;
            log.debug("Risk +{}: Recent failed attempts", failureRisk);
        }

        // Factor 5: VPN/Proxy Detected (+15)
        boolean vpnProxy = isVpnOrProxy(request);
        factors.put("vpnProxy", Map.of("detected", vpnProxy, "score", vpnProxy ? 15 : 0));
        if (vpnProxy) {
            riskScore += 15;
            log.debug("Risk +15: VPN/Proxy detected");
        }

        // Factor 6: Suspicious User-Agent (+20)
        boolean suspiciousAgent = isSuspiciousUserAgent(userAgent);
        factors.put("suspiciousUserAgent", Map.of(
                "detected", suspiciousAgent,
                "score", suspiciousAgent ? 20 : 0,
                "userAgent", userAgent != null ? userAgent : "none"
        ));
        if (suspiciousAgent) {
            riskScore += 20;
            log.debug("Risk +20: Suspicious User-Agent");
        }

        riskScore = Math.min(riskScore, 100);
        factors.put("totalScore", riskScore);
        log.info("Calculated risk score: {}", riskScore);

        return new RiskResult(riskScore, factors, false);
    }

    private boolean isNewDevice(String userAgent, UUID userId) {
        return userAgent == null || userAgent.isEmpty();
    }

    private boolean isOffHours() {
        LocalTime now = LocalTime.now(ZoneId.systemDefault());
        return now.isBefore(LocalTime.of(6, 0)) || now.isAfter(LocalTime.of(22, 0));
    }

    private boolean isHighVelocity(UUID userId) {
        Instant oneMinuteAgo = Instant.now().minusSeconds(60);
        long recentActions = auditLogRepository.countRecentActions(
                userId, "api_request", AuditOutcome.SUCCESS, oneMinuteAgo);
        return recentActions > 50;
    }

    private int countRecentFailedAttempts(UUID userId) {
        Instant fifteenMinutesAgo = Instant.now().minusSeconds(900);
        return (int) auditLogRepository.countRecentActions(
                userId, "login", AuditOutcome.DENIED, fifteenMinutesAgo);
    }

    private boolean isVpnOrProxy(HttpServletRequest request) {
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && xForwardedFor.contains(",")) {
            return xForwardedFor.split(",").length > 2;
        }
        return false;
    }

    private boolean isSuspiciousUserAgent(String userAgent) {
        if (userAgent == null) return false;
        String lower = userAgent.toLowerCase();
        return SUSPICIOUS_USER_AGENTS.stream().anyMatch(lower::contains);
    }
}
