# Unified Identity Multi-Context Banking Platform

## Build Specification (No Code)

This document fully specifies how to build a **multi-tenant identity platform with organization switching and fine-grained access control** for a regional bank. The implementation uses **Java with Spring Boot** for the backend, **Vanilla JavaScript** for the frontend, and **ShadCN** for UI components.

---

## Purpose & Usage

> **This project is designed to be cloned from a public GitHub repository and run on a local machine for demonstration purposes.**

The prototype validates the architecture concepts before committing to a full enterprise implementation. By running locally with Docker Compose, stakeholders can:

- Experience the complete user journey from login through context switching
- Demonstrate fine-grained access control and real-time risk evaluation
- Test policy changes without code deployments
- Validate the token exchange (RFC 8693) flow

### Quick Start (After Implementation)

```bash
# Clone the repository
git clone https://github.com/your-org/unified-identity-platform.git
cd unified-identity-platform

# Start all services
docker-compose up --build

# Access the demo
open http://localhost:3000
```

### Demo Credentials (Pre-seeded)

| User | Email | Password | Available Tenants |
|------|-------|----------|-------------------|
| John Doe | jdoe@example.com | demo123 | Personal Banking, AnyBusiness Inc. |
| Jane Smith | jsmith@example.com | demo123 | Personal Banking |
| Admin User | admin@anybank.com | admin123 | All tenants (ADMIN role) |

---

## Parallel Agent Development Plan

This project is designed to be built by **multiple AI coding agents working in parallel**. The architecture naturally decomposes into independent workstreams with well-defined interfaces and contracts.

### Agent Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           ORCHESTRATOR AGENT                                     │
│         (Coordinates, resolves conflicts, manages integration)                   │
└─────────────────────────────────────────────────────────────────────────────────┘
                                      │
        ┌─────────────────────────────┼─────────────────────────────┐
        │                             │                             │
        ▼                             ▼                             ▼
┌───────────────┐           ┌───────────────┐           ┌───────────────┐
│   AGENT 1     │           │   AGENT 2     │           │   AGENT 3     │
│  BACKEND API  │           │   FRONTEND    │           │ INFRASTRUCTURE│
│  (Java/Spring)│           │ (Vanilla JS)  │           │   (Docker)    │
└───────────────┘           └───────────────┘           └───────────────┘
        │                             │                             │
        ▼                             ▼                             ▼
┌───────────────┐           ┌───────────────┐           ┌───────────────┐
│   AGENT 1A    │           │   AGENT 2A    │           │   AGENT 3A    │
│   Auth/Token  │           │   Auth Flow   │           │   Keycloak    │
│   Services    │           │   Screens     │           │   Config      │
└───────────────┘           └───────────────┘           └───────────────┘
        │                             │                             │
        ▼                             ▼                             ▼
