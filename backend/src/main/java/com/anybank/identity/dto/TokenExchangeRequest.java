package com.anybank.identity.dto;

import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

/**
 * Request DTO for token exchange (RFC 8693).
 *
 * Used when a user switches context from one tenant to another.
 * The identity token is provided in the Authorization header,
 * and this request specifies which tenant to switch to.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TokenExchangeRequest {

    /**
     * The UUID of the tenant the user wants to switch to.
     * Must be a tenant the user has access to (verified via Memberships table).
     */
    @NotNull(message = "Target tenant ID is required")
    private UUID targetTenantId;
}
