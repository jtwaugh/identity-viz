package bank.authz

import rego.v1

# Test data helpers
base_input := {
    "user": {
        "id": "user-001",
        "email": "test@example.com"
    },
    "tenant": {
        "id": "tenant-001",
        "type": "CONSUMER"
    },
    "resource": {
        "type": "account",
        "id": "account-001"
    },
    "context": {
        "channel": "WEB",
        "ip_address": "192.168.1.1",
        "user_agent": "Mozilla/5.0",
        "risk_score": 0,
        "time_of_day": "10:00:00",
        "is_new_device": false
    }
}

# =============================================================================
# Test Rule 1: view_balance (any role)
# =============================================================================

test_view_balance_owner_allowed if {
    allow with input as object.union(base_input, {
        "action": "view_balance",
        "role": "OWNER"
    })
}

test_view_balance_admin_allowed if {
    allow with input as object.union(base_input, {
        "action": "view_balance",
        "role": "ADMIN"
    })
}

test_view_balance_operator_allowed if {
    allow with input as object.union(base_input, {
        "action": "view_balance",
        "role": "OPERATOR"
    })
}

test_view_balance_viewer_allowed if {
    allow with input as object.union(base_input, {
        "action": "view_balance",
        "role": "VIEWER"
    })
}

test_view_balance_no_role_denied if {
    not allow with input as object.union(base_input, {
        "action": "view_balance",
        "role": "UNKNOWN"
    })
}

# =============================================================================
# Test Rule 2: view_transactions (OPERATOR+)
# =============================================================================

test_view_transactions_owner_allowed if {
    allow with input as object.union(base_input, {
        "action": "view_transactions",
        "role": "OWNER"
    })
}

test_view_transactions_admin_allowed if {
    allow with input as object.union(base_input, {
        "action": "view_transactions",
        "role": "ADMIN"
    })
}

test_view_transactions_operator_allowed if {
    allow with input as object.union(base_input, {
        "action": "view_transactions",
        "role": "OPERATOR"
    })
}

test_view_transactions_viewer_denied if {
    not allow with input as object.union(base_input, {
        "action": "view_transactions",
        "role": "VIEWER"
    })
}

# =============================================================================
# Test Rule 3: internal_transfer (OPERATOR+ AND risk < 50)
# =============================================================================

test_internal_transfer_owner_low_risk_allowed if {
    allow with input as object.union(base_input, {
        "action": "internal_transfer",
        "role": "OWNER",
        "context": object.union(base_input.context, {"risk_score": 10})
    })
}

test_internal_transfer_admin_low_risk_allowed if {
    allow with input as object.union(base_input, {
        "action": "internal_transfer",
        "role": "ADMIN",
        "context": object.union(base_input.context, {"risk_score": 25})
    })
}

test_internal_transfer_operator_low_risk_allowed if {
    allow with input as object.union(base_input, {
        "action": "internal_transfer",
        "role": "OPERATOR",
        "context": object.union(base_input.context, {"risk_score": 49})
    })
}

test_internal_transfer_viewer_denied if {
    not allow with input as object.union(base_input, {
        "action": "internal_transfer",
        "role": "VIEWER",
        "context": object.union(base_input.context, {"risk_score": 10})
    })
}

test_internal_transfer_operator_high_risk_denied if {
    not allow with input as object.union(base_input, {
        "action": "internal_transfer",
        "role": "OPERATOR",
        "context": object.union(base_input.context, {"risk_score": 50})
    })
}

test_internal_transfer_owner_high_risk_denied if {
    not allow with input as object.union(base_input, {
        "action": "internal_transfer",
        "role": "OWNER",
        "context": object.union(base_input.context, {"risk_score": 75})
    })
}

# =============================================================================
# Test Rule 4: external_transfer (ADMIN+ AND risk < 30)
# =============================================================================

test_external_transfer_owner_low_risk_allowed if {
    allow with input as object.union(base_input, {
        "action": "external_transfer",
        "role": "OWNER",
        "context": object.union(base_input.context, {"risk_score": 5})
    })
}

