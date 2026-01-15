package com.anybank.identity.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
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
@Slf4j
public class CorrelationIdFilter extends OncePerRequestFilter {

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

            filterChain.doFilter(request, response);

            log.debug("Request completed: correlationId={}, status={}",
                    correlationId, response.getStatus());
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
}
