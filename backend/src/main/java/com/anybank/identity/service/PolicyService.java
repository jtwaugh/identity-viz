package com.anybank.identity.service;

import com.anybank.identity.dto.DebugEvent;
import com.anybank.identity.dto.DebugEvent.EventType;
import com.anybank.identity.dto.TenantDto.MembershipRole;
import com.anybank.identity.dto.TenantDto.TenantType;
import com.anybank.identity.exception.PolicyDeniedException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class PolicyService {

    private final WebClient.Builder webClientBuilder;
    private final DebugEventService debugEventService;

    @Value("${opa.url:http://localhost:8181/v1/data/bank/authz}")
    private String opaUrl;

    public record PolicyInput(
            UserContext user,
            TenantContext tenant,
            String action,
            ResourceContext resource,
            RequestContext context
    ) {}

    public record UserContext(UUID id, String email, MembershipRole role) {}
    public record TenantContext(UUID id, TenantType type) {}
    public record ResourceContext(String type, UUID id) {}
    public record RequestContext(
            String channel,
            String ipAddress,
            String userAgent,
            int riskScore,
            boolean isNewDevice
    ) {}

    public boolean checkPolicy(PolicyInput input) {
        long startTime = System.currentTimeMillis();

        // Emit pre-OPA call event
        emitOpaRequestEvent(input);

        try {
            Map<String, Object> request = new HashMap<>();
            request.put("input", input);

            Map<String, Object> response = webClientBuilder.build()
                    .post()
                    .uri(opaUrl)
                    .bodyValue(request)
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();

            long duration = System.currentTimeMillis() - startTime;

            if (response == null) {
                log.warn("OPA returned null response, denying by default");
                emitOpaResponseEvent(input, false, null, duration, "null_response");
                return false;
            }

            Object result = response.get("result");
            boolean allowed;
            if (result instanceof Map) {
                Map<String, Object> resultMap = (Map<String, Object>) result;
                Object allow = resultMap.get("allow");
                allowed = Boolean.TRUE.equals(allow);
            } else {
                allowed = Boolean.TRUE.equals(result);
            }

            emitOpaResponseEvent(input, allowed, response, duration, null);
            return allowed;
        } catch (Exception e) {
            long duration = System.currentTimeMillis() - startTime;
            log.error("Error calling OPA: {}", e.getMessage());
            emitOpaResponseEvent(input, false, null, duration, e.getMessage());
            return false;
        }
    }

    public void enforcePolicy(PolicyInput input) {
        if (!checkPolicy(input)) {
            String reason = determineReason(input);
            throw new PolicyDeniedException(input.action(), reason, input.context().riskScore());
        }
    }

    private String determineReason(PolicyInput input) {
        if (input.context().riskScore() >= 50) {
            return "High risk score detected";
        }
        if (input.user().role() == MembershipRole.VIEWER) {
            return "Insufficient permissions";
        }
        return "Action not permitted by policy";
    }

    public PolicyInputBuilder buildInput() {
        return new PolicyInputBuilder();
    }

    public static class PolicyInputBuilder {
        private UserContext user;
        private TenantContext tenant;
        private String action;
        private ResourceContext resource;
        private RequestContext context;

        public PolicyInputBuilder user(UUID id, String email, MembershipRole role) {
            this.user = new UserContext(id, email, role);
            return this;
        }

        public PolicyInputBuilder tenant(UUID id, TenantType type) {
            this.tenant = new TenantContext(id, type);
            return this;
        }

        public PolicyInputBuilder action(String action) {
            this.action = action;
            return this;
        }

        public PolicyInputBuilder resource(String type, UUID id) {
            this.resource = new ResourceContext(type, id);
            return this;
        }

        public PolicyInputBuilder context(String channel, String ipAddress, String userAgent, int riskScore, boolean isNewDevice) {
            this.context = new RequestContext(channel, ipAddress, userAgent, riskScore, isNewDevice);
            return this;
        }

        public PolicyInput build() {
            return new PolicyInput(user, tenant, action, resource, context);
        }
    }

    /**
     * Emits a debug event before calling OPA.
     */
    private void emitOpaRequestEvent(PolicyInput input) {
        try {
            Map<String, Object> details = new HashMap<>();
            details.put("direction", "outbound");
            details.put("from", "backend");
            details.put("to", "opa");
            details.put("action", input.action());
            details.put("opaUrl", opaUrl);

            Map<String, Object> inputMap = new HashMap<>();
            if (input.user() != null) {
                inputMap.put("user", Map.of(
                        "id", input.user().id() != null ? input.user().id().toString() : "null",
                        "email", input.user().email() != null ? input.user().email() : "null",
                        "role", input.user().role() != null ? input.user().role().name() : "null"
                ));
            }
            if (input.tenant() != null) {
                inputMap.put("tenant", Map.of(
                        "id", input.tenant().id() != null ? input.tenant().id().toString() : "null",
                        "type", input.tenant().type() != null ? input.tenant().type().name() : "null"
                ));
            }
            if (input.resource() != null) {
                inputMap.put("resource", Map.of(
                        "type", input.resource().type(),
                        "id", input.resource().id() != null ? input.resource().id().toString() : "null"
                ));
            }
            if (input.context() != null) {
                inputMap.put("context", Map.of(
                        "channel", input.context().channel(),
                        "riskScore", input.context().riskScore(),
                        "isNewDevice", input.context().isNewDevice()
                ));
            }
            details.put("input", inputMap);

            DebugEvent event = DebugEvent.builder()
                    .id(UUID.randomUUID())
                    .timestamp(Instant.now())
                    .type(EventType.OPA)
                    .action("opa_request")
                    .actor(buildActor(input))
                    .details(details)
                    .build();

            debugEventService.emit(event);
        } catch (Exception e) {
            log.warn("Failed to emit OPA request debug event: {}", e.getMessage());
        }
    }

    /**
     * Emits a debug event after receiving OPA response.
     */
    private void emitOpaResponseEvent(PolicyInput input, boolean allowed, Map<String, Object> response, long duration, String error) {
        try {
            Map<String, Object> details = new HashMap<>();
            details.put("direction", "inbound");
            details.put("from", "opa");
            details.put("to", "backend");
            details.put("action", input.action());
            details.put("allowed", allowed);
            details.put("duration", duration);

            if (response != null) {
                details.put("response", response);
            }
            if (error != null) {
                details.put("error", error);
            }
            if (input.context() != null) {
                details.put("riskScore", input.context().riskScore());
            }

            DebugEvent event = DebugEvent.builder()
                    .id(UUID.randomUUID())
                    .timestamp(Instant.now())
                    .type(EventType.OPA)
                    .action("opa_response")
                    .actor(buildActor(input))
                    .details(details)
                    .build();

            debugEventService.emit(event);
        } catch (Exception e) {
            log.warn("Failed to emit OPA response debug event: {}", e.getMessage());
        }
    }

    /**
     * Builds actor info from policy input.
     */
    private DebugEvent.Actor buildActor(PolicyInput input) {
        DebugEvent.Actor.ActorBuilder builder = DebugEvent.Actor.builder();

        if (input.user() != null) {
            builder.userId(input.user().id());
            builder.email(input.user().email());
            if (input.user().role() != null) {
                builder.role(input.user().role().name());
            }
        }
        if (input.tenant() != null) {
            builder.tenantId(input.tenant().id());
        }

        return builder.build();
    }
}