┌───────────────┐           ┌───────────────┐           ┌───────────────┐
│   AGENT 1B    │           │   AGENT 2B    │           │   AGENT 3B    │
│   Account &   │           │   Dashboard   │           │   OPA Policy  │
│   Tenant APIs │           │   Components  │           │   Rules       │
└───────────────┘           └───────────────┘           └───────────────┘
```

### Agent Definitions

---

#### AGENT 1: Backend API (Java/Spring Boot)

**Scope**: All server-side business logic, database access, and API endpoints

**Outputs**:
- Complete Spring Boot application
- JPA entities matching data model
- REST controllers for all endpoints
- Service layer with business logic
- Repository interfaces
- OpenAPI/Swagger documentation

**Dependencies**: None (can start immediately)

**Interface Contract**: Produces OpenAPI spec that Agent 2 consumes

##### Sub-Agent 1A: Authentication & Token Services

**Scope**: Auth endpoints and token exchange logic

**Tasks**:
1. Create `AuthController` with `/auth/login`, `/auth/callback`, `/auth/logout`, `/auth/me` endpoints
2. Implement `AuthService` for Keycloak integration
3. Build `TokenExchangeService` implementing RFC 8693 token exchange
4. Create `SecurityConfig` with JWT validation using Spring Security OAuth2 Resource Server
5. Implement custom `JwtAuthenticationConverter` to extract tenant claims
6. Write unit tests for token validation and exchange logic

**Outputs**:
- `AuthController.java`
- `AuthService.java`
- `TokenExchangeService.java`
- `SecurityConfig.java`
- `JwtAuthenticationConverter.java`
- Test classes for above

**Estimated Effort**: Medium

---

##### Sub-Agent 1B: Tenant & Account APIs

**Scope**: Core business domain endpoints

**Tasks**:
1. Create JPA entities: `User`, `Tenant`, `Membership`, `Account`, `AuditLog`
2. Create Spring Data repositories for each entity
3. Implement `TenantController` with CRUD and switching endpoints
4. Implement `AccountController` with balance and transaction endpoints
5. Implement `AdminController` for user management within tenants
6. Create `TenantService`, `AccountService` with business logic
7. Write Flyway migrations for database schema
8. Write integration tests using Testcontainers

**Outputs**:
- All entity classes in `entity/` package
- All repository interfaces in `repository/` package
- Controllers and services for tenant/account domains
- `V1__initial_schema.sql` and subsequent migrations
- Integration test classes

**Estimated Effort**: Large

---

##### Sub-Agent 1C: Security Filters & Policy Integration

**Scope**: Request filtering, OPA integration, risk scoring

**Tasks**:
1. Implement `TenantContextFilter` to extract and validate tenant from JWT
2. Implement `RiskEvaluationFilter` with risk scoring algorithm
3. Implement `PolicyEnforcementFilter` that calls OPA for authorization
4. Create `PolicyService` as OPA client using RestTemplate/WebClient
5. Implement `AuditLoggingFilter` with async event publishing
6. Create `RiskService` with configurable risk factor weights
7. Write unit tests for each filter
8. Write integration tests for OPA policy evaluation

**Outputs**:
- All filter classes in `security/` package
- `PolicyService.java`
- `RiskService.java`
- `OpaClient.java`
- Test classes with mocked OPA responses

**Estimated Effort**: Medium

---

##### Sub-Agent 1D: Exception Handling & DTOs

**Scope**: Request/response objects and error handling

**Tasks**:
1. Create all DTO classes for API requests and responses
2. Implement `GlobalExceptionHandler` with `@ControllerAdvice`
3. Create custom exceptions: `TenantAccessDeniedException`, `TokenExchangeException`, `PolicyDeniedException`
4. Configure MapStruct mappers for Entity ↔ DTO conversion
5. Add validation annotations to DTOs
6. Configure Jackson for consistent JSON serialization

**Outputs**:
- All DTO classes in `dto/` package
- Exception classes in `exception/` package
- MapStruct mapper interfaces
- `GlobalExceptionHandler.java`

**Estimated Effort**: Small

---

#### AGENT 2: Frontend (Vanilla JavaScript + ShadCN)

**Scope**: Complete browser-based user interface

**Outputs**:
- Static HTML/JS/CSS application
- ShadCN component integration
- OIDC authentication flow
- All screens per specification

**Dependencies**: Requires API contract (OpenAPI spec) from Agent 1

**Interface Contract**: Consumes OpenAPI spec, produces static assets

##### Sub-Agent 2A: Authentication Flow & Core Infrastructure

**Scope**: Auth screens and shared infrastructure

**Tasks**:
1. Set up project structure with module bundling (Vite or esbuild)
2. Configure Tailwind CSS and ShadCN component library
3. Implement `auth.js` module with oidc-client-ts integration
4. Implement `api.js` module as centralized HTTP client
5. Implement `state.js` module for application state management
6. Implement `router.js` for hash-based client-side routing
7. Build Login screen (`login.js`)
8. Build OAuth callback handler (`callback.js`)
9. Build Organization Selector screen (`tenant-selector.js`)

**Outputs**:
- `index.html` entry point
- `js/auth.js`, `js/api.js`, `js/state.js`, `js/router.js`
- `js/components/login.js`
- `js/components/tenant-selector.js`
- Tailwind configuration

**Estimated Effort**: Medium

---

##### Sub-Agent 2B: Dashboard & Account Components

**Scope**: Main application screens after authentication

**Tasks**:
1. Build shared `header.js` component with context switcher dropdown
2. Build Consumer Dashboard variant (`dashboard-consumer.js`)
3. Build Commercial Dashboard variant (`dashboard-commercial.js`)
4. Build Account List component (`accounts.js`)
5. Build Account Details component with tabs (`account-details.js`)
6. Build Organization Switcher modal (`org-switcher.js`)
7. Implement context-aware theming (color scheme per tenant type)

**Outputs**:
- `js/components/header.js`
- `js/components/dashboard.js` (with variants)
- `js/components/accounts.js`
- `js/components/account-details.js`
- `js/components/org-switcher.js`
- `css/themes.css`

**Estimated Effort**: Large

---

##### Sub-Agent 2C: Transfer & Admin Screens

**Scope**: Transactional and administrative interfaces

**Tasks**:
1. Build Transfer Money multi-step form (`transfers.js`)
2. Build step-up authentication modal for high-risk actions
3. Build Admin User Management screen (`admin-users.js`)
4. Build Settings screen (`settings.js`)
5. Implement toast notifications for success/error feedback
6. Build 403 Forbidden and 404 Not Found error pages

**Outputs**:
- `js/components/transfers.js`
- `js/components/step-up-auth.js`
- `js/components/admin-users.js`
- `js/components/settings.js`
- `js/components/error-pages.js`
- Toast notification integration

**Estimated Effort**: Medium

---

#### AGENT 3: Infrastructure & Configuration

**Scope**: Docker, Keycloak, OPA, database setup

**Outputs**:
- Docker Compose configuration
- Keycloak realm export
- OPA policy files
- Database seed data
- CI/CD pipeline definition

**Dependencies**: None (can start immediately)

**Interface Contract**: Produces running infrastructure that other agents deploy to

##### Sub-Agent 3A: Keycloak Configuration

**Scope**: Identity provider setup

**Tasks**:
1. Create Keycloak realm configuration (`anybank`)
2. Configure `anybank-web` client (public, PKCE)
3. Configure `anybank-api` client (confidential, token exchange)
4. Enable token exchange feature and configure permissions
5. Create custom protocol mapper for `tenant_id` claim injection
6. Create test users matching seed data requirements
7. Export realm to JSON for reproducible setup
8. Write documentation for manual Keycloak setup (fallback)

**Outputs**:
- `keycloak/realm-export.json`
- `keycloak/README.md` with manual setup instructions
- Test user credentials documented

**Estimated Effort**: Medium

---

##### Sub-Agent 3B: OPA Policy Rules

**Scope**: Authorization policy definitions

**Tasks**:
1. Write base policy structure in Rego
2. Implement `view_balance` policy rule
3. Implement `view_transactions` policy rule
4. Implement `internal_transfer` policy rule with risk check
5. Implement `external_transfer` policy rule with amount limits
6. Implement `wire_transfer` policy rule with strict risk threshold
7. Implement `manage_users` policy rule for admin actions
8. Write policy unit tests using OPA test framework
9. Document policy decision matrix

**Outputs**:
- `opa/policy.rego`
- `opa/policy_test.rego`
- `opa/README.md` with policy documentation

**Estimated Effort**: Medium

---

##### Sub-Agent 3C: Docker & Database Setup

**Scope**: Container orchestration and data seeding

**Tasks**:
1. Write `docker-compose.yml` with all services
2. Write `Dockerfile` for Spring Boot backend
3. Write nginx configuration for frontend static serving
4. Create Flyway migration baseline (coordinate with Agent 1B)
5. Create `seed/demo-data.sql` with test users, tenants, accounts
6. Configure health checks for all services
7. Write `scripts/wait-for-it.sh` for service dependency ordering
8. Create `.env.example` template
9. Write `README.md` with setup instructions

**Outputs**:
- `docker-compose.yml`
- `backend/Dockerfile`
- `frontend/nginx.conf`
- `seed/demo-data.sql`
- `scripts/` helper scripts
- `.env.example`
- Root `README.md`

**Estimated Effort**: Medium

---

### Dependency Graph & Execution Order

```
Phase 1 (Parallel Start):
├── Agent 1D: DTOs & Exceptions (no dependencies)
├── Agent 3A: Keycloak Config (no dependencies)
├── Agent 3B: OPA Policies (no dependencies)
└── Agent 3C: Docker Setup (no dependencies)

Phase 2 (After Phase 1):
├── Agent 1A: Auth Services (needs 1D for DTOs)
├── Agent 1B: Tenant/Account APIs (needs 1D for DTOs)
├── Agent 1C: Security Filters (needs 1D for DTOs)
└── Agent 2A: Frontend Auth (needs 3A for Keycloak config)

Phase 3 (After Phase 2):
├── Agent 2B: Dashboard Components (needs 2A infrastructure, 1B API contract)
└── Agent 2C: Transfer & Admin (needs 2A infrastructure, 1B API contract)

