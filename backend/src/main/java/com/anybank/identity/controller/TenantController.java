package com.anybank.identity.controller;

import com.anybank.identity.dto.TenantDto;
import com.anybank.identity.dto.TokenExchangeRequest;
import com.anybank.identity.dto.TokenExchangeResponse;
import com.anybank.identity.entity.User;
import com.anybank.identity.service.AuthService;
import com.anybank.identity.service.TenantService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/tenants")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "Tenants", description = "Tenant/organization management endpoints")
public class TenantController {

    private final TenantService tenantService;
    private final AuthService authService;

    @GetMapping
    @Operation(summary = "List user's tenants", description = "Returns all tenants the authenticated user has access to")
    public ResponseEntity<List<TenantDto>> listTenants(@AuthenticationPrincipal Jwt jwt) {
        User user = authService.getOrCreateUser(jwt);
        log.info("Listing tenants for user: {}", user.getId());
        List<TenantDto> tenants = tenantService.getTenantsForUser(user.getId());
        return ResponseEntity.ok(tenants);
    }

    @GetMapping("/{tenantId}")
    @Operation(summary = "Get tenant details", description = "Returns details for a specific tenant")
    public ResponseEntity<TenantDto> getTenant(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID tenantId
    ) {
        User user = authService.getOrCreateUser(jwt);
        log.info("Getting tenant {} for user {}", tenantId, user.getId());
        TenantDto tenant = tenantService.getTenantForUser(user.getId(), tenantId);
        return ResponseEntity.ok(tenant);
    }

    @PostMapping("/{tenantId}/switch")
    @Operation(summary = "Switch to tenant context", description = "Triggers token exchange to switch to the specified tenant context")
    public ResponseEntity<TokenExchangeResponse> switchTenant(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID tenantId
    ) {
        log.info("Switching context to tenant: {}", tenantId);
        TokenExchangeRequest request = TokenExchangeRequest.builder()
                .targetTenantId(tenantId)
                .build();
        TokenExchangeResponse response = authService.exchangeToken(jwt, request);
        return ResponseEntity.ok(response);
    }
}
