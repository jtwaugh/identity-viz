# OPA Authorization Policies

This directory contains the Open Policy Agent (OPA) authorization policies for the AnyBank Unified Identity Platform.

## Overview

The OPA policy engine provides fine-grained access control (FGAC) for banking operations based on:
- **User roles** within tenant contexts (OWNER, ADMIN, OPERATOR, VIEWER)
- **Real-time risk scores** (0-100 scale)
- **Contextual factors** (time of day, device, location, etc.)

The policy follows a **default-deny** approach: all actions are denied unless explicitly allowed by a policy rule.

## Role Hierarchy

The system implements a hierarchical role model:

```
OWNER (highest privilege)
  ├── Can perform all ADMIN actions
  ├── Can modify tenant settings
  └── Can perform wire transfers (with constraints)

ADMIN
  ├── Can perform all OPERATOR actions
  ├── Can manage users within tenant
  └── Can perform external transfers (with constraints)

OPERATOR
  ├── Can perform all VIEWER actions
  ├── Can view transaction history
  └── Can perform internal transfers (with constraints)

VIEWER (lowest privilege)
  └── Can view account balances
```

## Policy Rules

### 1. View Balance (`view_balance`)

**Allowed for**: Any role (VIEWER+)

**Requirements**:
- User must have a valid role in the tenant

**Use cases**: Dashboard views, account summaries

---

### 2. View Transactions (`view_transactions`)

**Allowed for**: OPERATOR, ADMIN, OWNER

**Requirements**:
- User must have OPERATOR role or higher

**Use cases**: Transaction history, account details, statements

---

### 3. Internal Transfer (`internal_transfer`)

**Allowed for**: OPERATOR, ADMIN, OWNER

**Requirements**:
- User must have OPERATOR role or higher
- Risk score must be **< 50**

**Use cases**: Moving funds between accounts within the same tenant

**Risk factors that may block**:
- New device (adds +30 to risk score)
- Unusual location (adds +25)
- Off hours access (adds +15)

---

### 4. External Transfer (`external_transfer`)

**Allowed for**: ADMIN, OWNER

**Requirements**:
- User must have ADMIN role or higher
- Risk score must be **< 30**

**Use cases**: ACH transfers to external accounts, bill payments

**Risk factors that may block**:
- High-risk scenarios (new device + unusual location = 55)
- Any combination resulting in risk ≥ 30

---

### 5. Wire Transfer (`wire_transfer`)

**Allowed for**: OWNER only

**Requirements**:
- User must have OWNER role
- Risk score must be **< 10**
- Time must be within business hours (6 AM - 10 PM)

**Use cases**: High-value wire transfers, international transfers

**Risk factors that may block**:
- Any elevated risk factor (threshold is very strict)
- Transfers outside 6 AM - 10 PM local time

---

### 6. Manage Users (`manage_users`)

**Allowed for**: ADMIN, OWNER

**Requirements**:
- User must have ADMIN role or higher

**Use cases**: Inviting users, changing roles, revoking access

---

### 7. Tenant Settings (`tenant_settings`)

**Allowed for**: OWNER only

**Requirements**:
- User must have OWNER role

**Use cases**: Modifying tenant configuration, security settings

---

## Policy Decision Matrix

| Action | VIEWER | OPERATOR | ADMIN | OWNER | Risk Threshold | Business Hours |
|--------|--------|----------|-------|-------|----------------|----------------|
| `view_balance` | ✅ | ✅ | ✅ | ✅ | N/A | No |
| `view_transactions` | ❌ | ✅ | ✅ | ✅ | N/A | No |
| `internal_transfer` | ❌ | ✅ (< 50) | ✅ (< 50) | ✅ (< 50) | < 50 | No |
| `external_transfer` | ❌ | ❌ | ✅ (< 30) | ✅ (< 30) | < 30 | No |
| `wire_transfer` | ❌ | ❌ | ❌ | ✅ (< 10) | < 10 | Yes |
| `manage_users` | ❌ | ❌ | ✅ | ✅ | N/A | No |
| `tenant_settings` | ❌ | ❌ | ❌ | ✅ | N/A | No |