Phase 4 (Integration):
└── Orchestrator: Integration testing, conflict resolution, final assembly
```

### Interface Contracts Between Agents

| Producer | Consumer | Contract |
|----------|----------|----------|
| Agent 1 (all) | Agent 2 (all) | OpenAPI 3.0 specification (`openapi.yaml`) |
| Agent 1B | Agent 3C | Entity definitions for Flyway migrations |
| Agent 3A | Agent 1A | Keycloak realm name, client IDs, endpoints |
| Agent 3A | Agent 2A | OIDC discovery URL, client ID |
| Agent 3B | Agent 1C | OPA policy package name, input schema |
| Agent 3C | All | Docker service names, ports, network |

### Shared Resources (Git Repository Structure)

```
unified-identity-platform/
├── backend/                    # Agent 1 workspace
│   ├── src/main/java/
│   ├── src/test/java/
│   ├── pom.xml
│   └── Dockerfile
├── frontend/                   # Agent 2 workspace
│   ├── index.html
│   ├── js/
│   ├── css/
│   └── nginx.conf
├── keycloak/                   # Agent 3A workspace
│   └── realm-export.json
├── opa/                        # Agent 3B workspace
│   ├── policy.rego
│   └── policy_test.rego
├── seed/                       # Agent 3C workspace
│   └── demo-data.sql
├── scripts/                    # Agent 3C workspace
├── docker-compose.yml          # Agent 3C
├── .env.example                # Agent 3C
├── openapi.yaml                # Agent 1 produces, Agent 2 consumes
└── README.md                   # Agent 3C
```

### Conflict Resolution Protocol

When agents produce conflicting outputs:

1. **API Contract Conflicts**: Agent 1's OpenAPI spec is authoritative; Agent 2 adapts
2. **Database Schema Conflicts**: Agent 1B's entity definitions are authoritative; Agent 3C adapts seed data
3. **Configuration Conflicts**: Agent 3C's Docker/env configuration is authoritative; other agents adapt
4. **Naming Conflicts**: Follow Java conventions for backend, JavaScript conventions for frontend

### Integration Checkpoints

| Checkpoint | Validation Criteria |
|------------|---------------------|
| CP1: Infrastructure Ready | `docker-compose up` starts all containers, health checks pass |
| CP2: Auth Flow Complete | Login → Keycloak → Callback → Token received |
| CP3: API Functional | All endpoints return expected responses per OpenAPI spec |
| CP4: Frontend Connected | Frontend successfully calls all API endpoints |
| CP5: Policy Enforced | OPA denies unauthorized requests, allows authorized ones |
| CP6: Demo Ready | Complete user flow (Steps 1-4) works end-to-end |

---

## 1. System Overview

### 1.1 Core Concept

Build a "Smart Office Building" identity system where:

- **One Smart Badge**: A customer has ONE set of credentials for the entire bank
- **Multiple Floors**: The customer can "switch" between contexts (Consumer, Business, Trust) without re-authenticating
- **Smart Locks**: Fine-grained access control determines what actions are permitted based on role, context, and real-time risk scoring

### 1.2 Architecture Components

| Component | Technology | Purpose |
|-----------|------------|---------|
| Identity Provider (IdP) | Keycloak (Docker) | Authentication, Token Exchange (RFC 8693) |
| Policy Engine | Open Policy Agent (Docker) | Fine-Grained Access Control (FGAC) |
| Backend API | Java 21 + Spring Boot 3.x | Core Banking Logic, Risk Engine, Token Validation |
| Frontend | Vanilla JS + ShadCN | User Interface, Context Switching UI |
| Database | PostgreSQL | User-Tenant Memberships, Account Data |
| Orchestration | Docker Compose | Local development environment |

---

## 2. Data Model

### 2.1 Core Tables

#### Users Table
Stores the identity (authentication concern only).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Internal user identifier |
| external_id | VARCHAR(255) | UNIQUE, NOT NULL | Keycloak subject ID |
| email | VARCHAR(255) | UNIQUE, NOT NULL | User's email address |
| display_name | VARCHAR(255) | NOT NULL | Full name for display |
| mfa_enabled | BOOLEAN | DEFAULT false | Whether MFA is active |
| created_at | TIMESTAMP | DEFAULT NOW() | Account creation time |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last modification time |

#### Tenants Table
Stores organizations/accounts (the contexts).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Internal tenant identifier |
| external_id | VARCHAR(255) | UNIQUE, NOT NULL | External reference ID |
| name | VARCHAR(255) | NOT NULL | Display name (e.g., "Doe Consulting LLC") |
| type | ENUM | NOT NULL | One of: CONSUMER, SMALL_BUSINESS, COMMERCIAL, INVESTMENT, TRUST |
| status | ENUM | DEFAULT 'ACTIVE' | One of: ACTIVE, SUSPENDED, CLOSED |
| metadata | JSONB | NULLABLE | Additional tenant-specific data |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation timestamp |

#### Memberships Table (The Pivot)
Links users to tenants with roles.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Membership identifier |
| user_id | UUID | FK → users.id | The user |
| tenant_id | UUID | FK → tenants.id | The tenant/organization |
| role | ENUM | NOT NULL | One of: OWNER, ADMIN, OPERATOR, VIEWER |
| status | ENUM | DEFAULT 'ACTIVE' | One of: INVITED, ACTIVE, SUSPENDED, REVOKED |
| invited_at | TIMESTAMP | NULLABLE | When invitation was sent |
| accepted_at | TIMESTAMP | NULLABLE | When user accepted |
| created_at | TIMESTAMP | DEFAULT NOW() | Record creation |

**Unique Constraint**: (user_id, tenant_id) — a user can only have one membership per tenant.

#### Accounts Table
Stores actual financial accounts within tenants.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Account identifier |
| tenant_id | UUID | FK → tenants.id | Owning tenant |
| account_number | VARCHAR(20) | UNIQUE | Masked account number |
| account_type | ENUM | NOT NULL | CHECKING, SAVINGS, MONEY_MARKET, CD, LOAN, CREDIT_LINE |
| name | VARCHAR(255) | NOT NULL | Account nickname |
| balance | DECIMAL(15,2) | DEFAULT 0 | Current balance |
| currency | VARCHAR(3) | DEFAULT 'USD' | Currency code |
| status | ENUM | DEFAULT 'ACTIVE' | ACTIVE, FROZEN, CLOSED |

#### Audit Log Table
Tracks all actions for compliance.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Log entry ID |
| user_id | UUID | FK → users.id | Acting user |
| tenant_id | UUID | FK → tenants.id | Context tenant |
| action | VARCHAR(100) | NOT NULL | Action performed |
| resource_type | VARCHAR(50) | NOT NULL | Type of resource accessed |
| resource_id | UUID | NULLABLE | Specific resource ID |
| outcome | ENUM | NOT NULL | SUCCESS, DENIED, ERROR |
| risk_score | INTEGER | NULLABLE | Risk score at time of action |
| ip_address | INET | NULLABLE | Client IP |
| user_agent | TEXT | NULLABLE | Client user agent |
| metadata | JSONB | NULLABLE | Additional context |
| created_at | TIMESTAMP | DEFAULT NOW() | When action occurred |

---

## 3. API Specification

### 3.1 Java Backend Structure

Use **Spring Boot 3.x** with the following dependencies (Maven or Gradle):

**Core Dependencies**:
- `spring-boot-starter-web` — REST API framework
- `spring-boot-starter-data-jpa` — Database access with Hibernate
- `spring-boot-starter-security` — Security framework
- `spring-boot-starter-oauth2-resource-server` — JWT validation
- `spring-boot-starter-validation` — Request validation

**Additional Dependencies**:
- `spring-boot-starter-actuator` — Health checks and metrics
- `postgresql` — PostgreSQL JDBC driver
- `lombok` — Boilerplate reduction
- `mapstruct` — DTO mapping
- `springdoc-openapi-starter-webmvc-ui` — Swagger/OpenAPI documentation
- `java-jwt` or `nimbus-jose-jwt` — JWT parsing utilities
- `okhttp` or `spring-boot-starter-webflux` — HTTP client for OPA calls

**Project Structure**:
```
backend/
├── src/main/java/com/anybank/identity/
│   ├── IdentityApplication.java
│   ├── config/
│   │   ├── SecurityConfig.java
│   │   ├── OpaConfig.java
│   │   └── WebConfig.java
│   ├── controller/
│   │   ├── AuthController.java
│   │   ├── TenantController.java
│   │   ├── AccountController.java
│   │   └── AdminController.java
│   ├── service/
│   │   ├── AuthService.java
│   │   ├── TenantService.java
│   │   ├── AccountService.java
│   │   ├── RiskService.java
│   │   └── PolicyService.java
│   ├── repository/
│   │   ├── UserRepository.java
│   │   ├── TenantRepository.java
│   │   ├── MembershipRepository.java
│   │   └── AccountRepository.java
│   ├── entity/
│   │   ├── User.java
│   │   ├── Tenant.java
│   │   ├── Membership.java
│   │   └── Account.java
│   ├── dto/
│   │   ├── TokenExchangeRequest.java
│   │   ├── TokenExchangeResponse.java
│   │   └── ...
│   ├── security/
│   │   ├── TenantContextFilter.java
│   │   ├── RiskEvaluationFilter.java
│   │   └── AuditLoggingFilter.java
│   └── exception/
│       ├── GlobalExceptionHandler.java
│       └── ...
├── src/main/resources/
│   ├── application.yml
│   ├── application-local.yml
│   └── db/migration/ (Flyway migrations)
└── pom.xml (or build.gradle)

