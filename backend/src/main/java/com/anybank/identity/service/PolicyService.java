package com.anybank.identity.service;

import com.anybank.identity.dto.TenantDto.MembershipRole;
import com.anybank.identity.dto.TenantDto.TenantType;
import com.anybank.identity.exception.PolicyDeniedException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class PolicyService {

    private final WebClient.Builder webClientBuilder;

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

            if (response == null) {
                log.warn("OPA returned null response, denying by default");
                return false;
            }

            Object result = response.get("result");
            if (result instanceof Map) {
                Map<String, Object> resultMap = (Map<String, Object>) result;
                Object allow = resultMap.get("allow");
                return Boolean.TRUE.equals(allow);
            }

            return Boolean.TRUE.equals(result);
        } catch (Exception e) {
            log.error("Error calling OPA: {}", e.getMessage());
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
}
