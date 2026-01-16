package com.anybank.identity.security;

import com.anybank.identity.dto.DebugEvent;
import com.anybank.identity.dto.DebugEvent.EventType;
import com.anybank.identity.service.DebugEventService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Instant;
import java.util.Enumeration;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Filter that extracts or generates a correlation ID for request tracing.
 * This filter runs FIRST in the filter chain to ensure all downstream
 * components have access to the correlation ID.
 *
 * Correlation ID format: sess_{sessionId}_req_{counter}
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
@RequiredArgsConstructor
@Slf4j
public class CorrelationIdFilter extends OncePerRequestFilter {

    private final DebugEventService debugEventService;

    public static final String CORRELATION_ID_HEADER = "X-Correlation-ID";
    public static final String CORRELATION_ID_MDC_KEY = "correlationId";
    public static final String SESSION_ID_MDC_KEY = "sessionId";
    public static final String CORRELATION_ID_ATTRIBUTE = "correlationId";

    private static final AtomicLong REQUEST_COUNTER = new AtomicLong(0);

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        String correlationId = extractOrGenerateCorrelationId(request);
        String sessionId = extractSessionId(request);
        long startTime = System.currentTimeMillis();

        try {
            // Store in MDC for logging
            MDC.put(CORRELATION_ID_MDC_KEY, correlationId);
            if (sessionId != null) {
                MDC.put(SESSION_ID_MDC_KEY, sessionId);
            }

            // Store as request attribute for downstream access
            request.setAttribute(CORRELATION_ID_ATTRIBUTE, correlationId);

            // Add to response header for client correlation
            response.setHeader(CORRELATION_ID_HEADER, correlationId);

            log.debug("Request started: correlationId={}, path={}, method={}",
                    correlationId, request.getRequestURI(), request.getMethod());

            // Emit request_received event (action lineage: inbound packet)
            emitRequestReceivedEvent(request, correlationId);

            filterChain.doFilter(request, response);

            long duration = System.currentTimeMillis() - startTime;
            log.debug("Request completed: correlationId={}, status={}",
                    correlationId, response.getStatus());

            // Emit response_sent event (action lineage: outbound packet)
            emitResponseSentEvent(request, response, correlationId, duration);
        } finally {
            MDC.remove(CORRELATION_ID_MDC_KEY);
            MDC.remove(SESSION_ID_MDC_KEY);
        }
    }

    /**
     * Extracts correlation ID from request header or generates a new one.
     */
    private String extractOrGenerateCorrelationId(HttpServletRequest request) {
        String correlationId = request.getHeader(CORRELATION_ID_HEADER);

        if (correlationId != null && !correlationId.isEmpty()) {
            return correlationId;
        }

        // Generate new correlation ID
        String sessionId = extractSessionId(request);
        long requestNum = REQUEST_COUNTER.incrementAndGet();

        if (sessionId != null && !sessionId.isEmpty()) {
            return String.format("sess_%s_req_%d", sessionId, requestNum);
        }

        return String.format("req_%d_%d", System.currentTimeMillis(), requestNum);
    }

    /**
     * Extracts session ID from various sources.
     */
    private String extractSessionId(HttpServletRequest request) {
        // Try X-Session-ID header first
        String sessionId = request.getHeader("X-Session-ID");
        if (sessionId != null && !sessionId.isEmpty()) {
            return sessionId;
        }

        // Try to get from HTTP session (if exists)
        if (request.getSession(false) != null) {
            return request.getSession(false).getId();
        }

        return null;
    }

    /**
     * Gets the current correlation ID from the request context.
     */
    public static String getCurrentCorrelationId() {
        return MDC.get(CORRELATION_ID_MDC_KEY);
    }

    /**
     * Gets the current session ID from the request context.
     */
    public static String getCurrentSessionId() {
        return MDC.get(SESSION_ID_MDC_KEY);
    }

    /**
     * Emits a debug event when a request is received (action lineage: inbound packet).
     */
    private void emitRequestReceivedEvent(HttpServletRequest request, String correlationId) {
        if (shouldNotEmitEvent(request)) {
            return;
        }

        try {
            Map<String, Object> details = new HashMap<>();
            details.put("direction", "inbound");
            details.put("from", "frontend");
            details.put("to", "backend");
            details.put("method", request.getMethod());
            details.put("path", request.getRequestURI());
            details.put("queryString", request.getQueryString());

            // Capture relevant headers (not auth tokens for security)
            Map<String, String> headers = new HashMap<>();
            headers.put("Content-Type", request.getHeader("Content-Type"));
            headers.put("X-Tenant-ID", request.getHeader("X-Tenant-ID"));
            headers.put("X-Request-Source", request.getHeader("X-Request-Source"));
            headers.put("User-Agent", request.getHeader("User-Agent"));
            details.put("headers", headers);

            DebugEvent event = DebugEvent.builder()
                    .id(UUID.randomUUID())
                    .timestamp(Instant.now())
                    .correlationId(correlationId)
                    .type(EventType.API)
                    .action("request_received")
                    .details(details)
                    .build();

            debugEventService.emit(event);
        } catch (Exception e) {
            log.warn("Failed to emit request_received event: {}", e.getMessage());
        }
    }

    /**
     * Emits a debug event when a response is sent (action lineage: outbound packet).
     */
    private void emitResponseSentEvent(HttpServletRequest request, HttpServletResponse response,
                                       String correlationId, long duration) {
        if (shouldNotEmitEvent(request)) {
            return;
        }

        try {
            Map<String, Object> details = new HashMap<>();
            details.put("direction", "outbound");
            details.put("from", "backend");
            details.put("to", "frontend");
            details.put("method", request.getMethod());
            details.put("path", request.getRequestURI());
            details.put("statusCode", response.getStatus());
            details.put("duration", duration);

            // Capture response headers
            Map<String, String> headers = new HashMap<>();
            headers.put("Content-Type", response.getHeader("Content-Type"));
            headers.put("X-Correlation-ID", response.getHeader("X-Correlation-ID"));
            details.put("headers", headers);

            DebugEvent event = DebugEvent.builder()
                    .id(UUID.randomUUID())
                    .timestamp(Instant.now())
                    .correlationId(correlationId)
                    .type(EventType.API)
                    .action("response_sent")
                    .details(details)
                    .build();

            debugEventService.emit(event);
        } catch (Exception e) {
            log.warn("Failed to emit response_sent event: {}", e.getMessage());
        }
    }

    /**
     * Determines if events should NOT be emitted for this request (debug/actuator endpoints).
     */
    private boolean shouldNotEmitEvent(HttpServletRequest request) {
        String path = request.getRequestURI();
        return path.startsWith("/actuator") ||
               path.startsWith("/swagger") ||
               path.startsWith("/v3/api-docs") ||
               path.startsWith("/debug");
    }
}
