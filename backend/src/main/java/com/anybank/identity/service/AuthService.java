package com.anybank.identity.service;

import com.anybank.identity.dto.DebugEvent;
import com.anybank.identity.dto.TenantDto;
import com.anybank.identity.dto.TokenExchangeRequest;
import com.anybank.identity.dto.TokenExchangeResponse;
import com.anybank.identity.dto.UserDto;
import com.anybank.identity.entity.User;
import com.anybank.identity.exception.TenantAccessDeniedException;
import com.anybank.identity.exception.TokenExchangeException;
import com.anybank.identity.mapper.UserMapper;
import com.anybank.identity.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.reactive.function.BodyInserters;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthService {

    private final UserRepository userRepository;
    private final TenantService tenantService;
    private final UserMapper userMapper;
    private final WebClient.Builder webClientBuilder;
    private final DebugSessionService debugSessionService;
    private final DebugEventService debugEventService;

    @Value("${keycloak.url:http://localhost:8080}")
    private String keycloakUrl;

    @Value("${keycloak.realm:anybank}")
    private String keycloakRealm;

    @Value("${keycloak.client-id:anybank-api}")
    private String clientId;

    @Value("${keycloak.client-secret:}")
    private String clientSecret;

    @Transactional
    public User getOrCreateUser(Jwt jwt) {
        String externalId = jwt.getSubject();
        String email = jwt.getClaimAsString("email");
        String name = jwt.getClaimAsString("name");

        // First try to find by external ID (Keycloak subject)
        return userRepository.findByExternalId(externalId)
                .orElseGet(() -> {
                    // Fallback: try to find by email and update external ID
                    // This handles demo users with placeholder external IDs
                    if (email != null) {
                        return userRepository.findByEmail(email)
                                .map(existingUser -> {
                                    log.info("Updating external ID for existing user: {}", email);
                                    existingUser.setExternalId(externalId);
                                    existingUser.setUpdatedAt(Instant.now());
                                    return userRepository.save(existingUser);
                                })
                                .orElseGet(() -> createNewUser(externalId, email, name));
                    }
                    return createNewUser(externalId, email, name);
                });
    }

    private User createNewUser(String externalId, String email, String name) {
        User newUser = User.builder()
                .externalId(externalId)
                .email(email != null ? email : externalId + "@unknown.com")
                .displayName(name != null ? name : "Unknown User")
                .mfaEnabled(false)
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();
        log.info("Creating new user from JWT: {}", email);
        return userRepository.save(newUser);
    }

    @Transactional(readOnly = true)
    public UserDto getCurrentUser(Jwt jwt) {
        User user = getOrCreateUser(jwt);
        List<TenantDto> tenants = tenantService.getTenantsForUser(user.getId());

        // Track the session in the debug UI
        String sessionId = jwt.getClaimAsString("sid");
        if (sessionId == null) {
            sessionId = jwt.getId(); // Fall back to JWT ID (jti)
        }
        if (sessionId == null) {
            sessionId = jwt.getSubject(); // Fall back to subject
        }
        debugSessionService.startSession(sessionId, user.getId(), user.getEmail());

        // Emit login success event
        debugEventService.emit(DebugEvent.builder()
                .type(DebugEvent.EventType.AUTH)
                .action("login_success")
                .sessionId(sessionId)
                .actor(DebugEvent.Actor.builder()
                        .userId(user.getId())
                        .email(user.getEmail())
                        .build())
                .details(Map.of(
                        "event", "User logged in successfully",
                        "userId", user.getId().toString(),
                        "email", user.getEmail(),
                        "tenantCount", tenants.size()
                ))
                .build());

        UserDto userDto = userMapper.toDto(user);
        userDto.setTenants(tenants);
        return userDto;
    }

    @Transactional(readOnly = true)
    public TokenExchangeResponse exchangeToken(Jwt currentToken, TokenExchangeRequest request) {
        User user = getOrCreateUser(currentToken);
        UUID targetTenantId = request.getTargetTenantId();

        // Verify user has access to target tenant
        if (!tenantService.hasAccess(user.getId(), targetTenantId)) {
            throw new TenantAccessDeniedException("User does not have access to tenant: " + targetTenantId);
        }

        TenantDto tenant = tenantService.getTenantForUser(user.getId(), targetTenantId);

        // Emit context switch event
        String sessionId = currentToken.getClaimAsString("sid");
        if (sessionId == null) {
            sessionId = currentToken.getId();
        }
        if (sessionId == null) {
            sessionId = currentToken.getSubject();
        }
        debugEventService.emit(DebugEvent.builder()
                .type(DebugEvent.EventType.CONTEXT_SWITCH)
                .action("tenant_switch")
                .sessionId(sessionId)
                .actor(DebugEvent.Actor.builder()
                        .userId(user.getId())
                        .email(user.getEmail())
                        .tenantId(targetTenantId)
                        .tenantName(tenant.getName())
                        .role(tenant.getRole() != null ? tenant.getRole().name() : null)
                        .build())
                .details(Map.of(
                        "tenant", Map.of(
                                "id", targetTenantId.toString(),
                                "name", tenant.getName(),
                                "type", tenant.getType()
                        ),
                        "tenantId", targetTenantId.toString(),
                        "tenantName", tenant.getName(),
                        "role", tenant.getRole()
                ))
                .build());

        // Perform token exchange with Keycloak
        String newAccessToken = performKeycloakTokenExchange(currentToken.getTokenValue(), targetTenantId, tenant);

        return TokenExchangeResponse.builder()
                .accessToken(newAccessToken)
                .tokenType("Bearer")
                .expiresIn(3600)
                .tenant(tenant)
                .build();
    }

    private String performKeycloakTokenExchange(String subjectToken, UUID tenantId, TenantDto tenant) {
        String tokenEndpoint = String.format("%s/realms/%s/protocol/openid-connect/token", keycloakUrl, keycloakRealm);
        long startTime = System.currentTimeMillis();

        // Emit outbound request event (action lineage: backend → keycloak)
        emitKeycloakRequestEvent(tokenEndpoint, tenantId);

        try {
            MultiValueMap<String, String> formData = new LinkedMultiValueMap<>();
            formData.add("grant_type", "urn:ietf:params:oauth:grant-type:token-exchange");
            formData.add("client_id", clientId);
            if (clientSecret != null && !clientSecret.isEmpty()) {
                formData.add("client_secret", clientSecret);
            }
            formData.add("subject_token", subjectToken);
            formData.add("subject_token_type", "urn:ietf:params:oauth:token-type:access_token");
            formData.add("requested_token_type", "urn:ietf:params:oauth:token-type:access_token");
            formData.add("audience", clientId);

            Map<String, Object> response = webClientBuilder.build()
                    .post()
                    .uri(tokenEndpoint)
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .body(BodyInserters.fromFormData(formData))
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();

            long duration = System.currentTimeMillis() - startTime;

            if (response != null && response.containsKey("access_token")) {
                // Emit success response event
                emitKeycloakResponseEvent(tokenEndpoint, true, duration, null);
                return (String) response.get("access_token");
            }

            // If Keycloak exchange fails, return the original token for demo purposes
            log.warn("Keycloak token exchange did not return access_token, using original token");
            emitKeycloakResponseEvent(tokenEndpoint, false, duration, "No access_token in response");
            return subjectToken;
        } catch (Exception e) {
            long duration = System.currentTimeMillis() - startTime;
            log.warn("Token exchange with Keycloak failed: {}. Using original token for demo.", e.getMessage());
            emitKeycloakResponseEvent(tokenEndpoint, false, duration, e.getMessage());
            // For demo purposes, return original token if exchange fails
            return subjectToken;
        }
    }

    /**
     * Emits event for outbound Keycloak API call (action lineage).
     */
    private void emitKeycloakRequestEvent(String endpoint, UUID tenantId) {
        try {
            debugEventService.emit(DebugEvent.builder()
                    .id(UUID.randomUUID())
                    .timestamp(Instant.now())
                    .type(DebugEvent.EventType.TOKEN)
                    .action("keycloak_request")
                    .details(Map.of(
                            "direction", "outbound",
                            "from", "backend",
                            "to", "keycloak",
                            "method", "POST",
                            "endpoint", endpoint,
                            "operation", "token_exchange",
                            "targetTenantId", tenantId.toString()
                    ))
                    .build());
        } catch (Exception e) {
            log.warn("Failed to emit keycloak_request event: {}", e.getMessage());
        }
    }

    /**
     * Emits event for Keycloak API response (action lineage).
     */
    private void emitKeycloakResponseEvent(String endpoint, boolean success, long duration, String error) {
        try {
            Map<String, Object> details = new java.util.HashMap<>();
            details.put("direction", "inbound");
            details.put("from", "keycloak");
            details.put("to", "backend");
            details.put("endpoint", endpoint);
            details.put("operation", "token_exchange");
            details.put("success", success);
            details.put("duration", duration);
            if (error != null) {
                details.put("error", error);
            }

            debugEventService.emit(DebugEvent.builder()
                    .id(UUID.randomUUID())
                    .timestamp(Instant.now())
                    .type(DebugEvent.EventType.TOKEN)
                    .action("keycloak_response")
                    .details(details)
                    .build());
        } catch (Exception e) {
            log.warn("Failed to emit keycloak_response event: {}", e.getMessage());
        }
    }
}
