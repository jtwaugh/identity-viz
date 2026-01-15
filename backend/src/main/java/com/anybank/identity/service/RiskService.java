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
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class RiskService {

    private final AuditLogRepository auditLogRepository;

    private static final Set<String> SUSPICIOUS_USER_AGENTS = Set.of(
            "hacker", "bot", "crawler", "spider", "scraper"
    );

    public int calculateRiskScore(HttpServletRequest request, UUID userId) {
        int riskScore = 0;

        String userAgent = request.getHeader("User-Agent");

        // Factor 1: New Device (+30)
        if (isNewDevice(userAgent, userId)) {
            riskScore += 30;
            log.debug("Risk +30: New device detected");
        }

        // Factor 2: Off Hours (+15)
        if (isOffHours()) {
            riskScore += 15;
            log.debug("Risk +15: Off-hours access");
        }

        // Factor 3: High Velocity (+20)
        if (userId != null && isHighVelocity(userId)) {
            riskScore += 20;
            log.debug("Risk +20: High velocity detected");
        }

        // Factor 4: Failed Auth Attempts (+10 per)
        if (userId != null) {
            int failedAttempts = countRecentFailedAttempts(userId);
            if (failedAttempts > 0) {
                int failureRisk = Math.min(failedAttempts * 10, 30);
                riskScore += failureRisk;
                log.debug("Risk +{}: Recent failed attempts", failureRisk);
            }
        }

        // Factor 5: VPN/Proxy Detected (+15)
        if (isVpnOrProxy(request)) {
            riskScore += 15;
            log.debug("Risk +15: VPN/Proxy detected");
        }

        // Factor 6: Suspicious User-Agent (+20)
        if (isSuspiciousUserAgent(userAgent)) {
            riskScore += 20;
            log.debug("Risk +20: Suspicious User-Agent");
        }

        riskScore = Math.min(riskScore, 100);
        log.info("Calculated risk score: {}", riskScore);
        return riskScore;
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
