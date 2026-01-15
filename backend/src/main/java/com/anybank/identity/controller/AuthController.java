package com.anybank.identity.controller;

import com.anybank.identity.dto.TokenExchangeRequest;
import com.anybank.identity.dto.TokenExchangeResponse;
import com.anybank.identity.dto.UserDto;
import com.anybank.identity.service.AuthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "Authentication", description = "Authentication and token management endpoints")
public class AuthController {

    private final AuthService authService;

    @GetMapping("/me")
    @Operation(summary = "Get current user info", description = "Returns the authenticated user's profile and available tenants")
    public ResponseEntity<UserDto> getCurrentUser(@AuthenticationPrincipal Jwt jwt) {
        log.info("Getting current user for subject: {}", jwt.getSubject());
        UserDto user = authService.getCurrentUser(jwt);
        return ResponseEntity.ok(user);
    }

    @PostMapping("/token/exchange")
    @Operation(summary = "Exchange token for tenant context", description = "Exchanges the current token for one scoped to a specific tenant")
    public ResponseEntity<TokenExchangeResponse> exchangeToken(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody TokenExchangeRequest request
    ) {
        log.info("Token exchange requested for tenant: {}", request.getTargetTenantId());
        TokenExchangeResponse response = authService.exchangeToken(jwt, request);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/logout")
    @Operation(summary = "Logout user", description = "Invalidates the current session")
    public ResponseEntity<Void> logout(@AuthenticationPrincipal Jwt jwt) {
        log.info("User logout: {}", jwt.getSubject());
        // Token invalidation would be handled by Keycloak
        // This endpoint is primarily for audit logging
        return ResponseEntity.ok().build();
    }
}
