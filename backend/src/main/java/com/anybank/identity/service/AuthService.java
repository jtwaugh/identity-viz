package com.anybank.identity.service;

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

        return userRepository.findByExternalId(externalId)
                .orElseGet(() -> {
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
                });
    }

    @Transactional(readOnly = true)
    public UserDto getCurrentUser(Jwt jwt) {
        User user = getOrCreateUser(jwt);
        List<TenantDto> tenants = tenantService.getTenantsForUser(user.getId());

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

            if (response != null && response.containsKey("access_token")) {
                return (String) response.get("access_token");
            }

            // If Keycloak exchange fails, return the original token for demo purposes
            log.warn("Keycloak token exchange did not return access_token, using original token");
            return subjectToken;
        } catch (Exception e) {
            log.warn("Token exchange with Keycloak failed: {}. Using original token for demo.", e.getMessage());
            // For demo purposes, return original token if exchange fails
            return subjectToken;
        }
    }
}
