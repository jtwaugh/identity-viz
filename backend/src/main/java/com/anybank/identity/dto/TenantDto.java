package com.anybank.identity.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

/**
 * DTO representing a tenant/organization in the system.
 *
 * A tenant can be a consumer account, business entity, investment account, etc.
 * Users can belong to multiple tenants with different roles.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class TenantDto {

    /**
     * Internal tenant identifier.
     */
    private UUID id;

    /**
     * External reference ID (for integration with other systems).
     */
    private String externalId;

    /**
     * Display name of the tenant.
     * Examples: "John Doe", "AnyBusiness Inc.", "Doe Family Trust"
     */
    @NotBlank(message = "Tenant name is required")
    private String name;

    /**
     * Type of tenant/organization.
     */
    @NotNull(message = "Tenant type is required")
    private TenantType type;

    /**
     * Current status of the tenant.
     */
    private TenantStatus status;

    /**
     * User's role within this tenant (from Membership).
     * Only populated when retrieving tenants for a specific user.
     */
    private MembershipRole role;

    /**
     * When the tenant was created.
     */
    private Instant createdAt;

    /**
     * Tenant type enumeration.
     */
    public enum TenantType {
        CONSUMER,
        SMALL_BUSINESS,
        COMMERCIAL,
        INVESTMENT,
        TRUST
    }

    /**
     * Tenant status enumeration.
     */
    public enum TenantStatus {
        ACTIVE,
        SUSPENDED,
        CLOSED
    }

    /**
     * User's role within a tenant (from Membership table).
     */
    public enum MembershipRole {
        OWNER,
        ADMIN,
        OPERATOR,
        VIEWER
    }
}
