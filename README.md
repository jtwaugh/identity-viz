# Unified Identity Multi-Context Banking Platform

A demonstration platform showcasing **multi-tenant identity management with organization switching and fine-grained access control** for banking applications.

## Overview

This project demonstrates a "Smart Office Building" identity architecture where:

- **One Smart Badge**: Users authenticate once with a single set of credentials
- **Multiple Floors**: Users can switch between different contexts (Personal Banking, Commercial Banking, etc.) without re-authenticating
- **Smart Locks**: Fine-grained access control determines permissions based on role, context, and real-time risk scoring

## Technology Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| Identity Provider | Keycloak (Docker) | Authentication & Token Exchange (RFC 8693) |
| Policy Engine | Open Policy Agent (Docker) | Fine-Grained Access Control (FGAC) |
| Backend API | Java 21 + Spring Boot 3.x | Core Banking Logic & Risk Engine |
| Frontend | Vanilla JS + ShadCN | User Interface & Context Switching |
| Database | PostgreSQL 15 | User, Tenant & Account Data |
| Orchestration | Docker Compose | Local Development Environment |

## Quick Start

### Prerequisites

- Docker Desktop (v4.0+) with Docker Compose
- Git
- 8GB RAM minimum (Keycloak requires significant memory)
- Ports 3000, 8000, 8080, 8181, 5432 available

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/your-org/unified-identity-platform.git
cd unified-identity-platform

# 2. Copy environment template
cp .env.example .env

# 3. Start all services (first run takes 2-3 minutes)
docker-compose up --build

# 4. Wait for health checks to pass
docker-compose ps  # All services should show "healthy"

# 5. Open the demo application
open http://localhost:3000
```

### Service URLs

Once all services are running:

| Service | URL | Purpose |
|---------|-----|---------|
| **Frontend** | http://localhost:3000 | Demo Application |
| **Backend API** | http://localhost:8000 | Spring Boot API |
| **Swagger UI** | http://localhost:8000/swagger-ui.html | API Documentation |
| **Keycloak Admin** | http://localhost:8080/admin | Identity Management |
| **OPA** | http://localhost:8181 | Policy Engine Status |

**Keycloak Admin Credentials**: `admin` / `admin`

## Demo Credentials

The system is pre-seeded with test users:

| User | Email | Password | Available Contexts |
|------|-------|----------|-------------------|
| John Doe | jdoe@example.com | demo123 | Personal Banking, AnyBusiness Inc. |
| Jane Smith | jsmith@example.com | demo123 | Personal Banking |
| Admin User | admin@anybank.com | admin123 | All tenants (ADMIN role) |

## Demo User Flow

### Step 1: Login
1. Navigate to http://localhost:3000
2. Click "Sign In with AnyBank ID"
3. Enter credentials: `jdoe@example.com` / `demo123`
4. Keycloak handles authentication and returns identity token

### Step 2: Organization Selection
- After login, you'll see available organizations:
  - **AnyBusiness Inc.** (Commercial - Owner role)
  - **John Doe** (Personal Banking - Owner role)
- Select an organization to switch into that context

### Step 3: Commercial Dashboard
- View business accounts (Operating, Payroll, Reserve)
- Large balances (e.g., $5,400,000 in Operating account)
- Commercial-specific actions (Wire Transfer, ACH Batch, Payroll)
- Authorized Users panel showing team members

### Step 4: Context Switch
- Click the context switcher in the header
- Select "John Doe (Personal)"
- System performs token exchange (RFC 8693)
- Dashboard updates to show personal accounts
- UI theme changes from purple to blue
- Different quick actions (Transfer Money, Pay Bills, Mobile Deposit)

## Architecture

### Core Concepts

#### Token Exchange (RFC 8693)
The system uses OAuth 2.0 Token Exchange to enable context switching without re-authentication:

1. User authenticates with Keycloak → receives **Identity Token**
2. User selects an organization → backend exchanges Identity Token for **Access Token** scoped to that tenant
3. Access Token contains `tenant_id` and `role` claims
4. User can switch contexts by requesting new Access Tokens

#### Fine-Grained Access Control (FGAC)
Every protected action is evaluated by Open Policy Agent (OPA):

```json
{
  "user": { "id": "...", "email": "..." },
  "tenant": { "id": "...", "type": "COMMERCIAL" },
  "action": "wire_transfer",
  "context": {
    "risk_score": 10,
    "channel": "WEB",
    "is_new_device": false
  }
}
```

OPA policies determine if the action is allowed based on:
- User's role in the tenant
- Tenant type
- Real-time risk score
- Action sensitivity level

#### Risk Scoring
The backend calculates risk scores (0-100) based on:

| Factor | Weight | Description |
|--------|--------|-------------|
| New Device | +30 | Device fingerprint not seen before |
| Unusual Location | +25 | IP geolocation differs from normal |
| Off Hours | +15 | Access outside 6 AM - 10 PM |
| High Velocity | +20 | Many requests in short time |
| Failed Auth | +10 per | Recent failed login attempts |
| VPN/Proxy | +15 | Connection through anonymizer |

### Project Structure

```
unified-identity-platform/
├── backend/                    # Spring Boot API
│   ├── src/
│   │   ├── main/java/com/anybank/identity/
│   │   │   ├── controller/    # REST endpoints
│   │   │   ├── service/       # Business logic
│   │   │   ├── repository/    # Data access
│   │   │   ├── entity/        # JPA entities
│   │   │   ├── dto/           # Request/response objects
│   │   │   ├── security/      # Security filters
│   │   │   └── config/        # Spring configuration
│   │   └── resources/
│   │       ├── application.yml
│   │       └── db/migration/  # Flyway migrations
│   ├── Dockerfile
│   └── pom.xml
├── frontend/                   # Vanilla JS + ShadCN
│   ├── index.html
│   ├── js/
│   │   ├── auth.js            # OIDC client
│   │   ├── api.js             # HTTP client
│   │   ├── state.js           # State management
│   │   ├── router.js          # Client-side routing
│   │   └── components/        # UI components
│   ├── css/
│   └── nginx.conf
├── keycloak/                   # Identity provider config
│   └── realm-export.json      # Pre-configured realm
├── opa/                        # Policy engine
│   ├── policy.rego            # Authorization rules
│   └── policy_test.rego       # Policy tests
├── seed/                       # Database seed data
│   └── demo-data.sql          # Test users & accounts
├── scripts/                    # Helper scripts
│   ├── init-db.sh             # Multi-database setup
│   └── wait-for-it.sh         # Service dependency wait
├── docker-compose.yml          # Service orchestration
├── .env.example                # Environment template
└── README.md                   # This file
```

## Development Workflow

### Starting Services

```bash
# Start all services
docker-compose up