### 3.2 API Endpoints

#### Authentication Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/auth/login` | Redirect to Keycloak login |
| GET | `/auth/callback` | Handle Keycloak OAuth callback |
| POST | `/auth/token/exchange` | Exchange identity token for tenant-scoped access token |
| POST | `/auth/logout` | Invalidate session |
| GET | `/auth/me` | Get current user info and available tenants |

#### Tenant/Context Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/tenants` | List all tenants the user has access to |
| GET | `/api/tenants/{tenant_id}` | Get tenant details |
| POST | `/api/tenants/{tenant_id}/switch` | Switch active context (triggers token exchange) |

#### Account Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/accounts` | List accounts in current tenant context |
| GET | `/api/accounts/{account_id}` | Get account details |
| GET | `/api/accounts/{account_id}/transactions` | Get transaction history |
| POST | `/api/accounts/{account_id}/transfer` | Initiate transfer (requires policy check) |

#### Admin Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/users` | List users in tenant (ADMIN+ only) |
| POST | `/api/admin/users/invite` | Invite user to tenant |
| PATCH | `/api/admin/users/{user_id}/role` | Update user role |
| DELETE | `/api/admin/users/{user_id}` | Revoke user access |

### 3.3 Request/Response Structures

#### Token Exchange Request
```
POST /auth/token/exchange
Headers:
  Authorization: Bearer <identity_token>
  Content-Type: application/json

Body:
  target_tenant_id: UUID of tenant to switch to
```

#### Token Exchange Response
```
Status: 200 OK
Body:
  access_token: JWT scoped to the target tenant
  token_type: "Bearer"
  expires_in: 3600 (seconds)
  tenant: { id, name, type, role }
```

#### Tenant List Response
```
Status: 200 OK
Body:
  tenants: [
    {
      id: UUID,
      name: string,
      type: "CONSUMER" | "SMALL_BUSINESS" | "COMMERCIAL" | "INVESTMENT" | "TRUST",
      role: "OWNER" | "ADMIN" | "OPERATOR" | "VIEWER",
      status: "ACTIVE" | "SUSPENDED"
    }
  ]
```

#### Account Balance Response
```
Status: 200 OK
Body:
  account: {
    id: UUID,
    account_number: "****1234",
    name: string,
    type: string,
    balance: decimal,
    currency: "USD",
    status: "ACTIVE"
  }
```

### 3.4 Error Response Structure

All errors return a consistent format:
```
Status: 4xx or 5xx
Body:
  error: {
    code: string (e.g., "ACCESS_DENIED", "INVALID_TOKEN", "HIGH_RISK"),
    message: string (human-readable),
    details: object (optional additional context)
  }
```

---

## 4. Security & Authorization

### 4.1 JWT Token Structure

#### Identity Token (from Keycloak login)
Claims:
- `sub`: User's Keycloak subject ID
- `email`: User's email
- `name`: Display name
- `iat`: Issued at timestamp
- `exp`: Expiration timestamp

#### Access Token (after context switch)
Claims:
- `sub`: User's Keycloak subject ID
- `tenant_id`: Current tenant UUID
- `tenant_type`: Type of tenant (CONSUMER, BUSINESS, etc.)
- `role`: User's role in this tenant
- `permissions`: Array of allowed actions
- `iat`: Issued at timestamp
- `exp`: Expiration timestamp (shorter-lived, 1 hour max)

### 4.2 Policy Engine Integration (OPA)

#### Policy Input Structure

Every protected action sends this structure to OPA:

```
input: {
  user: {
    id: UUID,
    email: string
  },
  tenant: {
    id: UUID,
    type: string
  },
  action: string (e.g., "view_balance", "wire_transfer", "add_user"),
  resource: {
    type: string,
    id: UUID (optional)
  },
  context: {
    channel: "WEB" | "MOBILE" | "API" | "BRANCH" | "PHONE",
    ip_address: string,
    user_agent: string,
    risk_score: integer (0-100),
    time_of_day: string,
    is_new_device: boolean
  }
}
```

#### Policy Rules to Implement

