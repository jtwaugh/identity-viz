package com.anybank.identity.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Response wrapper for account list endpoint.
 * Wraps the list in an "accounts" field for frontend compatibility.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AccountListResponse {
    private List<AccountDto> accounts;
}
