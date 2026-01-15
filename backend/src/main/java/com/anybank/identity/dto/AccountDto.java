package com.anybank.identity.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * DTO representing a financial account within a tenant.
 *
 * Accounts belong to tenants and can be checking, savings, money market, etc.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class AccountDto {

    /**
     * Internal account identifier.
     */
    private UUID id;

    /**
     * The tenant that owns this account.
     */
    private UUID tenantId;

    /**
     * Masked account number for display (e.g., "****1234").
     */
    @NotBlank(message = "Account number is required")
    private String accountNumber;

    /**
     * Type of account.
     */
    @NotNull(message = "Account type is required")
    @JsonProperty("type")
    private AccountType accountType;

    /**
     * Display name/nickname for the account.
     */
    @NotBlank(message = "Account name is required")
    private String name;

    /**
     * Current account balance.
     */
    @Builder.Default
    private BigDecimal balance = BigDecimal.ZERO;

    /**
     * Currency code (ISO 4217).
     */
    @Builder.Default
    private String currency = "USD";

    /**
     * Current account status.
     */
    private AccountStatus status;

    /**
     * When the account was created.
     */
    private Instant createdAt;

    /**
     * Account type enumeration.
     */
    public enum AccountType {
        CHECKING,
        SAVINGS,
        MONEY_MARKET,
        CD,
        LOAN,
        CREDIT_LINE
    }

    /**
     * Account status enumeration.
     */
    public enum AccountStatus {
        ACTIVE,
        FROZEN,
        CLOSED
    }
}
