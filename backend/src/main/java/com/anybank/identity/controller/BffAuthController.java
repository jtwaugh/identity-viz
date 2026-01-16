package com.anybank.identity.controller;

import com.anybank.identity.dto.DebugEvent;
import com.anybank.identity.dto.DebugEvent.EventType;
import com.anybank.identity.service.DebugEventService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.reactive.function.BodyInserters;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.util.UriComponentsBuilder;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Backend-for-Frontend (BFF) Authentication Controller.
 *
 * Handles the OAuth2 authorization code flow on behalf of the frontend,
 * providing full visibility into all authentication packets.
 */
@RestController
@RequestMapping("/bff/auth")
@RequiredArgsConstructor
@Slf4j
public class BffAuthController {

    private final DebugEventService debugEventService;
    private final WebClient.Builder webClientBuilder;

    @Value("${keycloak.url:http://localhost:8080}")
    private String keycloakUrl;

    @Value("${keycloak.internal-url:http://keycloak:8080}")
    private String keycloakInternalUrl;

    @Value("${keycloak.realm:anybank}")
    private String realm;

    @Value("${keycloak.client-id:anybank-web}")
    private String clientId;

    @Value("${keycloak.client-secret:}")
    private String clientSecret;

    @Value("${app.frontend-url:http://localhost:3000}")
    private String frontendUrl;

    @Value("${app.backend-url:http://localhost:8000}")
    private String backendUrl;

    private static final String SESSION_STATE_KEY = "oauth_state";
    private static final String SESSION_VERIFIER_KEY = "oauth_code_verifier";
    private static final String SESSION_TOKENS_KEY = "oauth_tokens";
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    /**
     * Initiates the OAuth2 authorization code flow with PKCE.
     * Redirects the browser to Keycloak's login page.
     */
    @GetMapping("/login")
    public void login(HttpServletRequest request, HttpServletResponse response) throws IOException {
        // Generate state for CSRF protection
        String state = UUID.randomUUID().toString();

        // Generate PKCE code verifier and challenge
        String codeVerifier = generateCodeVerifier();
        String codeChallenge = generateCodeChallenge(codeVerifier);

        HttpSession session = request.getSession(true);
        session.setAttribute(SESSION_STATE_KEY, state);
        session.setAttribute(SESSION_VERIFIER_KEY, codeVerifier);

        // Emit: Login initiated (frontend → backend)
        emitEvent(EventType.AUTH, "login_initiated", Map.of(
                "direction", "inbound",
                "from", "frontend",
                "to", "backend",
                "path", "/bff/auth/login",
                "sessionId", session.getId()
        ));

        // Build Keycloak authorization URL with PKCE
        String redirectUri = backendUrl + "/bff/auth/callback";
        String authUrl = UriComponentsBuilder.fromHttpUrl(keycloakUrl)
                .path("/realms/{realm}/protocol/openid-connect/auth")
                .queryParam("client_id", clientId)
                .queryParam("redirect_uri", redirectUri)
                .queryParam("response_type", "code")
                .queryParam("scope", "openid profile email")
                .queryParam("state", state)
                .queryParam("code_challenge", codeChallenge)
                .queryParam("code_challenge_method", "S256")
                .buildAndExpand(realm)
                .toUriString();

        // Emit: Redirecting to Keycloak (backend → keycloak)
        emitEvent(EventType.AUTH, "keycloak_redirect", Map.of(
                "direction", "outbound",
                "from", "backend",
                "to", "keycloak",
                "authUrl", authUrl,
                "clientId", clientId,
                "redirectUri", redirectUri,
                "state", state,
                "pkce", true
        ));

        log.info("Redirecting to Keycloak for authentication: {}", authUrl);
        response.sendRedirect(authUrl);
    }

