package com.anybank.identity.controller;

import com.anybank.identity.dto.TeamMemberDto;
import com.anybank.identity.dto.TenantDto.MembershipRole;
import com.anybank.identity.dto.UserDto;
import com.anybank.identity.entity.Membership;
import com.anybank.identity.entity.User;
import com.anybank.identity.exception.TenantAccessDeniedException;
import com.anybank.identity.mapper.UserMapper;
import com.anybank.identity.security.TenantContext;
import com.anybank.identity.service.AuthService;
import com.anybank.identity.service.TenantService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "Admin", description = "Administrative endpoints for user management within tenants")
public class AdminController {

    private final TenantService tenantService;
    private final AuthService authService;
    private final UserMapper userMapper;

    @GetMapping("/users")
    @Operation(summary = "List tenant users", description = "Returns all users in the current tenant (ADMIN+ only)")
    public ResponseEntity<List<TeamMemberDto>> listUsers(@AuthenticationPrincipal Jwt jwt) {
        User currentUser = authService.getOrCreateUser(jwt);
        UUID tenantId = getTenantIdFromContext(jwt);

        // Verify admin access - prefer TenantContext role (from session/JWT), fallback to DB
        MembershipRole role = getRoleFromContextOrDb(currentUser.getId(), tenantId);
        if (!isAdminOrHigher(role)) {
            throw new TenantAccessDeniedException("Insufficient permissions to manage users");
        }

        log.info("Listing users for tenant: {}", tenantId);
        List<Membership> memberships = tenantService.getMembersOfTenant(tenantId);
        List<TeamMemberDto> members = memberships.stream()
                .map(m -> TeamMemberDto.builder()
                        .id(m.getUser().getId())
                        .name(m.getUser().getDisplayName())
                        .email(m.getUser().getEmail())
                        .role(m.getRole())
                        .build())
                .toList();

        return ResponseEntity.ok(members);
    }

    @PostMapping("/users/invite")
    @Operation(summary = "Invite user", description = "Invites a user to the current tenant")
    public ResponseEntity<Void> inviteUser(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody InviteUserRequest request
    ) {
        User currentUser = authService.getOrCreateUser(jwt);
        UUID tenantId = getTenantIdFromContext(jwt);

        MembershipRole role = getRoleFromContextOrDb(currentUser.getId(), tenantId);
        if (!isAdminOrHigher(role)) {
            throw new TenantAccessDeniedException("Insufficient permissions to invite users");
        }

        log.info("Inviting user {} to tenant {} with role {}",
                request.email(), tenantId, request.role());

        // Invitation logic would be implemented here
        return ResponseEntity.ok().build();
    }

    @PatchMapping("/users/{userId}/role")
    @Operation(summary = "Update user role", description = "Updates a user's role in the current tenant")
    public ResponseEntity<Void> updateUserRole(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID userId,
            @Valid @RequestBody UpdateRoleRequest request
    ) {
        User currentUser = authService.getOrCreateUser(jwt);
        UUID tenantId = getTenantIdFromContext(jwt);

        MembershipRole currentRole = getRoleFromContextOrDb(currentUser.getId(), tenantId);
        if (!isAdminOrHigher(currentRole)) {
            throw new TenantAccessDeniedException("Insufficient permissions to update user roles");
        }

        log.info("Updating role for user {} in tenant {} to {}",
                userId, tenantId, request.role());

        // Role update logic would be implemented here
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/users/{userId}")
    @Operation(summary = "Revoke user access", description = "Removes a user's access to the current tenant")
    public ResponseEntity<Void> revokeUserAccess(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID userId
    ) {
        User currentUser = authService.getOrCreateUser(jwt);
        UUID tenantId = getTenantIdFromContext(jwt);

        MembershipRole role = getRoleFromContextOrDb(currentUser.getId(), tenantId);
        if (!isAdminOrHigher(role)) {
            throw new TenantAccessDeniedException("Insufficient permissions to revoke user access");
        }

        log.info("Revoking access for user {} in tenant {}", userId, tenantId);

        // Revocation logic would be implemented here
        return ResponseEntity.ok().build();
    }

    private UUID getTenantIdFromContext(Jwt jwt) {
        UUID tenantId = TenantContext.getCurrentTenantId();
        if (tenantId == null) {
            String tenantIdClaim = jwt.getClaimAsString("tenant_id");
            if (tenantIdClaim != null) {
                tenantId = UUID.fromString(tenantIdClaim);
            }
        }
        if (tenantId == null) {
            throw new TenantAccessDeniedException("No tenant context available");
        }
        return tenantId;
    }

    private boolean isAdminOrHigher(MembershipRole role) {
        return role == MembershipRole.ADMIN || role == MembershipRole.OWNER;
    }

    /**
     * Get role from TenantContext first (set by BFF session auth), fallback to DB lookup.
     * This supports both JWT-based auth (with tenant claims) and BFF session-based auth.
     */
    private MembershipRole getRoleFromContextOrDb(UUID userId, UUID tenantId) {
        // First check TenantContext (set by TenantContextFilter from session or JWT)
        TenantContext.TenantInfo tenantInfo = TenantContext.getCurrentTenant();
        if (tenantInfo != null && tenantInfo.getRole() != null) {
            log.debug("Using role from TenantContext: {}", tenantInfo.getRole());
            return tenantInfo.getRole();
        }

        // Fallback to database lookup
        log.debug("Falling back to DB lookup for role");
        return tenantService.getUserRoleInTenant(userId, tenantId);
    }

    public record InviteUserRequest(
            @Email @NotBlank String email,
            @NotNull MembershipRole role
    ) {}

    public record UpdateRoleRequest(
            @NotNull MembershipRole role
    ) {}
}
