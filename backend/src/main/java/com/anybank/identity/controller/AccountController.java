package com.anybank.identity.controller;

import com.anybank.identity.dto.AccountDto;
import com.anybank.identity.dto.AccountListResponse;
import com.anybank.identity.dto.TransactionDto;
import com.anybank.identity.dto.TransactionListResponse;
import com.anybank.identity.security.TenantContext;
import com.anybank.identity.service.AccountService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/accounts")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "Accounts", description = "Financial account management endpoints")
public class AccountController {

    private final AccountService accountService;

    @GetMapping
    @Operation(summary = "List accounts", description = "Returns all accounts in the current tenant context")
    public ResponseEntity<AccountListResponse> listAccounts(@AuthenticationPrincipal Jwt jwt) {
        UUID tenantId = TenantContext.getCurrentTenantId();
        if (tenantId == null) {
            // Fall back to extracting from JWT claim
            String tenantIdClaim = jwt.getClaimAsString("tenant_id");
            if (tenantIdClaim != null) {
                tenantId = UUID.fromString(tenantIdClaim);
            }
        }

        if (tenantId == null) {
            return ResponseEntity.badRequest().build();
        }

        log.info("Listing accounts for tenant: {}", tenantId);
        List<AccountDto> accounts = accountService.getAccountsForTenant(tenantId);
        return ResponseEntity.ok(AccountListResponse.builder().accounts(accounts).build());
    }

    @GetMapping("/{accountId}")
    @Operation(summary = "Get account details", description = "Returns details for a specific account")
    public ResponseEntity<AccountDto> getAccount(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID accountId
    ) {
        UUID tenantId = TenantContext.getCurrentTenantId();
        if (tenantId == null) {
            String tenantIdClaim = jwt.getClaimAsString("tenant_id");
            if (tenantIdClaim != null) {
                tenantId = UUID.fromString(tenantIdClaim);
            }
        }

        if (tenantId == null) {
            return ResponseEntity.badRequest().build();
        }

        log.info("Getting account {} for tenant {}", accountId, tenantId);
        AccountDto account = accountService.getAccount(accountId, tenantId);
        return ResponseEntity.ok(account);
    }

    @GetMapping("/{accountId}/transactions")
    @Operation(summary = "Get account transactions", description = "Returns transaction history for an account")
    public ResponseEntity<TransactionListResponse> getTransactions(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID accountId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        UUID tenantId = TenantContext.getCurrentTenantId();
        if (tenantId == null) {
            String tenantIdClaim = jwt.getClaimAsString("tenant_id");
            if (tenantIdClaim != null) {
                tenantId = UUID.fromString(tenantIdClaim);
            }
        }

        if (tenantId == null) {
            return ResponseEntity.badRequest().build();
        }

        log.info("Getting transactions for account: {}", accountId);
        List<TransactionDto> transactions = accountService.getTransactionsForAccount(accountId, tenantId);
        return ResponseEntity.ok(TransactionListResponse.builder().transactions(transactions).build());
    }

    @PostMapping("/{accountId}/transfer")
    @Operation(summary = "Initiate transfer", description = "Initiates a money transfer from this account")
    public ResponseEntity<Object> initiateTransfer(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID accountId,
            @RequestBody TransferRequest request
    ) {
        // Transfer logic would be implemented here
        // This would involve policy checks via OPA
        log.info("Transfer initiated from account: {}", accountId);
        return ResponseEntity.ok().build();
    }

    public record TransferRequest(
            UUID toAccountId,
            java.math.BigDecimal amount,
            String memo
    ) {}
}