**Legend**: ✅ = Allowed, ❌ = Denied, (< N) = Allowed if risk score is below N

---

## Risk Score Calculation

The backend calculates risk scores based on the following factors:

| Risk Factor | Weight | Description |
|-------------|--------|-------------|
| New Device | +30 | Device fingerprint not seen before |
| Unusual Location | +25 | IP geolocation differs from normal patterns |
| Off Hours | +15 | Access outside 6 AM - 10 PM local time |
| High Velocity | +20 | Many requests in short time window |
| Failed Auth Attempts | +10 each | Recent failed login attempts |
| VPN/Proxy Detected | +15 | Connection through anonymizer |

**Risk Score Range**: 0-100
- **0-10**: Very low risk (all actions possible for appropriate roles)
- **10-29**: Low risk (wire transfers blocked)
- **30-49**: Moderate risk (external transfers blocked)
- **50+**: High risk (internal transfers blocked)

---

## Input Schema

The backend sends the following JSON structure to OPA for each authorization decision:

```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com"
  },
  "tenant": {
    "id": "uuid",
    "type": "CONSUMER | SMALL_BUSINESS | COMMERCIAL | INVESTMENT | TRUST"
  },
  "role": "OWNER | ADMIN | OPERATOR | VIEWER",
  "action": "view_balance | view_transactions | internal_transfer | external_transfer | wire_transfer | manage_users | tenant_settings",
  "resource": {
    "type": "account | user | tenant",
    "id": "uuid"
  },
  "context": {
    "channel": "WEB | MOBILE | API | BRANCH | PHONE",
    "ip_address": "192.168.1.1",
    "user_agent": "Mozilla/5.0...",
    "risk_score": 0,
    "time_of_day": "14:30:00",
    "is_new_device": false
  }
}
```

## Output Schema

OPA returns a decision object:

```json
{
  "allow": true,
  "reason": "Access granted",
  "risk_score": 0,
  "role": "OWNER",
  "action": "view_balance"
}
```

When access is denied, the `reason` field provides a human-readable explanation:
- "Insufficient permissions: User has no role in tenant"
- "Risk score too high: 50 >= 50"
- "Wire transfers only allowed during business hours (6 AM - 10 PM)"

---

## Testing the Policies

### Running Unit Tests

The policies include comprehensive unit tests using OPA's test framework:

```bash
# Run all tests
opa test opa/

# Run tests with verbose output
opa test -v opa/

# Run tests with coverage report
opa test --coverage opa/
```

### Manual Policy Evaluation

Test a policy decision manually using the OPA CLI:

```bash
# Example: Test wire transfer for OWNER with low risk during business hours
opa eval -d opa/policy.rego -i <(cat <<EOF
{
  "user": {"id": "user-001", "email": "jdoe@example.com"},
  "tenant": {"id": "tenant-001", "type": "CONSUMER"},
  "role": "OWNER",
  "action": "wire_transfer",
  "resource": {"type": "account", "id": "account-001"},
  "context": {
    "channel": "WEB",
    "ip_address": "192.168.1.1",
    "user_agent": "Mozilla/5.0",
    "risk_score": 5,
    "time_of_day": "14:30:00",
    "is_new_device": false
  }
}
EOF
) "data.bank.authz.allow"
```

### Test Scenarios

#### Scenario 1: Normal Operations

```bash
# VIEWER can view balance (should pass)
# VIEWER cannot view transactions (should fail)
# OPERATOR can view transactions (should pass)
# OPERATOR cannot manage users (should fail)
```

#### Scenario 2: Risk-Based Denial

```bash
# OPERATOR with risk_score=45 can do internal transfer (should pass)
# OPERATOR with risk_score=50 cannot do internal transfer (should fail)
# ADMIN with risk_score=25 can do external transfer (should pass)
# ADMIN with risk_score=30 cannot do external transfer (should fail)
```

#### Scenario 3: Business Hours Constraint

```bash
# OWNER at 10:00 AM with low risk can wire transfer (should pass)
# OWNER at 11:00 PM with low risk cannot wire transfer (should fail)
```

---

