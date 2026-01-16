package com.anybank.identity.controller;

import com.anybank.identity.dto.DebugEvent;
import com.anybank.identity.dto.DebugEvent.EventType;
import com.anybank.identity.dto.DebugSession;
import com.anybank.identity.entity.Account;
import com.anybank.identity.entity.Membership;
import com.anybank.identity.entity.Tenant;
import com.anybank.identity.entity.User;
import com.anybank.identity.repository.AccountRepository;
import com.anybank.identity.repository.MembershipRepository;
import com.anybank.identity.repository.TenantRepository;
import com.anybank.identity.repository.UserRepository;
import com.anybank.identity.service.DebugControlsService;
import com.anybank.identity.service.DebugControlsService.DebugControlsState;
import com.anybank.identity.service.DebugEventService;
import com.anybank.identity.service.DebugSessionService;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Controller for debug and observability endpoints.
 * Provides access to debug events, sessions, and control operations.
 */
@RestController
@RequestMapping("/debug")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "Debug", description = "Debug and observability endpoints")
public class DebugController {

    private final DebugEventService debugEventService;
    private final DebugSessionService debugSessionService;
    private final DebugControlsService debugControlsService;
    private final UserRepository userRepository;
    private final TenantRepository tenantRepository;
    private final MembershipRepository membershipRepository;
    private final AccountRepository accountRepository;

    // ==================== Event Endpoints ====================

