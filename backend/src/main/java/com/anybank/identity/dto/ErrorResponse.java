package com.anybank.identity.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.Map;

/**
 * Standard error response structure for all API errors.
 *
 * Used by GlobalExceptionHandler to return consistent error responses.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ErrorResponse {

    /**
     * Error code for programmatic error handling.
     * Examples: ACCESS_DENIED, INVALID_TOKEN, HIGH_RISK, TENANT_NOT_FOUND
     */
    private String code;

    /**
     * Human-readable error message.
     */
    private String message;

    /**
     * Optional additional context about the error.
     * Can include validation errors, resource IDs, etc.
     */
    private Map<String, Object> details;

    /**
     * Timestamp when the error occurred.
     */
    @Builder.Default
    private Instant timestamp = Instant.now();

    /**
     * Request path that caused the error.
     */
    private String path;
}
