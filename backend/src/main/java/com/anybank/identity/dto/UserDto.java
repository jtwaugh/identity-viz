package com.anybank.identity.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * DTO representing a user in the system.
 *
 * Users are authenticated via Keycloak and can belong to multiple tenants
 * with different roles.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class UserDto {

    /**
     * Internal user identifier.
     */
    private UUID id;

    /**
     * External ID from Keycloak (subject claim from JWT).
     */
    private String externalId;

    /**
     * User's email address.
     */
    @Email(message = "Invalid email format")
    @NotBlank(message = "Email is required")
    private String email;

    /**
     * User's display name.
     */
    @NotBlank(message = "Display name is required")
    private String displayName;

    /**
     * Whether MFA is enabled for this user.
     */
    @Builder.Default
    private Boolean mfaEnabled = false;

    /**
     * List of tenants the user has access to (with roles).
     * Only populated when fetching user profile with tenant memberships.
     */
    private List<TenantDto> tenants;

    /**
     * When the user account was created.
     */
    private Instant createdAt;

    /**
     * When the user account was last updated.
     */
    private Instant updatedAt;
}
