package com.anybank.identity.repository;

import com.anybank.identity.dto.AccountDto.AccountStatus;
import com.anybank.identity.entity.Account;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface AccountRepository extends JpaRepository<Account, UUID> {

    List<Account> findByTenantId(UUID tenantId);

    List<Account> findByTenantIdAndStatus(UUID tenantId, AccountStatus status);

    Optional<Account> findByAccountNumber(String accountNumber);

    @Query("SELECT a FROM Account a WHERE a.tenant.id = :tenantId AND a.id = :accountId")
    Optional<Account> findByIdAndTenantId(@Param("accountId") UUID accountId, @Param("tenantId") UUID tenantId);

    boolean existsByAccountNumber(String accountNumber);
}
