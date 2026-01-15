package com.anybank.identity.exception;

/**
 * Exception thrown when token exchange (RFC 8693) fails.
 *
 * This can occur due to:
 * - Invalid identity token
 * - Keycloak service unavailable
 * - Token exchange not permitted by policy
 * - Insufficient permissions
 */
public class TokenExchangeException extends RuntimeException {

    private final String errorCode;

    public TokenExchangeException(String message) {
        super(message);
        this.errorCode = "TOKEN_EXCHANGE_FAILED";
    }

    public TokenExchangeException(String message, String errorCode) {
        super(message);
        this.errorCode = errorCode;
    }

    public TokenExchangeException(String message, Throwable cause) {
        super(message, cause);
        this.errorCode = "TOKEN_EXCHANGE_FAILED";
    }

    public TokenExchangeException(String message, String errorCode, Throwable cause) {
        super(message, cause);
        this.errorCode = errorCode;
    }

    public String getErrorCode() {
        return errorCode;
    }
}