Define these rules in Rego (OPA's policy language):

1. **Balance View**: Allow if user has any role in tenant
2. **Transaction History**: Allow if user has OPERATOR+ role
3. **Internal Transfer**: Allow if OPERATOR+ AND risk_score < 50
4. **External Transfer**: Allow if ADMIN+ AND risk_score < 30 AND amount < daily_limit
5. **Wire Transfer**: Allow if OWNER AND risk_score < 10 AND within_business_hours
6. **User Management**: Allow if ADMIN+ role
7. **Tenant Settings**: Allow if OWNER only

#### Risk Score Factors

The Spring Boot backend calculates risk_score (0-100) based on:

| Factor | Weight | Description |
|--------|--------|-------------|
| New Device | +30 | Device fingerprint not seen before |
| Unusual Location | +25 | IP geolocation differs from normal |
| Off Hours | +15 | Access outside 6 AM - 10 PM local time |
| High Velocity | +20 | Many requests in short time |
| Failed Auth Attempts | +10 per | Recent failed login attempts |
| VPN/Proxy Detected | +15 | Connection through anonymizer |

### 4.3 Spring Security Filter Chain

Every protected request passes through this filter chain (in order):

1. **RateLimitFilter**: Prevent abuse (100 req/min per user) — uses Bucket4j or Resilience4j
2. **JwtAuthenticationFilter**: Verify JWT signature and expiration (Spring OAuth2 Resource Server)
3. **TenantContextFilter**: Extract tenant_id from token claims, set in SecurityContext
4. **RiskEvaluationFilter**: Compute real-time risk score, attach to request attributes
5. **PolicyEnforcementFilter**: Query OPA for authorization decision, throw AccessDeniedException if denied
6. **AuditLoggingFilter**: Record action outcome via @Async event publishing

**Implementation Notes**:
- Use `OncePerRequestFilter` as base class for custom filters
- Register filters via `SecurityFilterChain` bean in `SecurityConfig`
- Use `@Order` annotation to control filter precedence
- Store tenant context in `SecurityContextHolder` for downstream access

---

## 5. Frontend Specification

### 5.1 Technology Stack

- **Vanilla JavaScript** (ES6+ modules, no framework)
- **ShadCN components** (via CDN or local build)
- **Tailwind CSS** (for styling)
- **oidc-client-ts** (for Keycloak OIDC integration)

### 5.2 Application Structure

```
frontend/
├── index.html              # Entry point
├── css/
│   └── styles.css          # Tailwind + custom styles
├── js/
│   ├── main.js             # Application entry
│   ├── auth.js             # Authentication module
│   ├── api.js              # API client module
│   ├── state.js            # Application state management
│   ├── router.js           # Client-side routing
│   └── components/
│       ├── login.js        # Login screen
│       ├── tenant-selector.js  # Organization picker
│       ├── dashboard.js    # Main dashboard
│       ├── accounts.js     # Account list/details
│       ├── transfers.js    # Transfer forms
│       └── header.js       # Navigation header
└── lib/
    └── shadcn/             # ShadCN component library
```

### 5.3 Screens to Build

#### Screen 1: Login Page

**URL**: `/login`

**Layout**:
- Centered card on gradient background
- Bank logo at top
- "Welcome to AnyBank" heading
- "Sign in to access your accounts" subheading
- Single "Sign In with AnyBank ID" button (ShadCN Button, primary variant)
- Footer with security badges and links

**Behavior**:
- Button click initiates Keycloak OIDC redirect
- After successful auth, redirect to tenant selector

**ShadCN Components**: Card, Button

---

#### Screen 2: Organization/Tenant Selector

**URL**: `/select-organization`

**Layout**:
- Header with bank logo and user avatar/name
- "Select an Organization" heading
- "Choose which account context you want to access" subheading
- Grid of tenant cards (2 columns on desktop, 1 on mobile)
- Each card shows:
  - Icon based on tenant type (briefcase for business, user for personal, etc.)
  - Tenant name (e.g., "Doe Consulting LLC")
  - Tenant type badge (e.g., "Commercial")
  - User's role badge (e.g., "Owner")
  - "Select" button
- Footer with "Sign Out" link

**Behavior**:
- Clicking a tenant card initiates token exchange
- Show loading spinner during exchange
- On success, redirect to dashboard for that tenant
- On failure (e.g., access revoked), show error toast

**ShadCN Components**: Card, Button, Badge, Avatar, Separator

---

#### Screen 3: Dashboard (Consumer Context)

**URL**: `/dashboard`

**Layout**:
- **Header**:
  - Bank logo (left)
  - Current context indicator with dropdown to switch (center-left)
  - Navigation links: Dashboard, Transfers, Statements (center)
  - User avatar with dropdown menu (right)
- **Context Banner**:
  - Blue banner for Consumer context
  - Shows: "Personal Banking • John Doe"
  - "Switch Organization" button
- **Main Content**:
  - "Good morning, John" greeting with date
  - "Your Accounts" section heading
  - Account cards in a grid:
    - Account name and masked number
    - Current balance (large)
    - Account type badge
    - "View Details" link
  - Quick Actions panel:
    - "Transfer Money" button
    - "Pay Bills" button
    - "Mobile Deposit" button
- **Sidebar** (optional):
  - Recent activity feed
  - Notifications

**ShadCN Components**: Card, Button, Badge, DropdownMenu, Avatar, Separator, Table

---

#### Screen 4: Dashboard (Commercial Context)

**URL**: `/dashboard`

**Layout**: Same structure as Consumer but with visual differentiation:
- **Context Banner**: Green banner for Commercial
- Shows: "Commercial Banking • Doe Consulting LLC"
- Different quick actions: "Payroll", "ACH Batch", "Wire Transfer"
- Additional section: "Authorized Users" panel showing team members with access
- Balance displays are larger/more prominent
- May show multiple account types (Operating, Payroll, Reserve)

**Behavior**:
- All API calls include the tenant_id from the current access token
- If token expires during session, prompt for re-authentication

---

#### Screen 5: Account Details

**URL**: `/accounts/{account_id}`

**Layout**:
- Breadcrumb: Dashboard > Accounts > [Account Name]
- Account header card:
  - Account name and full masked number
  - Current balance
  - Available balance
  - Account status badge
- Tab navigation: Transactions, Details, Statements
- **Transactions Tab**:
  - Filter controls (date range, type, amount)
  - Transaction table:
    - Date
    - Description
    - Category
    - Amount (color-coded: green for credits, red for debits)
    - Running balance
  - Pagination controls
- **Details Tab**:
  - Account information (type, opened date, interest rate if applicable)
  - Linked services
- **Statements Tab**:
  - List of downloadable statements by month

**ShadCN Components**: Card, Tabs, Table, Button, Badge, DatePicker, Select, Pagination

---

#### Screen 6: Transfer Money

**URL**: `/transfers/new`

**Layout**:
- Breadcrumb: Dashboard > Transfers > New Transfer
- Step indicator (1. Details, 2. Review, 3. Confirm)
- **Step 1 - Details**:
  - "From Account" dropdown (shows accounts in current tenant)
  - "To Account" - toggle between:
    - Internal (dropdown of other accounts)
    - External (bank routing + account number fields)
    - Beneficiary (saved recipients)
  - Amount input with currency
  - Frequency selector (One-time, Recurring)
  - Date picker for scheduled transfers
  - Memo field
  - "Continue" button
- **Step 2 - Review**:
  - Summary card showing all details
  - Fee disclosure (if applicable)
  - "Edit" and "Confirm" buttons
- **Step 3 - Confirm**:
  - May require step-up authentication (MFA prompt)
  - Success/failure message
  - Confirmation number
  - "Make Another Transfer" and "Back to Dashboard" buttons

**Behavior**:
- Before submitting, frontend calls backend which queries OPA
- If OPA denies (e.g., high risk), show appropriate error message
- If step-up required, show MFA challenge modal

**ShadCN Components**: Card, Button, Input, Select, DatePicker, RadioGroup, Alert, Dialog (for MFA)

---

#### Screen 7: Organization Switcher (Overlay/Modal)

**Trigger**: Click on context indicator in header

**Layout**:
- Modal overlay
- Current organization highlighted
- List of other available organizations
- Each shows: icon, name, type, role
- "Switch" button for each
- "Manage Organizations" link (if ADMIN)

**Behavior**:
- Selecting a different org triggers token exchange
- Show loading state during exchange
- On success, refresh entire page with new context
- On failure, keep current context and show error

**ShadCN Components**: Dialog, Card, Button, Badge, Avatar

---

### 5.4 State Management

Use a simple module pattern for state:

**Global State Object**:
```
state: {
  user: {
    id: string,
    email: string,
    name: string,
    avatarUrl: string
  },
  currentTenant: {
    id: string,
    name: string,
    type: string,
    role: string
  },
  availableTenants: [],
  tokens: {
    identity: string,
    access: string,
    expiresAt: timestamp
  },
  ui: {
    loading: boolean,
    error: string | null,
    sidebarOpen: boolean
  }
}
```

**State Operations**:
- `setState(path, value)` — Update nested state
- `getState(path)` — Retrieve state value
- `subscribe(path, callback)` — React to state changes
- `persistToStorage()` — Save critical state to sessionStorage
- `hydrateFromStorage()` — Restore state on page load

### 5.5 API Client Module

Create a centralized API client that:

1. Automatically attaches the current access token to all requests
2. Handles token refresh when approaching expiration
3. Parses error responses into consistent format
4. Provides typed methods for each endpoint
5. Implements request retry with exponential backoff

**Methods**:
- `api.get(path, params)` — GET request
- `api.post(path, body)` — POST request
- `api.patch(path, body)` — PATCH request
- `api.delete(path)` — DELETE request
- `api.setToken(token)` — Update authorization header
- `api.onUnauthorized(callback)` — Handle 401 responses

### 5.6 Authentication Flow

1. **Initial Load**: Check sessionStorage for existing tokens
2. **If no tokens**: Redirect to `/login`
3. **Login click**: Initialize OIDC client, redirect to Keycloak
4. **Keycloak callback**: Exchange auth code for identity token
5. **Fetch tenants**: Call `/api/tenants` to get available contexts
6. **If single tenant**: Auto-switch to that context
7. **If multiple tenants**: Show tenant selector
8. **Token exchange**: Call `/auth/token/exchange` with selected tenant
9. **Store tokens**: Save to state and sessionStorage
10. **Navigate**: Redirect to dashboard

### 5.7 Client-Side Routing

Implement hash-based routing (`#/path`) for simplicity:

**Routes**:
| Path | Component | Auth Required | Tenant Required |
|------|-----------|---------------|-----------------|
| `/login` | LoginScreen | No | No |
| `/callback` | OAuthCallback | No | No |
| `/select-organization` | TenantSelector | Yes | No |
| `/dashboard` | Dashboard | Yes | Yes |
| `/accounts` | AccountList | Yes | Yes |
| `/accounts/:id` | AccountDetails | Yes | Yes |
| `/transfers/new` | NewTransfer | Yes | Yes |
| `/settings` | Settings | Yes | Yes |
| `/admin/users` | UserManagement | Yes | Yes (ADMIN+) |

**Route Guards**:
- Before each navigation, check if route requires auth
- If auth required and no identity token, redirect to login
- If tenant required and no access token, redirect to tenant selector
- If role required and user lacks role, show 403 page

---

## 6. Demo User Flow (Prototype Walkthrough)

This section details the exact user journey that the prototype must demonstrate. These steps correspond directly to the visual mockups and validate all core architectural concepts.

### Flow Overview

```
┌─────────────┐     ┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│   Step 1    │     │       Step 2        │     │       Step 3        │     │       Step 4        │
│   LOGIN     │ ──► │  ORG SELECTION      │ ──► │ COMMERCIAL DASHBOARD│ ──► │ CONSUMER DASHBOARD  │
│             │     │                     │     │                     │     │  (after switch)     │
└─────────────┘     └─────────────────────┘     └─────────────────────┘     └─────────────────────┘
```

### Step 1: User Login

**Screen**: Clean, professional login page for "AnyBank"

**Visual Elements**:
- Centered card on subtle gradient background (light gray to white)
- AnyBank logo prominently displayed at top of card
- Heading: "Welcome to AnyBank"
- Subheading: "Sign in to access all your accounts"
- Single primary button: "Sign In with AnyBank ID"
- Footer: Security certification badges, privacy policy link

**User Action**: Click "Sign In with AnyBank ID"

**System Behavior**:
1. Frontend initiates OIDC authorization code flow with PKCE
2. Browser redirects to Keycloak login page
3. User enters credentials (jdoe@example.com / demo123)
4. Keycloak validates credentials and issues identity token
5. Browser redirects back to `/callback` with authorization code
6. Frontend exchanges code for identity token
7. Frontend calls `/auth/me` to fetch user info and available tenants
8. Frontend redirects to Organization Selection screen

**Technical Validation**: Verify identity token contains `sub`, `email`, and `name` claims

---

### Step 2: Organization Selection

**Screen**: Account/organization picker showing all contexts the user can access

**Visual Elements**:
- Header bar with AnyBank logo and user avatar showing "John Doe"
- Heading: "Select an Organization"
- Subheading: "Choose which account context you want to manage"
- Two tenant cards displayed in a grid:

  **Card 1 - Commercial**:
  - Icon: Briefcase (business icon)
  - Name: "AnyBusiness Inc."
  - Badge: "Commercial" (purple)
  - Role badge: "Owner"
  - "Select" button

  **Card 2 - Consumer**:
  - Icon: User (person icon)
  - Name: "John Doe"
  - Badge: "Personal" (blue)
  - Role badge: "Owner"
  - "Select" button

- Footer: "Sign Out" link

**User Action**: Click "Select" on "AnyBusiness Inc." card

**System Behavior**:
1. Frontend sends POST to `/auth/token/exchange` with:
   - Current identity token in Authorization header
   - `target_tenant_id` for AnyBusiness Inc.
2. Backend validates identity token
3. Backend checks Memberships table: Does user have access to this tenant?
4. Backend queries OPA: Is context switch allowed given current risk factors?
5. Backend issues new access token with `tenant_id` and `role` claims
6. Frontend stores new access token
7. Frontend redirects to `/dashboard`

**Technical Validation**:
- Network tab shows POST to `/auth/token/exchange`
- Response contains new JWT with `tenant_id` claim
- Old identity token is retained for future switches

---

### Step 3: Commercial Dashboard

**Screen**: Business banking dashboard with commercial-specific features

**Visual Elements**:
- **Header**:
  - AnyBank logo (left)
  - Context switcher showing "AnyBusiness Inc." with dropdown arrow (center-left)
  - Navigation: Dashboard, Transfers, Payroll, Reports (center)
  - User avatar with "JD" initials and dropdown (right)

- **Context Banner** (Purple/Commercial theme):
  - Full-width banner below header
  - Text: "Commercial Banking • AnyBusiness Inc."
  - "Switch Organization" button on right

- **Greeting Section**:
  - "Good morning, John"
  - Current date displayed

- **Accounts Section**:
  - Heading: "Business Accounts"
  - Account cards showing:

    **Operating Account**:
    - Account: "Business Operating ****4521"
    - Balance: "$5,400,000.00" (large, prominent)
    - Type badge: "Checking"
    - "View Details" link

    **Payroll Account**:
    - Account: "Payroll ****7832"
    - Balance: "$234,500.00"
    - Type badge: "Checking"
    - "View Details" link

    **Reserve Account**:
    - Account: "Business Reserve ****1199"
    - Balance: "$1,250,000.00"
    - Type badge: "Money Market"
    - "View Details" link

- **Quick Actions Panel**:
  - "Wire Transfer" button
  - "ACH Batch Payment" button
  - "Run Payroll" button

- **Authorized Users Panel** (Commercial-specific):
  - Shows team members with access to this business
  - Each row: Avatar, Name, Role badge, "Manage" link

**User Action**: Click context switcher dropdown, select "John Doe (Personal)"

**Technical Validation**:
- All API calls include `Authorization: Bearer <access_token>`
- Access token contains `tenant_id: "anybusiness-inc-uuid"`
- Accounts endpoint returns only accounts where `tenant_id` matches

---

### Step 4: Consumer Dashboard (After Context Switch)

**Screen**: Personal banking dashboard after switching from commercial context

**Visual Elements**:
- **Header**: Same structure, but context switcher now shows "John Doe"

- **Context Banner** (Blue/Consumer theme):
  - Full-width banner below header
  - Text: "Personal Banking • John Doe"
  - "Switch Organization" button on right

- **Greeting Section**:
  - Same greeting, same user

- **Accounts Section**:
  - Heading: "Your Accounts"
  - Account cards showing:

    **Personal Checking**:
    - Account: "Personal Checking ****1234"
    - Balance: "$4,521.33" (notably smaller than commercial)
    - Type badge: "Checking"
    - "View Details" link

    **Savings Account**:
    - Account: "Savings ****5678"
    - Balance: "$12,340.00"
    - Type badge: "Savings"
    - "View Details" link

- **Quick Actions Panel** (Consumer-specific):
  - "Transfer Money" button
  - "Pay Bills" button
  - "Mobile Deposit" button

- **No Authorized Users Panel** (Consumer accounts are individual)

**System Behavior During Switch**:
1. User clicks "John Doe (Personal)" in context switcher
2. Loading overlay appears: "Switching to Personal Banking..."
3. Frontend sends POST to `/auth/token/exchange` with personal tenant ID
4. Backend performs same validation flow as Step 2
5. New access token issued with personal `tenant_id`
6. Dashboard re-renders with consumer data
7. Color scheme transitions from purple to blue

**Technical Validation**:
- New access token has different `tenant_id`
- API calls now return personal accounts only
- No re-authentication required (identity token unchanged)
- Audit log records: "User [John Doe] switched context from [AnyBusiness Inc.] to [Personal]"

---

### Additional Demo Scenarios

#### Scenario A: Risk-Based Access Denial

**Purpose**: Demonstrate fine-grained access control with real-time risk evaluation

**Steps**:
1. From Commercial Dashboard, click "Wire Transfer"
2. Fill in transfer details: Amount = $100,000, Recipient = External
3. Open browser developer tools, modify request headers:
   - Add `User-Agent: HACKER-BOT`
4. Submit transfer request
5. **Expected Result**: 403 Forbidden with message "Access Denied: High Risk Score (90)"

**What This Proves**:
- Risk engine evaluates request context in real-time
- OPA policy denies high-risk wire transfers
- Decision is logged in audit trail

#### Scenario B: Role-Based Feature Visibility

**Purpose**: Demonstrate that UI adapts based on user's role in tenant

**Steps**:
1. Login as Jane Smith (jsmith@example.com)
2. Jane only has Personal Banking tenant (OWNER role)
3. Note: No "Admin" or "Manage Users" options visible
4. Login as Admin User (admin@anybank.com)
5. Admin sees all tenants with "Manage" options
6. Admin can access `/admin/users` to manage tenant memberships

**What This Proves**:
- UI components conditionally render based on role claims in JWT
- Backend enforces same restrictions (defense in depth)

#### Scenario C: Policy Hot-Reload

**Purpose**: Demonstrate decoupled policy management

**Steps**:
1. With demo running, edit `opa/policy.rego`
2. Change wire transfer risk threshold from `< 10` to `< 50`
3. Save file (OPA watches for changes)
4. Retry wire transfer that previously failed
5. **Expected Result**: Transfer now succeeds (risk score 10 < 50)

**What This Proves**:
- Policy changes take effect without restarting backend
- Authorization logic is externalized, not hardcoded

---

### Test Data Seed Requirements

The database must be pre-seeded with the following data for the demo to work:

#### Users
| ID | Email | Display Name |
|----|-------|--------------|
| user-001 | jdoe@example.com | John Doe |
| user-002 | jsmith@example.com | Jane Smith |
| user-003 | admin@anybank.com | Admin User |

#### Tenants
| ID | Name | Type |
|----|------|------|
| tenant-001 | John Doe | CONSUMER |
| tenant-002 | Jane Smith | CONSUMER |
| tenant-003 | AnyBusiness Inc. | COMMERCIAL |

#### Memberships
| User | Tenant | Role |
|------|--------|------|
| user-001 | tenant-001 | OWNER |
| user-001 | tenant-003 | OWNER |
| user-002 | tenant-002 | OWNER |
| user-003 | tenant-001 | ADMIN |
| user-003 | tenant-002 | ADMIN |
| user-003 | tenant-003 | ADMIN |

#### Accounts
| Tenant | Name | Type | Balance |
|--------|------|------|---------|
| tenant-001 | Personal Checking | CHECKING | $4,521.33 |
| tenant-001 | Savings | SAVINGS | $12,340.00 |
| tenant-003 | Business Operating | CHECKING | $5,400,000.00 |
| tenant-003 | Payroll | CHECKING | $234,500.00 |
| tenant-003 | Business Reserve | MONEY_MARKET | $1,250,000.00 |

---

## 7. Keycloak Configuration

### 7.1 Realm Setup

Create realm: `anybank`

**Realm Settings**:
- Login: Enable "Remember Me", "Login with Email"
- Tokens: Access token lifespan = 5 minutes, Refresh = 30 minutes
- Security: Brute force protection enabled

### 7.2 Client Configuration

#### Client: `anybank-web`

| Setting | Value |
|---------|-------|
| Client Protocol | openid-connect |
| Access Type | public |
| Standard Flow | enabled |
| Direct Access Grants | disabled |
| Valid Redirect URIs | http://localhost:3000/*, https://app.anybank.com/* |
| Web Origins | http://localhost:3000, https://app.anybank.com |
| PKCE | S256 (required) |

#### Client: `anybank-api`

| Setting | Value |
|---------|-------|
| Client Protocol | openid-connect |
| Access Type | confidential |
| Service Accounts | enabled |
| Token Exchange | enabled |

### 7.3 Token Exchange Setup

Enable RFC 8693 Token Exchange:

1. Enable feature flag: `--features=token-exchange`
2. Create token exchange permission in `anybank-api` client
3. Define scope for each tenant type: `tenant:consumer`, `tenant:business`, etc.
4. Create mapper to include `tenant_id` claim in exchanged tokens

### 7.4 User Federation (Optional)

For production, connect to existing bank LDAP/AD:

- Provider: ldap
- Vendor: Active Directory
- Connection URL: ldaps://ad.anybank.internal
- Users DN: ou=Users,dc=anybank,dc=internal
- Bind DN: cn=keycloak,ou=ServiceAccounts,dc=anybank,dc=internal
- Sync: Periodic (every 1 hour)

---

## 8. Docker Compose Setup

### 8.1 Services

Define these services in `docker-compose.yml`:

| Service | Image | Ports | Purpose |
|---------|-------|-------|---------|
| keycloak | quay.io/keycloak/keycloak:23.0 | 8080 | Identity Provider |
| postgres | postgres:15-alpine | 5432 | Database |
| opa | openpolicyagent/opa:latest | 8181 | Policy Engine |
| backend | (build from ./backend using Maven/Gradle) | 8000 | Spring Boot API |
| frontend | nginx:alpine | 3000 | Static file server |

### 8.2 Environment Variables

#### Backend Service (Spring Boot)
```
SPRING_PROFILES_ACTIVE=local
SPRING_DATASOURCE_URL=jdbc:postgresql://postgres:5432/anybank
SPRING_DATASOURCE_USERNAME=bank
SPRING_DATASOURCE_PASSWORD=bank
SPRING_SECURITY_OAUTH2_RESOURCESERVER_JWT_ISSUER_URI=http://keycloak:8080/realms/anybank
KEYCLOAK_URL=http://keycloak:8080
KEYCLOAK_REALM=anybank
KEYCLOAK_CLIENT_ID=anybank-api
KEYCLOAK_CLIENT_SECRET=<secret>
OPA_URL=http://opa:8181/v1/data/bank/authz
LOGGING_LEVEL_ROOT=INFO
LOGGING_LEVEL_COM_ANYBANK=DEBUG
```

#### Keycloak Service
```
KEYCLOAK_ADMIN=admin
KEYCLOAK_ADMIN_PASSWORD=<secure-password>
KC_DB=postgres
KC_DB_URL=jdbc:postgresql://postgres:5432/keycloak
KC_DB_USERNAME=keycloak
KC_DB_PASSWORD=<secure-password>
```

### 8.3 Volumes

- `postgres-data`: Persist database between restarts
- `./opa/policies`: Mount policy files into OPA container
- `./backend/target`: Cache Maven/Gradle build artifacts
- `./frontend/dist`: Mount built frontend files
- `m2-cache`: Maven local repository cache (speeds up builds)

### 8.4 Networks

Create a single bridge network (`bank-net`) connecting all services.

### 8.5 Health Checks

Define health checks for each service:
- **Keycloak**: HTTP GET /health/ready
- **Postgres**: pg_isready command
- **OPA**: HTTP GET /health
- **Backend**: HTTP GET /actuator/health (Spring Boot Actuator)

---

## 9. Development Workflow

### 9.1 Getting Started

> **This prototype is designed to be cloned from GitHub and run locally with Docker.**

#### Prerequisites

- Docker Desktop (v4.0+) with Docker Compose
- Git
- 8GB RAM minimum (Keycloak requires significant memory)
- Ports 3000, 8000, 8080, 8181, 5432 available

#### Clone and Run

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

# 5. Open the demo
open http://localhost:3000
```

#### Service URLs (After Startup)

| Service | URL | Purpose |
|---------|-----|---------|
| Frontend | http://localhost:3000 | Demo application |
| Backend API | http://localhost:8000 | Spring Boot API (Swagger at /swagger-ui.html) |
| Keycloak Admin | http://localhost:8080/admin | Identity management (admin/admin) |
| OPA | http://localhost:8181 | Policy engine status |

#### First-Time Setup (Automatic)

On first run, the following happens automatically:
1. PostgreSQL initializes with schema from Flyway migrations (`db/migration/`)
2. Keycloak imports realm configuration from `keycloak/realm-export.json`
3. Test users and tenants are seeded from `seed/demo-data.sql`
4. OPA loads policies from `opa/policy.rego`

### 9.2 Development Commands

| Command | Purpose |
|---------|---------|
| `./mvnw spring-boot:run` | Run Spring Boot backend (Maven) |
| `./gradlew bootRun` | Run Spring Boot backend (Gradle) |
| `./mvnw test` | Run backend unit tests |
| `./mvnw verify` | Run integration tests |
| `npm run dev` | Watch and rebuild frontend |
| `docker-compose logs -f backend` | Tail backend logs |
| `curl localhost:8181/v1/policies` | List OPA policies |
| `curl localhost:8000/actuator/health` | Check backend health |

### 9.3 Testing Scenarios

#### Scenario 1: Happy Path Login
1. Navigate to http://localhost:3000
2. Click "Sign In"
3. Enter test credentials (jdoe@example.com / password)
4. Select "Personal Banking" tenant
5. Verify dashboard loads with consumer accounts

#### Scenario 2: Context Switch
1. Complete Scenario 1
2. Click context indicator in header
3. Select "Doe Consulting LLC"
4. Verify token exchange occurs (network tab)
5. Verify dashboard updates to commercial view

#### Scenario 3: High Risk Denial
1. Complete Scenario 1
2. Navigate to Transfers
3. Initiate large transfer ($50,000+)
4. Modify request headers to trigger high risk (User-Agent: HACKER)
5. Verify 403 response with "High Risk" message

#### Scenario 4: Role-Based Access
1. Create test user with VIEWER role in tenant
2. Login as that user
3. Attempt to access /admin/users
4. Verify 403 response (insufficient permissions)

---

## 10. Deployment Considerations

### 10.1 Production Checklist

- [ ] Replace Keycloak dev mode with production configuration
- [ ] Enable HTTPS for all services
- [ ] Configure proper secrets management (Vault, AWS Secrets Manager)
- [ ] Set up database connection pooling
- [ ] Configure Redis for session/cache storage
- [ ] Enable structured logging to centralized system
- [ ] Set up monitoring and alerting
- [ ] Configure rate limiting at API gateway level
- [ ] Enable WAF rules
- [ ] Complete security audit

### 10.2 Scaling Considerations

- **Backend**: Stateless, horizontally scalable behind load balancer
- **Keycloak**: Cluster mode with shared database and infinispan cache
- **OPA**: Deploy as sidecar or centralized cluster
- **Database**: Read replicas for query scaling, connection pooling

### 10.3 Compliance Notes

For banking applications, ensure:
- All PII encrypted at rest and in transit
- Audit logs immutable and retained per regulations
- Session timeouts comply with banking standards (15 min idle)
- MFA enforced for sensitive operations
- IP allowlisting for administrative access

---

## 11. Appendix

### 11.1 Glossary

| Term | Definition |
|------|------------|
| **IdP** | Identity Provider — service that authenticates users |
| **Tenant** | An organization or account context a user can access |
| **Token Exchange** | RFC 8693 protocol to swap one token for another |
| **OPA** | Open Policy Agent — policy decision engine |
| **ReBAC** | Relationship-Based Access Control |
| **FGAC** | Fine-Grained Access Control |
| **Step-Up Auth** | Requiring additional authentication for sensitive actions |

### 11.2 Reference Documents

- RFC 8693: OAuth 2.0 Token Exchange
- OpenID Connect Core 1.0
- Open Policy Agent Documentation
- Keycloak Server Administration Guide
- Spring Boot Reference Documentation
- Spring Security OAuth2 Resource Server Guide

### 11.3 UI Component Reference

**ShadCN Components Used**:
- Alert, AlertDialog
- Avatar
- Badge
- Button
- Card, CardHeader, CardContent, CardFooter
- DatePicker
- Dialog
- DropdownMenu
- Input
- Label
- Pagination
- RadioGroup
- Select
- Separator
- Table, TableHeader, TableBody, TableRow, TableCell
- Tabs, TabsList, TabsTrigger, TabsContent
- Toast, Toaster

### 11.4 Color Scheme

| Context | Primary Color | Banner Color | Badge Color |
|---------|--------------|--------------|-------------|
| Consumer | Blue (#3B82F6) | Blue-50 | Blue-100 |
| Small Business | Green (#22C55E) | Green-50 | Green-100 |
| Commercial | Purple (#8B5CF6) | Purple-50 | Purple-100 |
| Investment | Amber (#F59E0B) | Amber-50 | Amber-100 |
| Trust | Slate (#64748B) | Slate-50 | Slate-100 |

---

*End of Specification*
