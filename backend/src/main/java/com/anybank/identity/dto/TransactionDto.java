package com.anybank.identity.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * DTO representing a financial transaction.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TransactionDto {

    /**
     * Transaction identifier.
     */
    private UUID id;

    /**
     * Transaction date/time.
     */
    private Instant date;

    /**
     * Transaction description.
     */
    private String description;

    /**
     * Transaction category (e.g., "Income", "Utilities", "Food & Dining").
     */
    private String category;

    /**
     * Transaction amount (positive for credits, negative for debits).
     */
    private BigDecimal amount;

    /**
     * Running balance after this transaction.
     */
    private BigDecimal balance;
}
