package com.anybank.identity.dto;

import com.anybank.identity.dto.TenantDto.MembershipRole;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

/**
 * DTO representing a team member within a tenant.
 * Used for the admin users endpoint to include role information.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TeamMemberDto {

    /**
     * User identifier.
     */
    private UUID id;

    /**
     * User's display name.
     */
    private String name;

    /**
     * User's email address.
     */
    private String email;

    /**
     * User's role within the tenant.
     */
    private MembershipRole role;
}
