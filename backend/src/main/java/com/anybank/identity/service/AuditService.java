package com.anybank.identity.service;

import com.anybank.identity.entity.AuditLog;
import com.anybank.identity.entity.AuditLog.AuditOutcome;
import com.anybank.identity.entity.Tenant;
import com.anybank.identity.entity.User;
import com.anybank.identity.repository.AuditLogRepository;
import com.anybank.identity.repository.TenantRepository;
import com.anybank.identity.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuditService {

    private final AuditLogRepository auditLogRepository;
    private final UserRepository userRepository;
    private final TenantRepository tenantRepository;

    @Async
    @Transactional
    public void logAction(
            UUID userId,
            UUID tenantId,
            String action,
            String resourceType,
            UUID resourceId,
            AuditOutcome outcome,
            Integer riskScore,
            String ipAddress,
            String userAgent,
            Map<String, Object> metadata
    ) {
        try {
            User user = userId != null ? userRepository.findById(userId).orElse(null) : null;
            Tenant tenant = tenantId != null ? tenantRepository.findById(tenantId).orElse(null) : null;

            AuditLog auditLog = AuditLog.builder()
                    .user(user)
                    .tenant(tenant)
                    .action(action)
                    .resourceType(resourceType)
                    .resourceId(resourceId)
                    .outcome(outcome)
                    .riskScore(riskScore)
                    .ipAddress(ipAddress)
                    .userAgent(userAgent)
                    .metadata(metadata)
                    .createdAt(Instant.now())
                    .build();

            auditLogRepository.save(auditLog);
            log.debug("Audit log created: action={}, outcome={}, userId={}, tenantId={}",
                    action, outcome, userId, tenantId);
        } catch (Exception e) {
            log.error("Failed to create audit log: {}", e.getMessage());
        }
    }

    public void logSuccess(UUID userId, UUID tenantId, String action, String resourceType, UUID resourceId,
                           String ipAddress, String userAgent) {
        logAction(userId, tenantId, action, resourceType, resourceId, AuditOutcome.SUCCESS,
                null, ipAddress, userAgent, null);
    }

    public void logDenied(UUID userId, UUID tenantId, String action, String resourceType, UUID resourceId,
                          Integer riskScore, String ipAddress, String userAgent, String reason) {
        logAction(userId, tenantId, action, resourceType, resourceId, AuditOutcome.DENIED,
                riskScore, ipAddress, userAgent, Map.of("reason", reason));
    }

    public void logError(UUID userId, UUID tenantId, String action, String resourceType,
                         String ipAddress, String userAgent, String error) {
        logAction(userId, tenantId, action, resourceType, null, AuditOutcome.ERROR,
                null, ipAddress, userAgent, Map.of("error", error));
    }
}
