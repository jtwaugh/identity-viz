package com.anybank.identity.repository;

import com.anybank.identity.entity.Membership;
import com.anybank.identity.entity.Membership.MembershipStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface MembershipRepository extends JpaRepository<Membership, UUID> {

    @Query("SELECT m FROM Membership m JOIN FETCH m.tenant WHERE m.user.id = :userId AND m.status = :status")
    List<Membership> findByUserIdAndStatus(@Param("userId") UUID userId, @Param("status") MembershipStatus status);

    @Query("SELECT m FROM Membership m JOIN FETCH m.tenant WHERE m.user.id = :userId")
    List<Membership> findByUserId(@Param("userId") UUID userId);

    @Query("SELECT m FROM Membership m JOIN FETCH m.user WHERE m.tenant.id = :tenantId AND m.status = :status")
    List<Membership> findByTenantIdAndStatus(@Param("tenantId") UUID tenantId, @Param("status") MembershipStatus status);

    @Query("SELECT m FROM Membership m JOIN FETCH m.user WHERE m.tenant.id = :tenantId")
    List<Membership> findByTenantId(@Param("tenantId") UUID tenantId);

    Optional<Membership> findByUserIdAndTenantId(UUID userId, UUID tenantId);

    boolean existsByUserIdAndTenantIdAndStatus(UUID userId, UUID tenantId, MembershipStatus status);
}