# Start with rebuild
docker-compose up --build

# Start in detached mode
docker-compose up -d

# View logs
docker-compose logs -f backend
docker-compose logs -f keycloak
```

### Stopping Services

```bash
# Stop all services
docker-compose down

# Stop and remove volumes (fresh start)
docker-compose down -v
```

### Backend Development

```bash
# Run backend locally (outside Docker)
cd backend
./mvnw spring-boot:run

# Run tests
./mvnw test

# Run integration tests
./mvnw verify

# Check Spring Boot health
curl http://localhost:8000/actuator/health
```

### Frontend Development

The frontend is served by nginx from the `frontend/` directory. Any changes to files are immediately reflected (refresh browser).

For local development with hot reload:
```bash
cd frontend
# Use your preferred static server, e.g.:
python -m http.server 3000
```

### Database Access

```bash
# Connect to PostgreSQL
docker exec -it anybank-postgres psql -U bank -d anybank

# View users and tenants
SELECT u.email, t.name, m.role
FROM memberships m
JOIN users u ON m.user_id = u.id
JOIN tenants t ON m.tenant_id = t.id;

# Check account balances
SELECT t.name, a.name, a.balance
FROM accounts a
JOIN tenants t ON a.tenant_id = t.id;
```

### OPA Policy Testing

```bash
# List loaded policies
curl http://localhost:8181/v1/policies

# Test a policy decision
curl -X POST http://localhost:8181/v1/data/bank/authz/allow \
  -H "Content-Type: application/json" \
  -d '{
    "input": {
      "user": {"id": "user-001", "email": "jdoe@example.com"},
      "tenant": {"id": "tenant-003", "type": "COMMERCIAL"},
      "action": "wire_transfer",
      "context": {"risk_score": 5}
    }
  }'

