package com.anybank.identity.service;

import com.anybank.identity.dto.DebugEvent;
import com.anybank.identity.dto.DebugEvent.EventType;
import com.anybank.identity.security.CorrelationIdFilter;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentLinkedDeque;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.function.Predicate;
import java.util.stream.Collectors;

/**
 * Service for managing debug events.
 * Provides a circular buffer for event storage and SSE broadcasting capabilities.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class DebugEventService {

    private static final int MAX_EVENTS = 1000;
    private static final long SSE_TIMEOUT = 30 * 60 * 1000L; // 30 minutes

    private final ObjectMapper objectMapper;

    private final ConcurrentLinkedDeque<DebugEvent> eventBuffer = new ConcurrentLinkedDeque<>();
    private final CopyOnWriteArrayList<SseEmitter> sseEmitters = new CopyOnWriteArrayList<>();

    /**
     * Emits a debug event - adds to buffer and broadcasts via SSE.
     * This method is non-blocking and catches exceptions to prevent debug failures from affecting the app.
     */
    public void emit(DebugEvent event) {
        try {
            // Ensure event has required fields
            if (event.getId() == null) {
                event.setId(UUID.randomUUID());
            }
            if (event.getTimestamp() == null) {
                event.setTimestamp(Instant.now());
            }

            // Auto-populate correlation ID if not set
            if (event.getCorrelationId() == null) {
                event.setCorrelationId(CorrelationIdFilter.getCurrentCorrelationId());
            }
            if (event.getSessionId() == null) {
                event.setSessionId(CorrelationIdFilter.getCurrentSessionId());
            }

            // Add to circular buffer
            addToBuffer(event);

            // Broadcast to SSE subscribers
            broadcastEvent(event);

            log.debug("Debug event emitted: type={}, action={}, correlationId={}",
                    event.getType(), event.getAction(), event.getCorrelationId());
        } catch (Exception e) {
            log.warn("Failed to emit debug event: {}", e.getMessage());
        }
    }

    /**
     * Adds an event to the circular buffer, removing oldest if at capacity.
     */
    private void addToBuffer(DebugEvent event) {
        eventBuffer.addLast(event);
        while (eventBuffer.size() > MAX_EVENTS) {
            eventBuffer.pollFirst();
        }
    }

    /**
     * Broadcasts an event to all SSE subscribers.
     */
    private void broadcastEvent(DebugEvent event) {
        if (sseEmitters.isEmpty()) {
            return;
        }

        List<SseEmitter> deadEmitters = new ArrayList<>();

        for (SseEmitter emitter : sseEmitters) {
            try {
                String data = objectMapper.writeValueAsString(event);
                emitter.send(SseEmitter.event()
                        .name("debug-event")
                        .data(data));
            } catch (IOException e) {
                deadEmitters.add(emitter);
            }
        }

        // Remove dead emitters
        sseEmitters.removeAll(deadEmitters);
    }

    /**
     * Creates a new SSE emitter for event streaming.
     */
    public SseEmitter createEmitter() {
        SseEmitter emitter = new SseEmitter(SSE_TIMEOUT);

        emitter.onCompletion(() -> {
            sseEmitters.remove(emitter);
            log.debug("SSE emitter completed, {} remaining", sseEmitters.size());
        });

        emitter.onTimeout(() -> {
            sseEmitters.remove(emitter);
            log.debug("SSE emitter timed out, {} remaining", sseEmitters.size());
        });

        emitter.onError(e -> {
            sseEmitters.remove(emitter);
            log.debug("SSE emitter error: {}, {} remaining", e.getMessage(), sseEmitters.size());
        });

        sseEmitters.add(emitter);
        log.debug("New SSE emitter created, {} total", sseEmitters.size());

        // Send initial connection event
        try {
            emitter.send(SseEmitter.event()
                    .name("connected")
                    .data("{\"message\":\"Connected to debug event stream\"}"));
        } catch (IOException e) {
            log.warn("Failed to send connection event: {}", e.getMessage());
        }

        return emitter;
    }

    /**
     * Gets events with optional filtering.
     */
    public List<DebugEvent> getEvents(EventType type, String sessionId, String correlationId, Integer limit) {
        Predicate<DebugEvent> filter = event -> {
            if (type != null && event.getType() != type) {
                return false;
            }
            if (sessionId != null && !sessionId.equals(event.getSessionId())) {
                return false;
            }
            if (correlationId != null && !correlationId.equals(event.getCorrelationId())) {
                return false;
            }
            return true;
        };

        int effectiveLimit = limit != null ? limit : 100;

        return eventBuffer.stream()
                .filter(filter)
                .sorted(Comparator.comparing(DebugEvent::getTimestamp).reversed())
                .limit(effectiveLimit)
                .collect(Collectors.toList());
    }

    /**
     * Gets all events for a specific session.
     */
    public List<DebugEvent> getEventsForSession(String sessionId) {
        return eventBuffer.stream()
                .filter(event -> sessionId.equals(event.getSessionId()))
                .sorted(Comparator.comparing(DebugEvent::getTimestamp))
                .collect(Collectors.toList());
    }

    /**
     * Gets events by correlation ID.
     */
    public List<DebugEvent> getEventsByCorrelationId(String correlationId) {
        return eventBuffer.stream()
                .filter(event -> correlationId.equals(event.getCorrelationId()))
                .sorted(Comparator.comparing(DebugEvent::getTimestamp))
                .collect(Collectors.toList());
    }

    /**
     * Gets recent OPA decision events.
     */
    public List<DebugEvent> getOpaDecisions(Integer limit) {
        int effectiveLimit = limit != null ? limit : 50;
        return eventBuffer.stream()
                .filter(event -> event.getType() == EventType.OPA)
                .sorted(Comparator.comparing(DebugEvent::getTimestamp).reversed())
                .limit(effectiveLimit)
                .collect(Collectors.toList());
    }

    /**
     * Clears all events from the buffer.
     */
    public void clearEvents() {
        eventBuffer.clear();
        log.info("Debug event buffer cleared");
    }

    /**
     * Gets the current event count.
     */
    public int getEventCount() {
        return eventBuffer.size();
    }

    /**
     * Gets the number of active SSE subscribers.
     */
    public int getSubscriberCount() {
        return sseEmitters.size();
    }

    /**
     * Helper method to emit a simple event.
     */
    public void emitSimple(EventType type, String action, Map<String, Object> details) {
        emit(DebugEvent.builder()
                .id(UUID.randomUUID())
                .timestamp(Instant.now())
                .type(type)
                .action(action)
                .details(details)
                .build());
    }
}
