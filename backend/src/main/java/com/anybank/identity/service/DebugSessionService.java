package com.anybank.identity.service;

import com.anybank.identity.dto.DebugSession;
import com.anybank.identity.dto.DebugSession.SessionStatus;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * Service for tracking active demo sessions.
 */
@Service
@Slf4j
public class DebugSessionService {

    private static final Duration SESSION_TIMEOUT = Duration.ofMinutes(30);

    private final ConcurrentHashMap<String, DebugSession> sessions = new ConcurrentHashMap<>();

    /**
     * Starts a new debug session.
     */
    public DebugSession startSession(String visitorSessionId, UUID userId, String userEmail) {
        // Check if session already exists
        DebugSession existing = sessions.get(visitorSessionId);
        if (existing != null && existing.getStatus() == SessionStatus.ACTIVE) {
            existing.touch();
            return existing;
        }

        DebugSession session = DebugSession.builder()
                .id(UUID.randomUUID().toString())
                .visitorSessionId(visitorSessionId)
                .userId(userId)
                .userEmail(userEmail)
                .startedAt(Instant.now())
                .lastActivity(Instant.now())
                .eventCount(0)
                .contextSwitches(0)
                .status(SessionStatus.ACTIVE)
                .build();

        sessions.put(visitorSessionId, session);
        log.info("Debug session started: id={}, visitorSessionId={}, userEmail={}",
                session.getId(), visitorSessionId, userEmail);

        return session;
    }

    /**
     * Gets a session by its visitor session ID.
     */
    public Optional<DebugSession> getSession(String sessionId) {
        DebugSession session = sessions.get(sessionId);
        if (session != null) {
            checkSessionExpiration(session);
        }
        return Optional.ofNullable(session);
    }

    /**
     * Gets a session by its internal ID.
     */
    public Optional<DebugSession> getSessionById(String id) {
        return sessions.values().stream()
                .filter(s -> s.getId().equals(id))
                .findFirst()
                .map(session -> {
                    checkSessionExpiration(session);
                    return session;
                });
    }

    /**
     * Updates a session with new information.
     */
    public void updateSession(String sessionId, UUID currentTenantId, String currentTenantName,
                               Instant identityTokenExp, Instant accessTokenExp) {
        DebugSession session = sessions.get(sessionId);
        if (session == null) {
            return;
        }

        UUID previousTenantId = session.getCurrentTenantId();

        session.setCurrentTenantId(currentTenantId);
        session.setCurrentTenantName(currentTenantName);
        session.setIdentityTokenExp(identityTokenExp);
        session.setAccessTokenExp(accessTokenExp);
        session.touch();

        // Track context switches
        if (previousTenantId != null && !previousTenantId.equals(currentTenantId)) {
            session.incrementContextSwitches();
            log.debug("Context switch detected for session {}: {} -> {}",
                    sessionId, previousTenantId, currentTenantId);
        }
    }

    /**
     * Updates session user info.
     */
    public void updateSessionUser(String sessionId, UUID userId, String userEmail) {
        DebugSession session = sessions.get(sessionId);
        if (session == null) {
            return;
        }

        session.setUserId(userId);
        session.setUserEmail(userEmail);
        session.touch();
    }

    /**
     * Increments the event count for a session.
     */
    public void incrementEventCount(String sessionId) {
        DebugSession session = sessions.get(sessionId);
        if (session != null) {
            session.incrementEventCount();
            session.touch();
        }
    }

    /**
     * Ends a session.
     */
    public void endSession(String sessionId) {
        DebugSession session = sessions.get(sessionId);
        if (session != null) {
            session.setStatus(SessionStatus.TERMINATED);
            log.info("Debug session terminated: id={}, eventCount={}, contextSwitches={}",
                    session.getId(), session.getEventCount(), session.getContextSwitches());
        }
    }

    /**
     * Gets all sessions.
     */
    public List<DebugSession> getAllSessions() {
        // Clean up expired sessions first
        cleanupExpiredSessions();

        return sessions.values().stream()
                .sorted(Comparator.comparing(DebugSession::getLastActivity).reversed())
                .collect(Collectors.toList());
    }

    /**
     * Gets all active sessions.
     */
    public List<DebugSession> getActiveSessions() {
        cleanupExpiredSessions();

        return sessions.values().stream()
                .filter(s -> s.getStatus() == SessionStatus.ACTIVE)
                .sorted(Comparator.comparing(DebugSession::getLastActivity).reversed())
                .collect(Collectors.toList());
    }

    /**
     * Gets sessions count by status.
     */
    public Map<SessionStatus, Long> getSessionCounts() {
        return sessions.values().stream()
                .collect(Collectors.groupingBy(DebugSession::getStatus, Collectors.counting()));
    }

    /**
     * Checks and updates session expiration status.
     */
    private void checkSessionExpiration(DebugSession session) {
        if (session.getStatus() == SessionStatus.ACTIVE) {
            Instant expirationTime = session.getLastActivity().plus(SESSION_TIMEOUT);
            if (Instant.now().isAfter(expirationTime)) {
                session.setStatus(SessionStatus.EXPIRED);
                log.debug("Session {} marked as expired", session.getId());
            }
        }
    }

    /**
     * Cleans up expired sessions.
     */
    private void cleanupExpiredSessions() {
        Instant cutoff = Instant.now().minus(SESSION_TIMEOUT.multipliedBy(2));

        sessions.entrySet().removeIf(entry -> {
            DebugSession session = entry.getValue();
            checkSessionExpiration(session);

            // Remove very old expired/terminated sessions
            if (session.getStatus() != SessionStatus.ACTIVE) {
                return session.getLastActivity().isBefore(cutoff);
            }
            return false;
        });
    }

    /**
     * Clears all sessions.
     */
    public void clearAllSessions() {
        sessions.clear();
        log.info("All debug sessions cleared");
    }
}
