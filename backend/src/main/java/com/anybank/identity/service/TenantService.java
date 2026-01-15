package com.anybank.identity.service;

import com.anybank.identity.dto.TenantDto;
import com.anybank.identity.dto.TenantDto.MembershipRole;
import com.anybank.identity.entity.Membership;
import com.anybank.identity.entity.Membership.MembershipStatus;
import com.anybank.identity.entity.Tenant;
import com.anybank.identity.entity.User;
import com.anybank.identity.exception.TenantAccessDeniedException;
import com.anybank.identity.mapper.TenantMapper;
import com.anybank.identity.repository.MembershipRepository;
import com.anybank.identity.repository.TenantRepository;
import com.anybank.identity.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class TenantService {

    private final TenantRepository tenantRepository;
    private final MembershipRepository membershipRepository;
    private final UserRepository userRepository;
    private final TenantMapper tenantMapper;

    @Transactional(readOnly = true)
    public List<TenantDto> getTenantsForUser(UUID userId) {
        List<Membership> memberships = membershipRepository.findByUserIdAndStatus(userId, MembershipStatus.ACTIVE);

        return memberships.stream()
                .map(m -> {
                    TenantDto dto = tenantMapper.toDto(m.getTenant());
                    dto.setRole(m.getRole());
                    return dto;
                })
                .toList();
    }

    @Transactional(readOnly = true)
    public TenantDto getTenant(UUID tenantId) {
        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new TenantAccessDeniedException("Tenant not found: " + tenantId));
        return tenantMapper.toDto(tenant);
    }

    @Transactional(readOnly = true)
    public TenantDto getTenantForUser(UUID userId, UUID tenantId) {
        Membership membership = membershipRepository.findByUserIdAndTenantId(userId, tenantId)
                .orElseThrow(() -> new TenantAccessDeniedException("User does not have access to tenant: " + tenantId));

        if (membership.getStatus() != MembershipStatus.ACTIVE) {
            throw new TenantAccessDeniedException("Membership is not active for tenant: " + tenantId);
        }

        TenantDto dto = tenantMapper.toDto(membership.getTenant());
        dto.setRole(membership.getRole());
        return dto;
    }

    @Transactional(readOnly = true)
    public MembershipRole getUserRoleInTenant(UUID userId, UUID tenantId) {
        return membershipRepository.findByUserIdAndTenantId(userId, tenantId)
                .filter(m -> m.getStatus() == MembershipStatus.ACTIVE)
                .map(Membership::getRole)
                .orElseThrow(() -> new TenantAccessDeniedException("User does not have access to tenant: " + tenantId));
    }

    @Transactional(readOnly = true)
    public boolean hasAccess(UUID userId, UUID tenantId) {
        return membershipRepository.existsByUserIdAndTenantIdAndStatus(userId, tenantId, MembershipStatus.ACTIVE);
    }

    @Transactional(readOnly = true)
    public List<Membership> getMembersOfTenant(UUID tenantId) {
        return membershipRepository.findByTenantIdAndStatus(tenantId, MembershipStatus.ACTIVE);
    }
}