# Run policy tests
docker exec -it anybank-opa opa test /policies -v
```

## Testing Scenarios

### Scenario 1: Happy Path Login
1. Navigate to http://localhost:3000
2. Click "Sign In"
3. Enter `jdoe@example.com` / `demo123`
4. Select "Personal Banking"
5. Verify dashboard loads with consumer accounts

### Scenario 2: Context Switch
1. Complete Scenario 1
2. Click context indicator in header
3. Select "AnyBusiness Inc."
4. Verify token exchange occurs (check Network tab)
5. Verify dashboard updates to commercial view

### Scenario 3: Risk-Based Access Denial
1. Complete Scenario 1
2. Navigate to Transfers
3. Initiate large transfer ($50,000+)
4. Modify request headers to trigger high risk score
5. Verify 403 response with "High Risk" message

### Scenario 4: Policy Hot-Reload
1. With services running, edit `opa/policy.rego`
2. Change wire transfer risk threshold from `< 10` to `< 50`
3. Save file (OPA auto-reloads)
4. Retry transfer that previously failed
5. Verify it now succeeds

## Troubleshooting

### Services Won't Start

```bash
# Check if ports are in use
lsof -i :3000
lsof -i :8000
lsof -i :8080
lsof -i :8181
lsof -i :5432

# Remove old containers and volumes
docker-compose down -v
docker system prune -a

# Rebuild from scratch
docker-compose up --build --force-recreate
```

### Keycloak Not Ready

Keycloak takes 60-90 seconds to start on first run. Check logs:

```bash
docker-compose logs keycloak | grep "started in"
```

Wait for: `Keycloak 23.0 started in XXXms`

### Backend Can't Connect to Database

```bash
# Verify PostgreSQL is healthy
docker-compose ps postgres

# Check database logs
docker-compose logs postgres

# Verify database exists
docker exec -it anybank-postgres psql -U bank -l
```

### Token Exchange Fails

```bash
# Verify Keycloak token exchange is enabled
docker-compose logs keycloak | grep "token-exchange"

# Check backend logs for detailed error
docker-compose logs backend | grep -i "token"

# Verify client secret matches
docker exec -it anybank-keycloak cat /opt/keycloak/data/import/realm-export.json | grep clientSecret
```

## Production Considerations

### Security Checklist

Before deploying to production:

- [ ] Change all default passwords
- [ ] Generate secure JWT secret (256-bit minimum)
- [ ] Update Keycloak client secrets
- [ ] Enable HTTPS/TLS for all services
- [ ] Configure proper CORS origins
- [ ] Set up proper secrets management (Vault, AWS Secrets Manager)
- [ ] Enable database connection pooling
- [ ] Configure Redis for session storage
- [ ] Set up structured logging to centralized system
- [ ] Enable monitoring and alerting
- [ ] Configure rate limiting at API gateway
- [ ] Enable WAF rules
- [ ] Complete security audit
- [ ] Set up backup and disaster recovery
- [ ] Review and harden OPA policies

### Scaling Considerations

- **Backend**: Stateless, scale horizontally behind load balancer
- **Keycloak**: Cluster mode with shared database and Infinispan cache
- **OPA**: Deploy as sidecar or centralized cluster with bundle API
- **Database**: Read replicas for query scaling, connection pooling
- **Frontend**: Serve from CDN with edge caching

### Compliance Notes

For banking applications:

- All PII must be encrypted at rest and in transit
- Audit logs must be immutable and retained per regulations
- Session timeouts comply with banking standards (15 min idle)
- MFA enforced for sensitive operations
- IP allowlisting for administrative access
- Regular penetration testing and vulnerability scanning

## License

[Your License Here]

## Support

For questions or issues:
- Open an issue on GitHub
- Contact: [Your Contact Info]

## Acknowledgments

- Built with [Spring Boot](https://spring.io/projects/spring-boot)
- Authentication by [Keycloak](https://www.keycloak.org/)
- Authorization by [Open Policy Agent](https://www.openpolicyagent.org/)
- UI components by [ShadCN](https://ui.shadcn.com/)