test_external_transfer_admin_low_risk_allowed if {
    allow with input as object.union(base_input, {
        "action": "external_transfer",
        "role": "ADMIN",
        "context": object.union(base_input.context, {"risk_score": 29})
    })
}

test_external_transfer_operator_denied if {
    not allow with input as object.union(base_input, {
        "action": "external_transfer",
        "role": "OPERATOR",
        "context": object.union(base_input.context, {"risk_score": 10})
    })
}

test_external_transfer_admin_high_risk_denied if {
    not allow with input as object.union(base_input, {
        "action": "external_transfer",
        "role": "ADMIN",
        "context": object.union(base_input.context, {"risk_score": 30})
    })
}

test_external_transfer_owner_high_risk_denied if {
    not allow with input as object.union(base_input, {
        "action": "external_transfer",
        "role": "OWNER",
        "context": object.union(base_input.context, {"risk_score": 50})
    })
}

# =============================================================================
# Test Rule 5: wire_transfer (OWNER AND risk < 10 AND business hours)
# =============================================================================

test_wire_transfer_owner_low_risk_business_hours_allowed if {
    allow with input as object.union(base_input, {
        "action": "wire_transfer",
        "role": "OWNER",
        "context": object.union(base_input.context, {
            "risk_score": 5,
            "time_of_day": "14:30:00"
        })
    })
}

test_wire_transfer_owner_edge_risk_allowed if {
    allow with input as object.union(base_input, {
        "action": "wire_transfer",
        "role": "OWNER",
        "context": object.union(base_input.context, {
            "risk_score": 9,
            "time_of_day": "10:00:00"
        })
    })
}

test_wire_transfer_owner_early_morning_allowed if {
    allow with input as object.union(base_input, {
        "action": "wire_transfer",
        "role": "OWNER",
        "context": object.union(base_input.context, {
            "risk_score": 5,
            "time_of_day": "06:00:00"
        })
    })
}

test_wire_transfer_owner_late_evening_allowed if {
    allow with input as object.union(base_input, {
        "action": "wire_transfer",
        "role": "OWNER",
        "context": object.union(base_input.context, {
            "risk_score": 5,
            "time_of_day": "21:59:59"
        })
    })
}

test_wire_transfer_admin_denied if {
    not allow with input as object.union(base_input, {
        "action": "wire_transfer",
        "role": "ADMIN",
        "context": object.union(base_input.context, {
            "risk_score": 5,
            "time_of_day": "10:00:00"
        })
    })
}

test_wire_transfer_owner_high_risk_denied if {
    not allow with input as object.union(base_input, {
        "action": "wire_transfer",
        "role": "OWNER",
        "context": object.union(base_input.context, {
            "risk_score": 10,
            "time_of_day": "10:00:00"
        })
    })
}

test_wire_transfer_owner_before_hours_denied if {
    not allow with input as object.union(base_input, {
        "action": "wire_transfer",
        "role": "OWNER",
        "context": object.union(base_input.context, {
            "risk_score": 5,
            "time_of_day": "05:59:59"
        })
    })
}

test_wire_transfer_owner_after_hours_denied if {
    not allow with input as object.union(base_input, {
        "action": "wire_transfer",
        "role": "OWNER",
        "context": object.union(base_input.context, {
            "risk_score": 5,
            "time_of_day": "22:00:00"
        })
    })
}

test_wire_transfer_owner_late_night_denied if {
    not allow with input as object.union(base_input, {
        "action": "wire_transfer",
        "role": "OWNER",
        "context": object.union(base_input.context, {
            "risk_score": 5,
            "time_of_day": "02:00:00"
        })
    })
}

# =============================================================================
# Test Rule 6: manage_users (ADMIN+)
# =============================================================================

test_manage_users_owner_allowed if {
    allow with input as object.union(base_input, {
        "action": "manage_users",
        "role": "OWNER"
    })
}

