package com.anybank.identity.service;

import com.anybank.identity.repository.AuditLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Service for debug control operations.
 * Provides methods for resetting demo data, overriding risk scores, and time simulation.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class DebugControlsService {

    private final JdbcTemplate jdbcTemplate;
    private final AuditLogRepository auditLogRepository;
    private final DebugEventService debugEventService;
    private final DebugSessionService debugSessionService;

    private final AtomicReference<Integer> riskOverride = new AtomicReference<>(null);
    private final AtomicReference<LocalDateTime> timeOverride = new AtomicReference<>(null);

    /**
     * Resets all demo data - truncates and reseeds.
     */
    @Transactional
    public void resetAllData() {
        log.info("Resetting all demo data...");

        try {
            // Clear in-memory state
            debugEventService.clearEvents();
            debugSessionService.clearAllSessions();

            // Reset database tables in correct order (respecting foreign keys)
            jdbcTemplate.execute("DELETE FROM audit_logs");
            jdbcTemplate.execute("DELETE FROM accounts");
            jdbcTemplate.execute("DELETE FROM memberships");
            jdbcTemplate.execute("DELETE FROM tenants");
            jdbcTemplate.execute("DELETE FROM users");

            // Reseed demo data
            reseedDemoData();

            log.info("All demo data has been reset");
        } catch (Exception e) {
            log.error("Failed to reset demo data: {}", e.getMessage());
            throw new RuntimeException("Failed to reset demo data", e);
        }
    }

    /**
     * Resets only the audit log.
     */
    @Transactional
    public void resetAuditLog() {
        log.info("Resetting audit log...");
        auditLogRepository.deleteAll();
        log.info("Audit log has been reset");
    }

    /**
     * Resets only user sessions.
     */
    public void resetSessions() {
        log.info("Resetting sessions...");
        debugSessionService.clearAllSessions();
        log.info("Sessions have been reset");
    }

    /**
     * Sets the global risk score override.
     * When set, all risk calculations will return this value instead of computing.
     */
    public void setRiskOverride(Integer score) {
        if (score != null && (score < 0 || score > 100)) {
            throw new IllegalArgumentException("Risk score must be between 0 and 100");
        }
        Integer previous = riskOverride.getAndSet(score);
        log.info("Risk override changed: {} -> {}", previous, score);
    }

    /**
     * Gets the current risk override value.
     */
    public Integer getRiskOverride() {
        return riskOverride.get();
    }

    /**
     * Checks if risk override is active.
     */
    public boolean isRiskOverrideActive() {
        return riskOverride.get() != null;
    }

    /**
     * Sets the simulated time override.
     * When set, all time-dependent operations will use this value.
     */
    public void setTimeOverride(LocalDateTime time) {
        LocalDateTime previous = timeOverride.getAndSet(time);
        log.info("Time override changed: {} -> {}", previous, time);
    }

    /**
     * Gets the effective time (override or real time).
     */
    public LocalDateTime getEffectiveTime() {
        LocalDateTime override = timeOverride.get();
        return override != null ? override : LocalDateTime.now();
    }

    /**
     * Checks if time override is active.
     */
    public boolean isTimeOverrideActive() {
        return timeOverride.get() != null;
    }

    /**
     * Clears the time override.
     */
    public void clearTimeOverride() {
        timeOverride.set(null);
        log.info("Time override cleared");
    }

    /**
     * Clears all overrides.
     */
    public void clearAllOverrides() {
        riskOverride.set(null);
        timeOverride.set(null);
        log.info("All overrides cleared");
    }

    /**
     * Gets the current debug controls state.
     */
    public DebugControlsState getControlsState() {
        return new DebugControlsState(
                riskOverride.get(),
                timeOverride.get(),
                isRiskOverrideActive(),
                isTimeOverrideActive()
        );
    }

    /**
     * Reseeds demo data into the database.
     */
    private void reseedDemoData() {
        // Insert demo users
        jdbcTemplate.execute("""
            INSERT INTO users (id, external_id, email, display_name, mfa_enabled, created_at, updated_at)
            VALUES
                ('11111111-1111-1111-1111-111111111111', 'user-001', 'jdoe@example.com', 'John Doe', false, NOW(), NOW()),
                ('22222222-2222-2222-2222-222222222222', 'user-002', 'jsmith@example.com', 'Jane Smith', false, NOW(), NOW()),
                ('33333333-3333-3333-3333-333333333333', 'user-003', 'admin@anybank.com', 'Admin User', true, NOW(), NOW())
            ON CONFLICT (id) DO NOTHING
            """);

        // Insert demo tenants
        jdbcTemplate.execute("""
            INSERT INTO tenants (id, external_id, name, type, status, created_at)
            VALUES
                ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'tenant-001', 'John Doe', 'CONSUMER', 'ACTIVE', NOW()),
                ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'tenant-002', 'Jane Smith', 'CONSUMER', 'ACTIVE', NOW()),
                ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'tenant-003', 'AnyBusiness Inc.', 'COMMERCIAL', 'ACTIVE', NOW())
            ON CONFLICT (id) DO NOTHING
            """);

        // Insert demo memberships
        jdbcTemplate.execute("""
            INSERT INTO memberships (id, user_id, tenant_id, role, status, created_at)
            VALUES
                ('a1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'OWNER', 'ACTIVE', NOW()),
                ('a2222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'OWNER', 'ACTIVE', NOW()),
                ('a3333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'OWNER', 'ACTIVE', NOW()),
                ('a4444444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333333', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'ADMIN', 'ACTIVE', NOW()),
                ('a5555555-5555-5555-5555-555555555555', '33333333-3333-3333-3333-333333333333', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'ADMIN', 'ACTIVE', NOW()),
                ('a6666666-6666-6666-6666-666666666666', '33333333-3333-3333-3333-333333333333', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'ADMIN', 'ACTIVE', NOW())
            ON CONFLICT (id) DO NOTHING
            """);

        // Insert demo accounts
        jdbcTemplate.execute("""
            INSERT INTO accounts (id, tenant_id, account_number, account_type, name, balance, currency, status, created_at)
            VALUES
                ('acc11111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '****1234', 'CHECKING', 'Personal Checking', 4521.33, 'USD', 'ACTIVE', NOW()),
                ('acc22222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '****5678', 'SAVINGS', 'Savings', 12340.00, 'USD', 'ACTIVE', NOW()),
                ('acc33333-3333-3333-3333-333333333333', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '****4521', 'CHECKING', 'Business Operating', 5400000.00, 'USD', 'ACTIVE', NOW()),
                ('acc44444-4444-4444-4444-444444444444', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '****7832', 'CHECKING', 'Payroll', 234500.00, 'USD', 'ACTIVE', NOW()),
                ('acc55555-5555-5555-5555-555555555555', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '****1199', 'MONEY_MARKET', 'Business Reserve', 1250000.00, 'USD', 'ACTIVE', NOW())
            ON CONFLICT (id) DO NOTHING
            """);

        log.info("Demo data reseeded successfully");
    }

    /**
     * State object for debug controls.
     */
    public record DebugControlsState(
            Integer riskOverride,
            LocalDateTime timeOverride,
            boolean riskOverrideActive,
            boolean timeOverrideActive
    ) {}
}
