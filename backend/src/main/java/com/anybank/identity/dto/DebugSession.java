package com.anybank.identity.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

/**
 * DTO representing a debug session for tracking demo user activities.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class DebugSession {

    /**
     * Unique session identifier.
     */
    private String id;

    /**
     * Visitor session ID from the frontend.
     */
    private String visitorSessionId;

    /**
     * User ID if authenticated.
     */
    private UUID userId;

    /**
     * User email if authenticated.
     */
    private String userEmail;

    /**
     * When the session started.
     */
    private Instant startedAt;

    /**
     * Last activity timestamp.
     */
    private Instant lastActivity;

    /**
     * Current tenant ID if in a tenant context.
     */
    private UUID currentTenantId;

    /**
     * Current tenant name if in a tenant context.
     */
    private String currentTenantName;

    /**
     * Identity token expiration time.
     */
    private Instant identityTokenExp;

    /**
     * Access token expiration time.
     */
    private Instant accessTokenExp;

    /**
     * Number of events recorded for this session.
     */
    private long eventCount;

    /**
     * Number of context switches performed.
     */
    private int contextSwitches;

    /**
     * Current session status.
     */
    private SessionStatus status;

    /**
     * Session status enumeration.
     */
    public enum SessionStatus {
        ACTIVE,
        EXPIRED,
        TERMINATED
    }

    /**
     * Creates a new active session.
     */
    public static DebugSession createNew(String visitorSessionId) {
        return DebugSession.builder()
                .id(UUID.randomUUID().toString())
                .visitorSessionId(visitorSessionId)
                .startedAt(Instant.now())
                .lastActivity(Instant.now())
                .eventCount(0)
                .contextSwitches(0)
                .status(SessionStatus.ACTIVE)
                .build();
    }

    /**
     * Updates the last activity timestamp.
     */
    public void touch() {
        this.lastActivity = Instant.now();
    }

    /**
     * Increments the event count.
     */
    public void incrementEventCount() {
        this.eventCount++;
    }

    /**
     * Increments the context switch count.
     */
    public void incrementContextSwitches() {
        this.contextSwitches++;
    }
}
