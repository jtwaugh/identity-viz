package com.anybank.identity.repository;

import com.anybank.identity.dto.TenantDto.TenantStatus;
import com.anybank.identity.entity.Tenant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface TenantRepository extends JpaRepository<Tenant, UUID> {

    Optional<Tenant> findByExternalId(String externalId);

    List<Tenant> findByStatus(TenantStatus status);

    boolean existsByExternalId(String externalId);
}
