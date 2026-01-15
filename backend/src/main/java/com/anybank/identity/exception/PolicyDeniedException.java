package com.anybank.identity.exception;

import java.util.Map;

/**
 * Exception thrown when OPA policy engine denies an action.
 *
 * This exception includes details about why the policy denied the action,
 * such as insufficient role, high risk score, or other policy violations.
 */
public class PolicyDeniedException extends RuntimeException {

    private final String action;
    private final String reason;
    private final Integer riskScore;
    private final Map<String, Object> policyDetails;

    public PolicyDeniedException(String action, String reason) {
        super(String.format("Policy denied action '%s': %s", action, reason));
        this.action = action;
        this.reason = reason;
        this.riskScore = null;
        this.policyDetails = null;
    }

    public PolicyDeniedException(String action, String reason, Integer riskScore) {
        super(String.format("Policy denied action '%s': %s (Risk Score: %d)", action, reason, riskScore));
        this.action = action;
        this.reason = reason;
        this.riskScore = riskScore;
        this.policyDetails = null;
    }

    public PolicyDeniedException(String action, String reason, Map<String, Object> policyDetails) {
        super(String.format("Policy denied action '%s': %s", action, reason));
        this.action = action;
        this.reason = reason;
        this.riskScore = null;
        this.policyDetails = policyDetails;
    }

    public PolicyDeniedException(String action, String reason, Integer riskScore, Map<String, Object> policyDetails) {
        super(String.format("Policy denied action '%s': %s (Risk Score: %d)", action, reason, riskScore));
        this.action = action;
        this.reason = reason;
        this.riskScore = riskScore;
        this.policyDetails = policyDetails;
    }

    public String getAction() {
        return action;
    }

    public String getReason() {
        return reason;
    }

    public Integer getRiskScore() {
        return riskScore;
    }

    public Map<String, Object> getPolicyDetails() {
        return policyDetails;
    }
}