    /**
     * Generates a cryptographically random code verifier for PKCE.
     */
    private String generateCodeVerifier() {
        byte[] bytes = new byte[32];
        SECURE_RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    /**
     * Generates the code challenge from the verifier using SHA-256.
     */
    private String generateCodeChallenge(String codeVerifier) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(codeVerifier.getBytes(StandardCharsets.US_ASCII));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(hash);
        } catch (Exception e) {
            throw new RuntimeException("Failed to generate code challenge", e);
        }
    }

    /**
     * Handles the OAuth2 callback from Keycloak.
     * Exchanges the authorization code for tokens.
     */
    @GetMapping("/callback")
    public void callback(
            @RequestParam(required = false) String code,
            @RequestParam(required = false) String state,
            @RequestParam(required = false) String error,
            @RequestParam(name = "error_description", required = false) String errorDescription,
            HttpServletRequest request,
            HttpServletResponse response
    ) throws IOException {
        HttpSession session = request.getSession(false);

        // Emit: Callback received (keycloak → backend)
        emitEvent(EventType.AUTH, "callback_received", Map.of(
                "direction", "inbound",
                "from", "keycloak",
                "to", "backend",
                "path", "/bff/auth/callback",
                "hasCode", code != null,
                "hasError", error != null,
                "state", state != null ? state : "null"
        ));

        // Handle error from Keycloak
        if (error != null) {
            log.error("OAuth error from Keycloak: {} - {}", error, errorDescription);
            emitEvent(EventType.ERROR, "auth_error", Map.of(
                    "error", error,
                    "errorDescription", errorDescription != null ? errorDescription : "",
                    "from", "keycloak"
            ));
            response.sendRedirect(frontendUrl + "/#/login?error=" + URLEncoder.encode(error, StandardCharsets.UTF_8));
            return;
        }

        // Validate state
        if (session == null) {
            log.error("No session found for OAuth callback");
            emitEvent(EventType.ERROR, "auth_error", Map.of(
                    "error", "no_session",
                    "errorDescription", "Session not found"
            ));
            response.sendRedirect(frontendUrl + "/#/login?error=session_expired");
            return;
        }

        String savedState = (String) session.getAttribute(SESSION_STATE_KEY);
        if (savedState == null || !savedState.equals(state)) {
            log.error("State mismatch: expected={}, got={}", savedState, state);
            emitEvent(EventType.ERROR, "auth_error", Map.of(
                    "error", "state_mismatch",
                    "expectedState", savedState != null ? savedState : "null",
                    "receivedState", state != null ? state : "null"
            ));
            response.sendRedirect(frontendUrl + "/#/login?error=state_mismatch");
            return;
        }

        // Get code verifier from session for PKCE
        String codeVerifier = (String) session.getAttribute(SESSION_VERIFIER_KEY);
        session.removeAttribute(SESSION_VERIFIER_KEY);

        // Exchange code for tokens
        Map<String, Object> tokens = exchangeCodeForTokens(code, codeVerifier);

        if (tokens == null || !tokens.containsKey("access_token")) {
            log.error("Failed to exchange code for tokens");
            response.sendRedirect(frontendUrl + "/#/login?error=token_exchange_failed");
            return;
        }

        // Store tokens in session (secure - not exposed to frontend)
        session.setAttribute(SESSION_TOKENS_KEY, tokens);
        session.removeAttribute(SESSION_STATE_KEY);

        Integer expiresIn = (Integer) tokens.get("expires_in");

        // Emit: Session created
        emitEvent(EventType.AUTH, "session_created", Map.of(
                "sessionId", session.getId(),
                "tokenType", tokens.get("token_type"),
                "expiresIn", expiresIn,
                "scope", tokens.get("scope") != null ? tokens.get("scope") : "openid"
        ));

        // Redirect to frontend callback - tokens stay server-side (BFF pattern)
        // Frontend will call /bff/auth/me to get user info
        String redirectUrl = frontendUrl + "/#/callback?auth=success";

        // Emit: Redirecting to frontend (backend → frontend)
        emitEvent(EventType.AUTH, "frontend_redirect", Map.of(
                "direction", "outbound",
                "from", "backend",
                "to", "frontend",
                "redirectUrl", redirectUrl,
                "tokensStoredServerSide", true,
                "expiresIn", expiresIn
        ));

        log.info("Authentication successful, redirecting to frontend");
        response.sendRedirect(redirectUrl);
    }

    /**
     * Returns the current authenticated user's info.
     * Tokens stay server-side - only user claims are returned.
     */
    @GetMapping("/me")
    public ResponseEntity<Map<String, Object>> getCurrentUser(HttpServletRequest request) {
        HttpSession session = request.getSession(false);

        emitEvent(EventType.AUTH, "user_info_request", Map.of(
                "direction", "inbound",
                "from", "frontend",
                "to", "backend",
                "path", "/bff/auth/me",
                "hasSession", session != null
        ));

        if (session == null) {
            return ResponseEntity.status(401).body(Map.of(
                    "authenticated", false,
                    "error", "No active session"
            ));
        }

        @SuppressWarnings("unchecked")
        Map<String, Object> tokens = (Map<String, Object>) session.getAttribute(SESSION_TOKENS_KEY);

        if (tokens == null || !tokens.containsKey("access_token")) {
            return ResponseEntity.status(401).body(Map.of(
                    "authenticated", false,
                    "error", "No tokens in session"
            ));
        }

        // Decode the access token to get user claims (without exposing the token)
        String accessToken = (String) tokens.get("access_token");
        Map<String, Object> claims = decodeJwtPayload(accessToken);

        if (claims == null) {
            return ResponseEntity.status(500).body(Map.of(
                    "authenticated", false,
                    "error", "Failed to decode token"
            ));
        }

        // Build user info response
        Map<String, Object> userInfo = new HashMap<>();
        userInfo.put("authenticated", true);
        userInfo.put("sub", claims.get("sub"));
        userInfo.put("email", claims.get("email"));
        userInfo.put("name", claims.get("name"));
        userInfo.put("preferred_username", claims.get("preferred_username"));
        userInfo.put("given_name", claims.get("given_name"));
        userInfo.put("family_name", claims.get("family_name"));
        userInfo.put("expiresAt", tokens.get("expires_in") != null
                ? System.currentTimeMillis() + ((Integer) tokens.get("expires_in") * 1000L)
                : null);

        emitEvent(EventType.AUTH, "user_info_response", Map.of(
                "direction", "outbound",
                "from", "backend",
                "to", "frontend",
                "authenticated", true,
                "userEmail", claims.get("email") != null ? claims.get("email") : "unknown"
        ));

        return ResponseEntity.ok(userInfo);
    }

    /**
     * Exchange session token for a tenant-scoped access token.
     * BFF pattern: tokens stay server-side, we just update the session context.
     */
    @PostMapping("/token/exchange")
    public ResponseEntity<Map<String, Object>> exchangeToken(
            @RequestBody Map<String, String> request,
            HttpServletRequest httpRequest
    ) {
        HttpSession session = httpRequest.getSession(false);
        String targetTenantId = request.get("target_tenant_id");

        emitEvent(EventType.TOKEN, "bff_token_exchange_request", Map.of(
                "direction", "inbound",
                "from", "frontend",
                "to", "backend",
                "path", "/bff/auth/token/exchange",
                "targetTenantId", targetTenantId != null ? targetTenantId : "null",
                "hasSession", session != null
        ));

        if (session == null) {
            return ResponseEntity.status(401).body(Map.of(
                    "error", "No active session"
            ));
        }

        @SuppressWarnings("unchecked")
        Map<String, Object> tokens = (Map<String, Object>) session.getAttribute(SESSION_TOKENS_KEY);

        if (tokens == null || !tokens.containsKey("access_token")) {
            return ResponseEntity.status(401).body(Map.of(
                    "error", "No tokens in session"
            ));
        }

        // For demo purposes, we simulate a successful token exchange
        // In production, this would call Keycloak's token exchange endpoint
        // to get a tenant-scoped token
        String accessToken = (String) tokens.get("access_token");
        Integer expiresIn = (Integer) tokens.get("expires_in");

        // Store selected tenant in session
        session.setAttribute("selected_tenant_id", targetTenantId);

        emitEvent(EventType.TOKEN, "bff_token_exchange_response", Map.of(
                "direction", "outbound",
                "from", "backend",
                "to", "frontend",
                "success", true,
                "targetTenantId", targetTenantId != null ? targetTenantId : "null"
        ));

        // Return a mock response - in BFF pattern, the actual token stays server-side
        // Frontend just needs to know the exchange succeeded
        return ResponseEntity.ok(Map.of(
                "success", true,
                "tenant_id", targetTenantId != null ? targetTenantId : "",
                "expires_in", expiresIn != null ? expiresIn : 3600
        ));
    }

    /**
     * Decodes a JWT token payload without verification (for extracting claims).
     */
    private Map<String, Object> decodeJwtPayload(String token) {
        try {
            String[] parts = token.split("\\.");
            if (parts.length < 2) {
                return null;
            }
            String payload = parts[1];
            // Handle base64url encoding
            payload = payload.replace('-', '+').replace('_', '/');
            // Add padding if needed
            int padding = 4 - (payload.length() % 4);
            if (padding != 4) {
                payload += "=".repeat(padding);
            }
            byte[] decoded = Base64.getDecoder().decode(payload);
            String json = new String(decoded, StandardCharsets.UTF_8);

            // Simple JSON parsing (for demo purposes)
            @SuppressWarnings("unchecked")
            Map<String, Object> claims = new com.fasterxml.jackson.databind.ObjectMapper()
                    .readValue(json, Map.class);
            return claims;
        } catch (Exception e) {
            log.error("Failed to decode JWT: {}", e.getMessage());
            return null;
        }
    }

    /**
     * Returns current session info (for debugging).
     */
    @GetMapping("/session")
    public ResponseEntity<Map<String, Object>> getSession(HttpServletRequest request) {
        HttpSession session = request.getSession(false);

        if (session == null) {
            return ResponseEntity.ok(Map.of(
                    "authenticated", false,
                    "message", "No active session"
            ));
        }

        @SuppressWarnings("unchecked")
        Map<String, Object> tokens = (Map<String, Object>) session.getAttribute(SESSION_TOKENS_KEY);

        return ResponseEntity.ok(Map.of(
                "authenticated", tokens != null,
                "sessionId", session.getId(),
                "createdAt", session.getCreationTime(),
                "hasTokens", tokens != null
        ));
    }

    /**
     * Handles logout - revokes tokens and clears session.
     * Accepts GET since browser redirects here via window.location.
     */
    @GetMapping("/logout")
    public void logout(HttpServletRequest request, HttpServletResponse response) throws IOException {
        HttpSession session = request.getSession(false);

        emitEvent(EventType.AUTH, "logout_initiated", Map.of(
                "direction", "inbound",
                "from", "frontend",
                "to", "backend",
                "hasSession", session != null
        ));

        String idToken = null;

        if (session != null) {
            String sessionId = session.getId();

            @SuppressWarnings("unchecked")
            Map<String, Object> tokens = (Map<String, Object>) session.getAttribute(SESSION_TOKENS_KEY);

            if (tokens != null) {
                // Get id_token for logout hint
                idToken = (String) tokens.get("id_token");

                // Revoke refresh token with Keycloak
                if (tokens.containsKey("refresh_token")) {
                    revokeToken((String) tokens.get("refresh_token"));
                }
            }

            // Clear session attributes (don't invalidate - filters still need session)
            session.removeAttribute(SESSION_TOKENS_KEY);
            session.removeAttribute(SESSION_STATE_KEY);
            session.removeAttribute(SESSION_VERIFIER_KEY);

            emitEvent(EventType.AUTH, "session_cleared", Map.of(
                    "sessionId", sessionId
            ));
        }

        // If no id_token, we can't do Keycloak logout - just redirect to frontend
        if (idToken == null) {
            emitEvent(EventType.AUTH, "logout_no_session", Map.of(
                    "direction", "outbound",
                    "from", "backend",
                    "to", "frontend",
                    "reason", "No active session to logout"
            ));
            response.sendRedirect(frontendUrl + "/#/login");
            return;
        }

        // Build Keycloak logout URL with id_token_hint (required by Keycloak)
        // Use encoded redirect URI to properly handle the hash fragment
        String postLogoutRedirect = frontendUrl + "/#/login";
        String logoutUrl = UriComponentsBuilder.fromHttpUrl(keycloakUrl)
                .path("/realms/{realm}/protocol/openid-connect/logout")
                .queryParam("id_token_hint", idToken)
                .queryParam("post_logout_redirect_uri", postLogoutRedirect)
                .queryParam("client_id", clientId)
                .buildAndExpand(realm)
                .encode()  // Properly encode the URL including the redirect URI
                .toUriString();

        emitEvent(EventType.AUTH, "keycloak_logout_redirect", Map.of(
                "direction", "outbound",
                "from", "backend",
                "to", "keycloak",
                "logoutUrl", logoutUrl
        ));

        response.sendRedirect(logoutUrl);
    }

    /**
     * Exchanges authorization code for tokens with Keycloak.
     */
    private Map<String, Object> exchangeCodeForTokens(String code, String codeVerifier) {
        String tokenEndpoint = keycloakInternalUrl + "/realms/" + realm + "/protocol/openid-connect/token";
        String redirectUri = backendUrl + "/bff/auth/callback";
        long startTime = System.currentTimeMillis();

        // Emit: Token exchange request (backend → keycloak)
        emitEvent(EventType.TOKEN, "token_exchange_request", Map.of(
                "direction", "outbound",
                "from", "backend",
                "to", "keycloak",
                "endpoint", tokenEndpoint,
                "grantType", "authorization_code",
                "clientId", clientId
        ));

        try {
            MultiValueMap<String, String> formData = new LinkedMultiValueMap<>();
            formData.add("grant_type", "authorization_code");
            formData.add("client_id", clientId);
            if (clientSecret != null && !clientSecret.isEmpty()) {
                formData.add("client_secret", clientSecret);
            }
            formData.add("code", code);
            formData.add("redirect_uri", redirectUri);
            if (codeVerifier != null) {
                formData.add("code_verifier", codeVerifier);
            }

            @SuppressWarnings("unchecked")
            Map<String, Object> tokens = webClientBuilder.build()
                    .post()
                    .uri(tokenEndpoint)
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .body(BodyInserters.fromFormData(formData))
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();

            long duration = System.currentTimeMillis() - startTime;

            // Emit: Token exchange response (keycloak → backend)
            emitEvent(EventType.TOKEN, "token_exchange_response", Map.of(
                    "direction", "inbound",
                    "from", "keycloak",
                    "to", "backend",
                    "success", tokens != null && tokens.containsKey("access_token"),
                    "duration", duration,
                    "tokenType", tokens != null ? tokens.get("token_type") : "null",
                    "expiresIn", tokens != null ? tokens.get("expires_in") : 0,
                    "scope", tokens != null && tokens.get("scope") != null ? tokens.get("scope") : "openid"
            ));

            log.info("Token exchange successful, duration={}ms", duration);
            return tokens;

        } catch (Exception e) {
            long duration = System.currentTimeMillis() - startTime;
            log.error("Token exchange failed: {}", e.getMessage());

            emitEvent(EventType.ERROR, "token_exchange_error", Map.of(
                    "direction", "inbound",
                    "from", "keycloak",
                    "to", "backend",
                    "error", e.getMessage(),
                    "duration", duration
            ));

            return null;
        }
    }

    /**
     * Revokes a token with Keycloak.
     */
    private void revokeToken(String token) {
        String revokeEndpoint = keycloakInternalUrl + "/realms/" + realm + "/protocol/openid-connect/revoke";

        emitEvent(EventType.TOKEN, "token_revoke_request", Map.of(
                "direction", "outbound",
                "from", "backend",
                "to", "keycloak",
                "endpoint", revokeEndpoint
        ));

        try {
            MultiValueMap<String, String> formData = new LinkedMultiValueMap<>();
            formData.add("client_id", clientId);
            if (clientSecret != null && !clientSecret.isEmpty()) {
                formData.add("client_secret", clientSecret);
            }
            formData.add("token", token);

            webClientBuilder.build()
                    .post()
                    .uri(revokeEndpoint)
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .body(BodyInserters.fromFormData(formData))
                    .retrieve()
                    .toBodilessEntity()
                    .block();

            emitEvent(EventType.TOKEN, "token_revoke_response", Map.of(
                    "direction", "inbound",
                    "from", "keycloak",
                    "to", "backend",
                    "success", true
            ));

        } catch (Exception e) {
            log.warn("Token revocation failed: {}", e.getMessage());
            emitEvent(EventType.ERROR, "token_revoke_error", Map.of(
                    "error", e.getMessage()
            ));
        }
    }

    /**
     * Helper to emit debug events.
     */
    private void emitEvent(EventType type, String action, Map<String, Object> details) {
        try {
            debugEventService.emit(DebugEvent.builder()
                    .id(UUID.randomUUID())
                    .timestamp(Instant.now())
                    .type(type)
                    .action(action)
                    .details(new HashMap<>(details))
                    .build());
        } catch (Exception e) {
            log.warn("Failed to emit debug event: {}", e.getMessage());
        }
    }
}
