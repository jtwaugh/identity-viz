package bank.authz

import rego.v1

# Default deny - all actions are denied unless explicitly allowed
default allow := false

# Role hierarchy helper functions
# OWNER > ADMIN > OPERATOR > VIEWER

is_owner if {
    input.role == "OWNER"
}

is_admin_or_higher if {
    input.role in ["OWNER", "ADMIN"]
}

is_operator_or_higher if {
    input.role in ["OWNER", "ADMIN", "OPERATOR"]
}

is_viewer_or_higher if {
    input.role in ["OWNER", "ADMIN", "OPERATOR", "VIEWER"]
}

# Helper to check business hours (6 AM - 10 PM)
within_business_hours if {
    # Extract hour from time_of_day (format: "HH:MM:SS" or "HH:MM")
    time_parts := split(input.context.time_of_day, ":")
    hour := to_number(time_parts[0])
    hour >= 6
    hour < 22
}

# Policy Rule 1: View Balance
# Allow if user has any role in tenant (VIEWER+)
allow if {
    input.action == "view_balance"
    is_viewer_or_higher
}

# Policy Rule 2: View Transactions
# Allow if user has OPERATOR+ role
allow if {
    input.action == "view_transactions"
    is_operator_or_higher
}

# Policy Rule 3: Internal Transfer
# Allow if OPERATOR+ AND risk_score < 50
allow if {
    input.action == "internal_transfer"
    is_operator_or_higher
    input.context.risk_score < 50
}

# Policy Rule 4: External Transfer
# Allow if ADMIN+ AND risk_score < 30
allow if {
    input.action == "external_transfer"
    is_admin_or_higher
    input.context.risk_score < 30
}

# Policy Rule 5: Wire Transfer
# Allow if OWNER AND risk_score < 10 AND within business hours
allow if {
    input.action == "wire_transfer"
    is_owner
    input.context.risk_score < 10
    within_business_hours
}

# Policy Rule 6: Manage Users (User Management)
# Allow if ADMIN+ role
allow if {
    input.action == "manage_users"
    is_admin_or_higher
}

# Policy Rule 7: Tenant Settings (mentioned in spec but not in requirements)
# Allow if OWNER only
allow if {
    input.action == "tenant_settings"
    is_owner
}

# Decision output with reason
decision := {
    "allow": allow,
    "reason": reason,
    "risk_score": input.context.risk_score,
    "role": input.role,
    "action": input.action
}

# Reason for denial
reason := r if {
    allow
    r := "Access granted"
} else := r if {
    not is_viewer_or_higher
    r := "Insufficient permissions: User has no role in tenant"
} else := r if {
    input.action == "view_transactions"
    not is_operator_or_higher
    r := "Insufficient permissions: OPERATOR role or higher required"
} else := r if {
    input.action == "internal_transfer"
    not is_operator_or_higher
    r := "Insufficient permissions: OPERATOR role or higher required"
} else := r if {
    input.action == "internal_transfer"
    input.context.risk_score >= 50
    r := sprintf("Risk score too high: %d >= 50", [input.context.risk_score])
} else := r if {
    input.action == "external_transfer"
    not is_admin_or_higher
    r := "Insufficient permissions: ADMIN role or higher required"
} else := r if {
    input.action == "external_transfer"
    input.context.risk_score >= 30
    r := sprintf("Risk score too high: %d >= 30", [input.context.risk_score])
} else := r if {
    input.action == "wire_transfer"
    not is_owner
    r := "Insufficient permissions: OWNER role required"
} else := r if {
    input.action == "wire_transfer"
    input.context.risk_score >= 10
    r := sprintf("Risk score too high: %d >= 10", [input.context.risk_score])
} else := r if {
    input.action == "wire_transfer"
    not within_business_hours
    r := "Wire transfers only allowed during business hours (6 AM - 10 PM)"
} else := r if {
    input.action == "manage_users"
    not is_admin_or_higher
    r := "Insufficient permissions: ADMIN role or higher required"
} else := r if {
    input.action == "tenant_settings"
    not is_owner
    r := "Insufficient permissions: OWNER role required"
} else := r if {
    r := sprintf("Action '%s' is not recognized or permitted", [input.action])
}