## Integration with Backend

### Spring Boot Integration

The backend integrates OPA using the `PolicyService`:

```java
@Service
public class PolicyService {
    private final WebClient opaClient;

    public PolicyDecision evaluate(PolicyInput input) {
        return opaClient
            .post()
            .uri("/v1/data/bank/authz/decision")
            .bodyValue(input)
            .retrieve()
            .bodyToMono(PolicyDecision.class)
            .block();
    }
}
```

### Policy Enforcement Filter

The `PolicyEnforcementFilter` intercepts requests:

```java
@Component
public class PolicyEnforcementFilter extends OncePerRequestFilter {
    @Override
    protected void doFilterInternal(...) {
        PolicyInput input = buildPolicyInput(request);
        PolicyDecision decision = policyService.evaluate(input);

        if (!decision.isAllow()) {
            throw new AccessDeniedException(decision.getReason());
        }

        filterChain.doFilter(request, response);
    }
}
```

---

## Hot-Reloading Policies

OPA watches the policy files for changes. To update a policy without restarting:

1. Edit `opa/policy.rego`
2. Save the file
3. OPA automatically reloads (within 1 second)
4. New policy takes effect immediately

**Example**: Changing wire transfer risk threshold from 10 to 20:

```rego
# Before
allow if {
    input.action == "wire_transfer"
    is_owner
    input.context.risk_score < 10  # Old threshold
    within_business_hours
}

# After
allow if {
    input.action == "wire_transfer"
    is_owner
    input.context.risk_score < 20  # New threshold
    within_business_hours
}
```

---

## Docker Compose Configuration

The OPA service in `docker-compose.yml`:

```yaml
opa:
  image: openpolicyagent/opa:latest
  ports:
    - "8181:8181"
  volumes:
    - ./opa:/policies
  command:
    - "run"
    - "--server"
    - "--watch"
    - "/policies"
  networks:
    - bank-net
```

---

## Security Considerations

### Defense in Depth

The OPA policy layer is one component of a multi-layered security approach:

1. **Network Layer**: Firewall, VPC security groups
2. **Authentication**: Keycloak validates user identity
3. **Token Validation**: Backend verifies JWT signature and expiration
4. **Tenant Context**: Backend extracts and validates tenant_id from token
5. **Risk Evaluation**: Backend calculates real-time risk score
6. **OPA Authorization**: Policy engine makes final allow/deny decision
7. **Audit Logging**: All decisions are logged for compliance

### Policy Testing Best Practices

- Test both positive (allow) and negative (deny) cases
- Test boundary conditions (risk_score = 49 vs 50)
- Test time boundaries (05:59:59 vs 06:00:00)
- Test role hierarchy (ensure VIEWER cannot access OPERATOR actions)
- Test decision reasons for all denial scenarios

### Monitoring and Alerting

Monitor OPA policy decisions for:
- High denial rates (may indicate attack or misconfiguration)
- Unusual access patterns (multiple high-risk denials)
- Policy evaluation latency (should be < 5ms)
- Failed policy loads (syntax errors in Rego)

---

## Troubleshooting

### Common Issues

**Issue**: Policy always denies even for valid users

**Solution**: Check that the input includes the `role` field extracted from JWT token claims

---

**Issue**: Business hours check always fails

**Solution**: Ensure `time_of_day` is in format "HH:MM:SS" (e.g., "14:30:00")

---

**Issue**: OPA returns 500 error

**Solution**: Check OPA logs for Rego syntax errors:
```bash
docker-compose logs opa
```

---

**Issue**: Policy changes don't take effect

**Solution**: Verify OPA is running with `--watch` flag and volume is mounted correctly

---

## References

- [Open Policy Agent Documentation](https://www.openpolicyagent.org/docs/latest/)
- [Rego Language Guide](https://www.openpolicyagent.org/docs/latest/policy-language/)
- [OPA REST API Reference](https://www.openpolicyagent.org/docs/latest/rest-api/)
- [Banking Authorization Best Practices](https://www.openpolicyagent.org/docs/latest/guides/)

---

## License

Copyright © 2024 AnyBank. All rights reserved.
