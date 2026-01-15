package com.anybank.identity.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Response DTO for successful token exchange.
 *
 * Contains the new access token scoped to the target tenant,
 * along with tenant information for the frontend to display.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TokenExchangeResponse {

    /**
     * JWT access token scoped to the target tenant.
     * This token contains claims: tenant_id, tenant_type, role, permissions.
     */
    @JsonProperty("access_token")
    private String accessToken;

    /**
     * Token type (always "Bearer").
     */
    @JsonProperty("token_type")
    @Builder.Default
    private String tokenType = "Bearer";

    /**
     * Token lifetime in seconds.
     */
    @JsonProperty("expires_in")
    @Builder.Default
    private Integer expiresIn = 3600;

    /**
     * Information about the tenant this token is scoped to.
     */
    private TenantDto tenant;
}
