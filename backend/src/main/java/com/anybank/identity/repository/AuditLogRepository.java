package com.anybank.identity.repository;

import com.anybank.identity.entity.AuditLog;
import com.anybank.identity.entity.AuditLog.AuditOutcome;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Repository
public interface AuditLogRepository extends JpaRepository<AuditLog, UUID> {

    Page<AuditLog> findByUserId(UUID userId, Pageable pageable);

    Page<AuditLog> findByTenantId(UUID tenantId, Pageable pageable);

    Page<AuditLog> findByUserIdAndTenantId(UUID userId, UUID tenantId, Pageable pageable);

    List<AuditLog> findByUserIdAndOutcome(UUID userId, AuditOutcome outcome);

    @Query("SELECT a FROM AuditLog a WHERE a.user.id = :userId AND a.createdAt >= :since ORDER BY a.createdAt DESC")
    List<AuditLog> findRecentByUserId(@Param("userId") UUID userId, @Param("since") Instant since);

    @Query("SELECT COUNT(a) FROM AuditLog a WHERE a.user.id = :userId AND a.action = :action AND a.outcome = :outcome AND a.createdAt >= :since")
    long countRecentActions(
            @Param("userId") UUID userId,
            @Param("action") String action,
            @Param("outcome") AuditOutcome outcome,
            @Param("since") Instant since
    );
}
