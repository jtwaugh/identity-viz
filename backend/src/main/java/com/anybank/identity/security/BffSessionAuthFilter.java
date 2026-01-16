package com.anybank.identity.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.Map;

/**
 * Filter that authenticates API requests using BFF session tokens.
 *
 * In the BFF pattern, tokens are stored server-side in the session.
 * This filter checks if there's a valid session with tokens and uses
 * them to authenticate API requests (when no Bearer token is provided).
 */
@Component
@Slf4j
public class BffSessionAuthFilter extends OncePerRequestFilter {

    private static final String SESSION_TOKENS_KEY = "oauth_tokens";
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {

        // Skip if already authenticated (Bearer token was provided)
        if (SecurityContextHolder.getContext().getAuthentication() != null &&
            SecurityContextHolder.getContext().getAuthentication().isAuthenticated() &&
            !"anonymousUser".equals(SecurityContextHolder.getContext().getAuthentication().getPrincipal())) {
            filterChain.doFilter(request, response);
            return;
        }

        // Skip if Authorization header is present (let JWT filter handle it)
        String authHeader = request.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        // Check for BFF session with tokens
        HttpSession session = request.getSession(false);
        if (session != null) {
            @SuppressWarnings("unchecked")
            Map<String, Object> tokens = (Map<String, Object>) session.getAttribute(SESSION_TOKENS_KEY);

            if (tokens != null && tokens.containsKey("access_token")) {
                String accessToken = (String) tokens.get("access_token");

                try {
                    // Decode the JWT payload (without cryptographic verification - already done at login)
                    Jwt jwt = decodeJwt(accessToken);

                    if (jwt != null) {
                        // Check if token is expired
                        Instant exp = jwt.getExpiresAt();
                        if (exp != null && exp.isBefore(Instant.now())) {
                            log.debug("BFF session token expired");
                            session.removeAttribute(SESSION_TOKENS_KEY);
                        } else {
                            // Create authentication from the JWT
                            JwtAuthenticationToken authentication = new JwtAuthenticationToken(
                                    jwt,
                                    List.of(new SimpleGrantedAuthority("ROLE_USER"))
                            );

                            SecurityContextHolder.getContext().setAuthentication(authentication);
                            log.debug("BFF session auth successful for: {}", jwt.getClaimAsString("email"));
                        }
                    }

                } catch (Exception e) {
                    log.debug("BFF session token processing failed: {}", e.getMessage());
                }
            }
        }

        filterChain.doFilter(request, response);
    }

    /**
     * Decode a JWT token without cryptographic verification.
     * Since we stored this token ourselves after validating it at login time,
     * we trust it and just need to extract the claims.
     */
    private Jwt decodeJwt(String token) {
        try {
            String[] parts = token.split("\\.");
            if (parts.length < 2) {
                return null;
            }

            // Decode header
            String headerJson = new String(Base64.getUrlDecoder().decode(parts[0]), StandardCharsets.UTF_8);
            @SuppressWarnings("unchecked")
            Map<String, Object> headers = objectMapper.readValue(headerJson, Map.class);

            // Decode payload
            String payloadJson = new String(Base64.getUrlDecoder().decode(parts[1]), StandardCharsets.UTF_8);
            @SuppressWarnings("unchecked")
            Map<String, Object> claims = objectMapper.readValue(payloadJson, Map.class);

            // Extract timing claims
            Instant issuedAt = claims.containsKey("iat") ? Instant.ofEpochSecond(((Number) claims.get("iat")).longValue()) : null;
            Instant expiresAt = claims.containsKey("exp") ? Instant.ofEpochSecond(((Number) claims.get("exp")).longValue()) : null;

            return Jwt.withTokenValue(token)
                    .headers(h -> h.putAll(headers))
                    .claims(c -> c.putAll(claims))
                    .issuedAt(issuedAt)
                    .expiresAt(expiresAt)
                    .build();

        } catch (Exception e) {
            log.debug("Failed to decode JWT: {}", e.getMessage());
            return null;
        }
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        // Don't filter BFF auth endpoints or public endpoints
        return path.startsWith("/bff/auth/") ||
               path.startsWith("/actuator/") ||
               path.startsWith("/swagger") ||
               path.startsWith("/v3/api-docs") ||
               path.startsWith("/debug/");
    }
}