    @GetMapping(value = "/events/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    @Operation(summary = "Subscribe to live debug events via SSE")
    public SseEmitter streamEvents() {
        log.info("New SSE connection for debug events");
        return debugEventService.createEmitter();
    }

    @GetMapping("/events")
    @Operation(summary = "List recent debug events with optional filters")
    public ResponseEntity<Map<String, Object>> getEvents(
            @RequestParam(required = false) EventType type,
            @RequestParam(required = false) String sessionId,
            @RequestParam(required = false) String correlationId,
            @RequestParam(required = false, defaultValue = "100") Integer limit
    ) {
        List<DebugEvent> events = debugEventService.getEvents(type, sessionId, correlationId, limit);

        Map<String, Object> response = new HashMap<>();
        response.put("events", events);
        response.put("count", events.size());
        response.put("total", debugEventService.getEventCount());

        return ResponseEntity.ok(response);
    }

    // ==================== Session Endpoints ====================

    @GetMapping("/sessions")
    @Operation(summary = "List all debug sessions")
    public ResponseEntity<Map<String, Object>> getSessions(
            @RequestParam(required = false, defaultValue = "false") boolean activeOnly
    ) {
        List<DebugSession> sessions = activeOnly ?
                debugSessionService.getActiveSessions() :
                debugSessionService.getAllSessions();

        Map<String, Object> response = new HashMap<>();
        response.put("sessions", sessions);
        response.put("count", sessions.size());
        response.put("counts", debugSessionService.getSessionCounts());

        return ResponseEntity.ok(response);
    }

    @GetMapping("/sessions/{id}")
    @Operation(summary = "Get session details")
    public ResponseEntity<DebugSession> getSession(@PathVariable String id) {
        return debugSessionService.getSessionById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping({"/sessions/{id}/timeline", "/workflows/sessions/{id}/timeline"})
    @Operation(summary = "Get chronological event list for a session")
    public ResponseEntity<Map<String, Object>> getSessionTimeline(@PathVariable String id) {
        return debugSessionService.getSessionById(id)
                .map(session -> {
                    List<DebugEvent> events = debugEventService.getEventsForSession(session.getVisitorSessionId());

                    Map<String, Object> response = new HashMap<>();
                    response.put("session", session);
                    response.put("events", events);
                    response.put("eventCount", events.size());

                    return ResponseEntity.ok(response);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    // ==================== Auth Endpoints ====================

    @GetMapping({"/tokens", "/auth/tokens"})
    @Operation(summary = "List active tokens (sessions with token info)")
    public ResponseEntity<Map<String, Object>> getActiveTokens() {
        List<DebugSession> sessions = debugSessionService.getActiveSessions().stream()
                .filter(s -> s.getAccessTokenExp() != null || s.getIdentityTokenExp() != null)
                .toList();

        Map<String, Object> response = new HashMap<>();
        response.put("tokens", sessions.stream().map(s -> {
            Map<String, Object> token = new HashMap<>();
            token.put("sessionId", s.getId());
            token.put("userEmail", s.getUserEmail());
            token.put("identityTokenExp", s.getIdentityTokenExp());
            token.put("accessTokenExp", s.getAccessTokenExp());
            token.put("currentTenant", s.getCurrentTenantName());
            return token;
        }).toList());
        response.put("count", sessions.size());

        return ResponseEntity.ok(response);
    }

    @PostMapping({"/tokens/decode", "/auth/decode"})
    @Operation(summary = "Decode a JWT and return claims")
    public ResponseEntity<Map<String, Object>> decodeToken(@RequestBody TokenDecodeRequest request) {
        try {
            SignedJWT jwt = SignedJWT.parse(request.token());
            JWTClaimsSet claims = jwt.getJWTClaimsSet();

            Map<String, Object> response = new HashMap<>();
            response.put("header", jwt.getHeader().toJSONObject());
            response.put("claims", claims.toJSONObject());
            response.put("valid", true);

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, Object> response = new HashMap<>();
            response.put("valid", false);
            response.put("error", e.getMessage());

            return ResponseEntity.badRequest().body(response);
        }
    }

    @PostMapping("/auth/verify")
    @Operation(summary = "Verify a JWT signature (placeholder - always returns unverified)")
    public ResponseEntity<Map<String, Object>> verifyToken(@RequestBody TokenDecodeRequest request) {
        // Note: Actual verification would require the Keycloak public key
        Map<String, Object> response = new HashMap<>();
        response.put("verified", false);
        response.put("message", "Signature verification not implemented in debug mode");
        return ResponseEntity.ok(response);
    }

    @GetMapping("/auth/keycloak/events")
    @Operation(summary = "List recent Keycloak authentication events")
    public ResponseEntity<Map<String, Object>> getKeycloakEvents(
            @RequestParam(required = false, defaultValue = "50") Integer limit
    ) {
        // Get AUTH and TOKEN events from the debug event stream
        List<DebugEvent> authEvents = debugEventService.getEvents(EventType.AUTH, null, null, limit);
        List<DebugEvent> tokenEvents = debugEventService.getEvents(EventType.TOKEN, null, null, limit);

        // Combine and sort by timestamp
        List<Map<String, Object>> events = new java.util.ArrayList<>();

        authEvents.forEach(e -> {
            Map<String, Object> event = new HashMap<>();
            event.put("id", e.getId());
            event.put("type", "AUTH");
            event.put("timestamp", e.getTimestamp());
            event.put("sessionId", e.getSessionId());
            event.put("action", e.getAction());
            event.put("details", e.getDetails());
            events.add(event);
        });

        tokenEvents.forEach(e -> {
            Map<String, Object> event = new HashMap<>();
            event.put("id", e.getId());
            event.put("type", "TOKEN");
            event.put("timestamp", e.getTimestamp());
            event.put("sessionId", e.getSessionId());
            event.put("action", e.getAction());
            event.put("details", e.getDetails());
            events.add(event);
        });

        // Sort by timestamp descending
        events.sort((a, b) -> {
            String tsA = String.valueOf(a.get("timestamp"));
            String tsB = String.valueOf(b.get("timestamp"));
            return tsB.compareTo(tsA);
        });

        // Limit the combined results
        List<Map<String, Object>> limited = events.stream().limit(limit).toList();

        Map<String, Object> response = new HashMap<>();
        response.put("events", limited);
        response.put("count", limited.size());

        return ResponseEntity.ok(response);
    }

    // ==================== OPA Endpoints ====================

    @GetMapping("/opa/decisions")
    @Operation(summary = "List recent OPA policy decisions")
    public ResponseEntity<Map<String, Object>> getOpaDecisions(
            @RequestParam(required = false, defaultValue = "50") Integer limit
    ) {
        List<DebugEvent> decisions = debugEventService.getOpaDecisions(limit);

        Map<String, Object> response = new HashMap<>();
        response.put("decisions", decisions);
        response.put("count", decisions.size());

        return ResponseEntity.ok(response);
    }

    @GetMapping("/policy/policies")
    @Operation(summary = "List loaded OPA policies")
    public ResponseEntity<Map<String, Object>> getPolicies() {
        // Return sample policies for the debug UI
        List<Map<String, Object>> policies = List.of(
            Map.of(
                "id", "authz",
                "name", "Authorization Policy",
                "package", "anybank.authz",
                "raw", """
                    package anybank.authz

                    import future.keywords.if
                    import future.keywords.in

                    default allow := false

                    # Allow if user has required role for the action
                    allow if {
                        required_role := action_roles[input.action]
                        required_role in input.user.roles
                    }

                    # Allow admins to do anything
                    allow if {
                        "admin" in input.user.roles
                    }

                    # Action to role mapping
                    action_roles := {
                        "view_balance": "viewer",
                        "view_transactions": "viewer",
                        "internal_transfer": "operator",
                        "external_transfer": "manager",
                        "wire_transfer": "admin"
                    }
                    """
            ),
            Map.of(
                "id", "risk",
                "name", "Risk Assessment Policy",
                "package", "anybank.risk",
                "raw", """
                    package anybank.risk

                    import future.keywords.if

                    default risk_score := 0

                    # Calculate risk score based on factors
                    risk_score := score if {
                        score := sum([
                            new_device_score,
                            unusual_location_score,
                            off_hours_score,
                            velocity_score
                        ])
                    }

                    new_device_score := 30 if input.device.is_new
                    new_device_score := 0 if not input.device.is_new

                    unusual_location_score := 25 if input.location.is_unusual
                    unusual_location_score := 0 if not input.location.is_unusual

                    off_hours_score := 15 if input.time.is_off_hours
                    off_hours_score := 0 if not input.time.is_off_hours

                    velocity_score := 20 if input.velocity.is_high
                    velocity_score := 0 if not input.velocity.is_high

                    # Action thresholds
                    action_allowed if {
                        threshold := action_thresholds[input.action]
                        risk_score < threshold
                    }

                    action_thresholds := {
                        "view_balance": 80,
                        "view_transactions": 70,
                        "internal_transfer": 50,
                        "external_transfer": 30,
                        "wire_transfer": 10
                    }
                    """
            ),
            Map.of(
                "id", "tenant",
                "name", "Tenant Access Policy",
                "package", "anybank.tenant",
                "raw", """
                    package anybank.tenant

                    import future.keywords.if
                    import future.keywords.in

                    default allow := false

                    # Allow access if user is a member of the tenant
                    allow if {
                        input.tenant.id in input.user.tenant_memberships
                    }

                    # Allow access if user has global admin role
                    allow if {
                        "global_admin" in input.user.roles
                    }
                    """
            )
        );

        Map<String, Object> response = new HashMap<>();
        response.put("policies", policies);
        response.put("count", policies.size());

        return ResponseEntity.ok(response);
    }

    @PostMapping("/policy/evaluate")
    @Operation(summary = "Evaluate a policy with given input")
    public ResponseEntity<Map<String, Object>> evaluatePolicy(@RequestBody Map<String, Object> input) {
        // Simulate policy evaluation for demo purposes
        Map<String, Object> result = new HashMap<>();

        // Check if action is provided
        String action = (String) input.get("action");
        if (action == null) {
            result.put("allow", false);
            result.put("reason", "No action specified");
            return ResponseEntity.ok(Map.of("result", result));
        }

        // Simple mock evaluation based on action
        boolean allowed = switch (action) {
            case "view_balance", "view_transactions" -> true;
            case "internal_transfer" -> true;
            case "external_transfer" -> {
                // Check if user has manager role
                @SuppressWarnings("unchecked")
                Map<String, Object> user = (Map<String, Object>) input.get("user");
                if (user != null) {
                    @SuppressWarnings("unchecked")
                    List<String> roles = (List<String>) user.get("roles");
                    yield roles != null && (roles.contains("manager") || roles.contains("admin"));
                }
                yield false;
            }
            case "wire_transfer" -> {
                @SuppressWarnings("unchecked")
                Map<String, Object> user = (Map<String, Object>) input.get("user");
                if (user != null) {
                    @SuppressWarnings("unchecked")
                    List<String> roles = (List<String>) user.get("roles");
                    yield roles != null && roles.contains("admin");
                }
                yield false;
            }
            default -> false;
        };

        result.put("allow", allowed);
        if (!allowed) {
            result.put("reason", "Insufficient permissions for action: " + action);
        }

        return ResponseEntity.ok(Map.of("result", result));
    }

    // ==================== Data Endpoints ====================

    @GetMapping("/data/users")
    @Operation(summary = "List all users")
    public ResponseEntity<List<User>> getUsers() {
        List<User> users = userRepository.findAll();
        return ResponseEntity.ok(users);
    }

    @GetMapping("/data/tenants")
    @Operation(summary = "List all tenants")
    public ResponseEntity<List<Tenant>> getTenants() {
        List<Tenant> tenants = tenantRepository.findAll();
        return ResponseEntity.ok(tenants);
    }

    @GetMapping("/data/memberships")
    @Operation(summary = "List all memberships")
    @Transactional(readOnly = true)
    public ResponseEntity<List<Map<String, Object>>> getMemberships() {
        List<Membership> memberships = membershipRepository.findAll();
        // Convert to maps to avoid lazy loading issues and provide flattened data
        List<Map<String, Object>> result = memberships.stream().map(m -> {
            Map<String, Object> map = new HashMap<>();
            map.put("id", m.getId());
            map.put("userId", m.getUser().getId());
            map.put("userEmail", m.getUser().getEmail());
            map.put("userName", m.getUser().getDisplayName());
            map.put("tenantId", m.getTenant().getId());
            map.put("tenantName", m.getTenant().getName());
            map.put("tenantType", m.getTenant().getType());
            map.put("role", m.getRole());
            map.put("status", m.getStatus());
            map.put("invitedAt", m.getInvitedAt());
            map.put("acceptedAt", m.getAcceptedAt());
            map.put("createdAt", m.getCreatedAt());
            return map;
        }).toList();
        return ResponseEntity.ok(result);
    }

    @GetMapping("/data/accounts")
    @Operation(summary = "List all accounts")
    @Transactional(readOnly = true)
    public ResponseEntity<List<Map<String, Object>>> getAccounts() {
        List<Account> accounts = accountRepository.findAll();
        // Convert to maps to avoid lazy loading issues and provide flattened data
        List<Map<String, Object>> result = accounts.stream().map(a -> {
            Map<String, Object> map = new HashMap<>();
            map.put("id", a.getId());
            map.put("tenantId", a.getTenant().getId());
            map.put("tenantName", a.getTenant().getName());
            map.put("accountNumber", a.getAccountNumber());
            map.put("accountType", a.getAccountType());
            map.put("name", a.getName());
            map.put("balance", a.getBalance());
            map.put("currency", a.getCurrency());
            map.put("status", a.getStatus());
            map.put("createdAt", a.getCreatedAt());
            return map;
        }).toList();
        return ResponseEntity.ok(result);
    }

    @GetMapping("/data/sessions")
    @Operation(summary = "List all debug sessions (alias for /debug/sessions)")
    public ResponseEntity<Map<String, Object>> getDataSessions() {
        List<DebugSession> sessions = debugSessionService.getAllSessions();

        Map<String, Object> response = new HashMap<>();
        response.put("sessions", sessions);
        response.put("count", sessions.size());
        response.put("counts", debugSessionService.getSessionCounts());

        return ResponseEntity.ok(response);
    }

    // ==================== Health Endpoint ====================

    @GetMapping("/health")
    @Operation(summary = "Aggregated health status of debug services")
    public ResponseEntity<Map<String, Object>> getHealth() {
        Map<String, Object> health = new HashMap<>();

        health.put("status", "UP");
        health.put("events", Map.of(
                "bufferSize", debugEventService.getEventCount(),
                "maxSize", 1000,
                "subscribers", debugEventService.getSubscriberCount()
        ));
        health.put("sessions", debugSessionService.getSessionCounts());
        health.put("controls", debugControlsService.getControlsState());

        return ResponseEntity.ok(health);
    }

    // ==================== Control Endpoints ====================

    @PostMapping("/controls/reset")
    @Operation(summary = "Reset demo data")
    public ResponseEntity<Map<String, Object>> resetData(@RequestBody ResetRequest request) {
        String target = request.target() != null ? request.target() : "all";

        switch (target.toLowerCase()) {
            case "all" -> debugControlsService.resetAllData();
            case "audit" -> debugControlsService.resetAuditLog();
            case "sessions" -> debugControlsService.resetSessions();
            default -> {
                return ResponseEntity.badRequest().body(Map.of(
                        "error", "Invalid target. Use: all, audit, sessions"
                ));
            }
        }

        return ResponseEntity.ok(Map.of(
                "message", "Reset completed",
                "target", target
        ));
    }

    @PostMapping("/controls/risk")
    @Operation(summary = "Set risk score override")
    public ResponseEntity<Map<String, Object>> setRiskOverride(@RequestBody RiskOverrideRequest request) {
        try {
            debugControlsService.setRiskOverride(request.score());

            return ResponseEntity.ok(Map.of(
                    "message", request.score() != null ? "Risk override set" : "Risk override cleared",
                    "score", request.score() != null ? request.score() : "null"
            ));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/controls/risk")
    @Operation(summary = "Get current risk override")
    public ResponseEntity<Map<String, Object>> getRiskOverride() {
        Integer override = debugControlsService.getRiskOverride();

        Map<String, Object> response = new HashMap<>();
        response.put("active", override != null);
        response.put("score", override);

        return ResponseEntity.ok(response);
    }

    @PostMapping("/controls/time")
    @Operation(summary = "Set time override for simulated time")
    public ResponseEntity<Map<String, Object>> setTimeOverride(@RequestBody TimeOverrideRequest request) {
        if (request.time() == null) {
            debugControlsService.clearTimeOverride();
            return ResponseEntity.ok(Map.of("message", "Time override cleared"));
        }

        try {
            LocalDateTime time = LocalDateTime.parse(request.time());
            debugControlsService.setTimeOverride(time);

            return ResponseEntity.ok(Map.of(
                    "message", "Time override set",
                    "time", time.toString()
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "Invalid time format. Use ISO8601 format."
            ));
        }
    }

    @GetMapping("/controls/time")
    @Operation(summary = "Get current effective time")
    public ResponseEntity<Map<String, Object>> getTimeOverride() {
        DebugControlsState state = debugControlsService.getControlsState();

        Map<String, Object> response = new HashMap<>();
        response.put("active", state.timeOverrideActive());
        response.put("override", state.timeOverride());
        response.put("effective", debugControlsService.getEffectiveTime());

        return ResponseEntity.ok(response);
    }

    @GetMapping("/controls")
    @Operation(summary = "Get all debug controls state")
    public ResponseEntity<DebugControlsState> getControlsState() {
        return ResponseEntity.ok(debugControlsService.getControlsState());
    }

    @DeleteMapping("/controls")
    @Operation(summary = "Clear all debug overrides")
    public ResponseEntity<Map<String, Object>> clearControls() {
        debugControlsService.clearAllOverrides();
        return ResponseEntity.ok(Map.of("message", "All overrides cleared"));
    }

    // ==================== Request DTOs ====================

    public record TokenDecodeRequest(String token) {}
    public record ResetRequest(String target) {}
    public record RiskOverrideRequest(Integer score) {}
    public record TimeOverrideRequest(String time) {}
}
