package com.anybank.identity.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/**
 * DTO representing a debug event in the system.
 * Debug events capture significant actions for observability and debugging purposes.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class DebugEvent {

    /**
     * Unique event identifier.
     */
    private UUID id;

    /**
     * When the event occurred.
     */
    private Instant timestamp;

    /**
     * Correlation ID linking related events across the request lifecycle.
     */
    private String correlationId;

    /**
     * Session ID if available.
     */
    private String sessionId;

    /**
     * Type of event.
     */
    private EventType type;

    /**
     * Specific action that triggered the event.
     * Examples: "tenant_context_extracted", "risk_score_calculated", "opa_decision"
     */
    private String action;

    /**
     * Actor information for the event.
     */
    private Actor actor;

    /**
     * Event-specific details.
     */
    private Map<String, Object> details;

    /**
     * Additional metadata.
     */
    private Map<String, Object> metadata;

    /**
     * Types of debug events.
     */
    public enum EventType {
        UI,      // Frontend UI events
        API,     // API request/response events
        OPA,     // OPA policy decision events
        DB,      // Database operation events
        AUTH,    // Authentication events
        TOKEN,   // Token-related events
        AUDIT,   // Audit log events
        ERROR    // Error events
    }

    /**
     * Actor information for events.
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class Actor {
        private UUID userId;
        private String email;
        private UUID tenantId;
        private String tenantName;
        private String role;
    }

    /**
     * Creates a new DebugEvent with auto-generated ID and timestamp.
     */
    public static DebugEvent create(EventType type, String action) {
        return DebugEvent.builder()
                .id(UUID.randomUUID())
                .timestamp(Instant.now())
                .type(type)
                .action(action)
                .build();
    }

    /**
     * Builder helper to create an event with correlation context.
     */
    public static DebugEventBuilder withCorrelation(String correlationId, String sessionId) {
        return DebugEvent.builder()
                .id(UUID.randomUUID())
                .timestamp(Instant.now())
                .correlationId(correlationId)
                .sessionId(sessionId);
    }
}
