package com.anybank.identity.service;

import com.anybank.identity.dto.AccountDto;
import com.anybank.identity.dto.AccountDto.AccountStatus;
import com.anybank.identity.dto.TransactionDto;
import com.anybank.identity.entity.Account;
import com.anybank.identity.exception.TenantAccessDeniedException;
import com.anybank.identity.mapper.AccountMapper;
import com.anybank.identity.repository.AccountRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class AccountService {

    private final AccountRepository accountRepository;
    private final AccountMapper accountMapper;

    @Transactional(readOnly = true)
    public List<AccountDto> getAccountsForTenant(UUID tenantId) {
        List<Account> accounts = accountRepository.findByTenantIdAndStatus(tenantId, AccountStatus.ACTIVE);
        return accounts.stream()
                .map(accountMapper::toDto)
                .toList();
    }

    @Transactional(readOnly = true)
    public AccountDto getAccount(UUID accountId, UUID tenantId) {
        Account account = accountRepository.findByIdAndTenantId(accountId, tenantId)
                .orElseThrow(() -> new TenantAccessDeniedException("Account not found or not accessible: " + accountId));
        return accountMapper.toDto(account);
    }

    @Transactional(readOnly = true)
    public AccountDto getAccountByNumber(String accountNumber) {
        Account account = accountRepository.findByAccountNumber(accountNumber)
                .orElseThrow(() -> new TenantAccessDeniedException("Account not found: " + accountNumber));
        return accountMapper.toDto(account);
    }

    /**
     * Get mock transactions for an account.
     * In a real implementation, this would query a transactions table.
     */
    public List<TransactionDto> getTransactionsForAccount(UUID accountId, UUID tenantId) {
        // Verify the account belongs to the tenant
        Account account = accountRepository.findByIdAndTenantId(accountId, tenantId)
                .orElseThrow(() -> new TenantAccessDeniedException("Account not found or not accessible: " + accountId));

        // Generate mock transactions based on account type
        Instant now = Instant.now();
        BigDecimal currentBalance = account.getBalance();

        // Check if this is a business account (high balance)
        boolean isBusinessAccount = currentBalance.compareTo(new BigDecimal("100000")) > 0;

        if (isBusinessAccount) {
            return List.of(
                TransactionDto.builder()
                    .id(UUID.randomUUID())
                    .date(now.minus(1, ChronoUnit.DAYS))
                    .description("Wire Transfer - Client Payment")
                    .category("Income")
                    .amount(new BigDecimal("125000.00"))
                    .balance(currentBalance)
                    .build(),
                TransactionDto.builder()
                    .id(UUID.randomUUID())
                    .date(now.minus(2, ChronoUnit.DAYS))
                    .description("Payroll - Bi-weekly")
                    .category("Payroll")
                    .amount(new BigDecimal("-234500.00"))
                    .balance(currentBalance.subtract(new BigDecimal("125000.00")))
                    .build(),
                TransactionDto.builder()
                    .id(UUID.randomUUID())
                    .date(now.minus(3, ChronoUnit.DAYS))
                    .description("Vendor Payment - Office Supplies")
                    .category("Operations")
                    .amount(new BigDecimal("-8750.00"))
                    .balance(currentBalance.subtract(new BigDecimal("125000.00")).add(new BigDecimal("234500.00")))
                    .build(),
                TransactionDto.builder()
                    .id(UUID.randomUUID())
                    .date(now.minus(4, ChronoUnit.DAYS))
                    .description("Client Invoice #1234")
                    .category("Income")
                    .amount(new BigDecimal("45000.00"))
                    .balance(currentBalance.subtract(new BigDecimal("125000.00")).add(new BigDecimal("234500.00")).add(new BigDecimal("8750.00")))
                    .build()
            );
        } else {
            return List.of(
                TransactionDto.builder()
                    .id(UUID.randomUUID())
                    .date(now.minus(1, ChronoUnit.DAYS))
                    .description("Direct Deposit - Payroll")
                    .category("Income")
                    .amount(new BigDecimal("3250.00"))
                    .balance(currentBalance)
                    .build(),
                TransactionDto.builder()
                    .id(UUID.randomUUID())
                    .date(now.minus(2, ChronoUnit.DAYS))
                    .description("Electric Company")
                    .category("Utilities")
                    .amount(new BigDecimal("-145.32"))
                    .balance(currentBalance.subtract(new BigDecimal("3250.00")))
                    .build(),
                TransactionDto.builder()
                    .id(UUID.randomUUID())
                    .date(now.minus(3, ChronoUnit.DAYS))
                    .description("Grocery Store")
                    .category("Food & Dining")
                    .amount(new BigDecimal("-87.54"))
                    .balance(currentBalance.subtract(new BigDecimal("3250.00")).add(new BigDecimal("145.32")))
                    .build(),
                TransactionDto.builder()
                    .id(UUID.randomUUID())
                    .date(now.minus(4, ChronoUnit.DAYS))
                    .description("Refund - Online Purchase")
                    .category("Shopping")
                    .amount(new BigDecimal("29.99"))
                    .balance(currentBalance.subtract(new BigDecimal("3250.00")).add(new BigDecimal("145.32")).add(new BigDecimal("87.54")))
                    .build(),
                TransactionDto.builder()
                    .id(UUID.randomUUID())
                    .date(now.minus(5, ChronoUnit.DAYS))
                    .description("Gas Station")
                    .category("Transportation")
                    .amount(new BigDecimal("-45.00"))
                    .balance(currentBalance.subtract(new BigDecimal("3250.00")).add(new BigDecimal("145.32")).add(new BigDecimal("87.54")).subtract(new BigDecimal("29.99")))
                    .build(),
                TransactionDto.builder()
                    .id(UUID.randomUUID())
                    .date(now.minus(6, ChronoUnit.DAYS))
                    .description("Restaurant")
                    .category("Food & Dining")
                    .amount(new BigDecimal("-62.80"))
                    .balance(currentBalance.subtract(new BigDecimal("3250.00")).add(new BigDecimal("145.32")).add(new BigDecimal("87.54")).subtract(new BigDecimal("29.99")).add(new BigDecimal("45.00")))
                    .build()
            );
        }
    }
}