test_manage_users_admin_allowed if {
    allow with input as object.union(base_input, {
        "action": "manage_users",
        "role": "ADMIN"
    })
}

test_manage_users_operator_denied if {
    not allow with input as object.union(base_input, {
        "action": "manage_users",
        "role": "OPERATOR"
    })
}

test_manage_users_viewer_denied if {
    not allow with input as object.union(base_input, {
        "action": "manage_users",
        "role": "VIEWER"
    })
}

# =============================================================================
# Test Rule 7: tenant_settings (OWNER only)
# =============================================================================

test_tenant_settings_owner_allowed if {
    allow with input as object.union(base_input, {
        "action": "tenant_settings",
        "role": "OWNER"
    })
}

test_tenant_settings_admin_denied if {
    not allow with input as object.union(base_input, {
        "action": "tenant_settings",
        "role": "ADMIN"
    })
}

test_tenant_settings_operator_denied if {
    not allow with input as object.union(base_input, {
        "action": "tenant_settings",
        "role": "OPERATOR"
    })
}

# =============================================================================
# Test decision output structure
# =============================================================================

test_decision_output_structure if {
    result := decision with input as object.union(base_input, {
        "action": "view_balance",
        "role": "OWNER"
    })
    result.allow == true
    result.reason == "Access granted"
    result.role == "OWNER"
    result.action == "view_balance"
    result.risk_score == 0
}

test_decision_denial_reason if {
    result := decision with input as object.union(base_input, {
        "action": "wire_transfer",
        "role": "OWNER",
        "context": object.union(base_input.context, {"risk_score": 50})
    })
    result.allow == false
    contains(result.reason, "Risk score too high")
}

# =============================================================================
# Test role hierarchy helpers
# =============================================================================

test_is_owner if {
    is_owner with input as object.union(base_input, {"role": "OWNER"})
}

test_is_admin_or_higher_with_owner if {
    is_admin_or_higher with input as object.union(base_input, {"role": "OWNER"})
}

test_is_admin_or_higher_with_admin if {
    is_admin_or_higher with input as object.union(base_input, {"role": "ADMIN"})
}

test_is_admin_or_higher_with_operator_fails if {
    not is_admin_or_higher with input as object.union(base_input, {"role": "OPERATOR"})
}

test_is_operator_or_higher_with_all_valid_roles if {
    is_operator_or_higher with input as object.union(base_input, {"role": "OWNER"})
    is_operator_or_higher with input as object.union(base_input, {"role": "ADMIN"})
    is_operator_or_higher with input as object.union(base_input, {"role": "OPERATOR"})
}

test_is_operator_or_higher_with_viewer_fails if {
    not is_operator_or_higher with input as object.union(base_input, {"role": "VIEWER"})
}

# =============================================================================
# Test business hours helper
# =============================================================================

test_within_business_hours_valid_times if {
    within_business_hours with input as object.union(base_input, {
        "context": object.union(base_input.context, {"time_of_day": "06:00:00"})
    })
    within_business_hours with input as object.union(base_input, {
        "context": object.union(base_input.context, {"time_of_day": "12:00:00"})
    })
    within_business_hours with input as object.union(base_input, {
        "context": object.union(base_input.context, {"time_of_day": "21:59:59"})
    })
}

test_within_business_hours_invalid_times if {
    not within_business_hours with input as object.union(base_input, {
        "context": object.union(base_input.context, {"time_of_day": "05:59:59"})
    })
    not within_business_hours with input as object.union(base_input, {
        "context": object.union(base_input.context, {"time_of_day": "22:00:00"})
    })
    not within_business_hours with input as object.union(base_input, {
        "context": object.union(base_input.context, {"time_of_day": "23:00:00"})
    })
}

# =============================================================================
# Test unknown actions
# =============================================================================

test_unknown_action_denied if {
    not allow with input as object.union(base_input, {
        "action": "unknown_action",
        "role": "OWNER"
    })
}

test_empty_action_denied if {
    not allow with input as object.union(base_input, {
        "action": "",
        "role": "OWNER"
    })
}
