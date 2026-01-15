# Keycloak Configuration for AnyBank Identity Platform

This directory contains the Keycloak realm configuration for the unified identity multi-context banking platform.

## Overview

The `anybank` realm provides:
- **Authentication**: Single sign-on for all banking contexts
- **Token Exchange (RFC 8693)**: Context switching without re-authentication
- **Multi-tenant support**: Consumer, Business, Commercial, Investment, and Trust banking
- **Custom claims**: `tenant_id`, `tenant_type`, and `role` for fine-grained authorization

## Quick Start with Docker Compose

The realm configuration is automatically imported when you run:

```bash
docker-compose up
```

The `realm-export.json` file is mounted into the Keycloak container and imported on first startup.

## Test Users

Three pre-configured users are available for testing:

| Email | Password | Display Name | Roles | Available Tenants |
|-------|----------|--------------|-------|-------------------|
| jdoe@example.com | demo123 | John Doe | user | Personal Banking, AnyBusiness Inc. |
| jsmith@example.com | demo123 | Jane Smith | user | Personal Banking |
| admin@anybank.com | admin123 | Admin User | user, admin | All tenants (ADMIN role) |

## Client Configuration

### anybank-web (Public Client)

**Purpose**: Frontend web application client

**Configuration**:
- **Client ID**: `anybank-web`
- **Access Type**: Public
- **Protocol**: OpenID Connect
- **Standard Flow**: Enabled (Authorization Code Flow)
- **PKCE**: S256 (required for security)
- **Direct Access Grants**: Disabled
- **Valid Redirect URIs**:
  - `http://localhost:3000/*`
  - `https://app.anybank.com/*`
- **Web Origins**:
  - `http://localhost:3000`
  - `https://app.anybank.com`

**Protocol Mappers**:
- `email`: Maps user email to token claim
- `full name`: Maps user's first and last name to token

### anybank-api (Confidential Client)

**Purpose**: Backend API server with token exchange capability

**Configuration**:
- **Client ID**: `anybank-api`
- **Access Type**: Confidential
- **Client Secret**: `anybank-api-secret-change-in-production`
- **Protocol**: OpenID Connect
- **Service Accounts**: Enabled
- **Direct Access Grants**: Enabled
- **Token Exchange**: Enabled (RFC 8693)

**Protocol Mappers**:
- `email`: User email claim
- `full name`: User's display name
- `tenant_id`: Custom attribute for current tenant UUID
- `tenant_type`: Tenant type (CONSUMER, BUSINESS, COMMERCIAL, etc.)
- `role`: User's role within the tenant (OWNER, ADMIN, OPERATOR, VIEWER)

**Important**: Change the client secret in production!

## Token Configuration

| Setting | Value | Purpose |
|---------|-------|---------|
| Access Token Lifespan | 5 minutes | Short-lived for security |
| Refresh Token Lifespan | 30 minutes | Allows session extension |
| SSO Session Idle | 30 minutes | Logout after inactivity |
| SSO Session Max | 10 hours | Maximum session duration |

## Client Scopes

Custom scopes for tenant-based access control:

- `tenant:consumer` - Consumer banking context
- `tenant:business` - Small business banking context
- `tenant:commercial` - Commercial banking context
- `tenant:investment` - Investment banking context
- `tenant:trust` - Trust banking context

These scopes are used during token exchange to scope access tokens to specific tenant types.

## Token Exchange Flow (RFC 8693)

The token exchange feature enables context switching without re-authentication:

1. User authenticates and receives an **identity token** (broadly scoped)
2. User selects a tenant/organization to access
3. Frontend calls backend `/auth/token/exchange` endpoint
4. Backend exchanges identity token for **access token** scoped to selected tenant
5. Access token includes: `tenant_id`, `tenant_type`, `role` claims
6. User can switch contexts by repeating steps 2-5 without re-login

### Enabling Token Exchange

Token exchange is enabled via the client attribute:
```json
"attributes": {
  "token.exchange.grant.enabled": "true"
}
```

**Note**: Token exchange requires Keycloak to be started with the `--features=token-exchange` flag.

## Security Features

- **Brute Force Protection**: Enabled (5 failed attempts, 15-minute lockout)
- **Remember Me**: Enabled
- **PKCE**: Required for public client (S256 method)
- **HTTPS**: Recommended for production (set `sslRequired: "all"`)
- **Content Security Policy**: Configured in browser security headers

## Manual Setup Instructions

If automatic import fails, follow these steps to manually configure Keycloak:

### Step 1: Create Realm

1. Login to Keycloak Admin Console: `http://localhost:8080/admin`
2. Username: `admin`, Password: `admin` (or as configured)
3. Click **Create Realm**
4. Enter realm name: `anybank`
5. Click **Create**

### Step 2: Configure Realm Settings

1. Go to **Realm Settings** > **General**
   - Display name: `AnyBank Identity Platform`
   - Enable: **User registration** (OFF)
   - Enable: **Email as username** (ON)
   - Enable: **Remember me** (ON)

2. Go to **Realm Settings** > **Login**
   - Enable: **User registration** (OFF)
   - Enable: **Forgot password** (ON)
   - Enable: **Remember me** (ON)

3. Go to **Realm Settings** > **Tokens**
   - Access Token Lifespan: `5` minutes
   - Refresh Token Max Reuse: `0`
   - SSO Session Idle: `30` minutes
   - SSO Session Max: `10` hours

4. Go to **Realm Settings** > **Security Defenses**
   - Enable: **Brute force detection** (ON)
   - Max login failures: `5`
   - Wait increment: `60` seconds
   - Max wait: `900` seconds (15 minutes)

### Step 3: Create anybank-web Client

1. Go to **Clients** > **Create client**
2. **General Settings**:
   - Client type: `OpenID Connect`
   - Client ID: `anybank-web`
   - Name: `AnyBank Web Application`
   - Click **Next**

3. **Capability config**:
   - Client authentication: **OFF** (public client)
   - Authorization: **OFF**
   - Standard flow: **ON**
   - Direct access grants: **OFF**
   - Click **Next**

4. **Login settings**:
   - Valid redirect URIs: `http://localhost:3000/*`
   - Valid post logout redirect URIs: `http://localhost:3000/*`
   - Web origins: `http://localhost:3000`
   - Click **Save**

5. Go to **Advanced** > **Advanced Settings**:
   - Proof Key for Code Exchange Code Challenge Method: `S256`
   - Click **Save**

### Step 4: Create anybank-api Client

1. Go to **Clients** > **Create client**
2. **General Settings**:
   - Client type: `OpenID Connect`
   - Client ID: `anybank-api`
   - Name: `AnyBank API Backend`
   - Click **Next**

3. **Capability config**:
   - Client authentication: **ON** (confidential)
   - Authorization: **OFF**
   - Standard flow: **OFF**
   - Direct access grants: **ON**
   - Service accounts roles: **ON**
   - Click **Next**

4. Click **Save**

5. Go to **Credentials** tab:
   - Copy the **Client secret** value
   - Save this for backend configuration

6. Go to **Advanced** > **Fine Grain OpenID Connect Configuration**:
   - Add custom attribute: `token.exchange.grant.enabled` = `true`
   - Click **Save**

### Step 5: Create Protocol Mappers for anybank-api

1. Select **anybank-api** client
2. Go to **Client scopes** > **anybank-api-dedicated** > **Add mapper** > **By configuration**
3. Select **User Attribute**

Create three custom mappers:

**Mapper 1: tenant_id**
- Name: `tenant_id`
- User Attribute: `tenant_id`
- Token Claim Name: `tenant_id`
- Claim JSON Type: `String`
- Add to ID token: **ON**
- Add to access token: **ON**
- Add to userinfo: **ON**

**Mapper 2: tenant_type**
- Name: `tenant_type`
- User Attribute: `tenant_type`
- Token Claim Name: `tenant_type`
- Claim JSON Type: `String`
- Add to ID token: **ON**
- Add to access token: **ON**
- Add to userinfo: **ON**

**Mapper 3: role**
- Name: `role`
- User Attribute: `role`
- Token Claim Name: `role`
- Claim JSON Type: `String`
- Add to ID token: **ON**
- Add to access token: **ON**
- Add to userinfo: **ON**

### Step 6: Create Client Scopes

1. Go to **Client scopes** > **Create client scope**

Create these scopes:

- **tenant:consumer**
  - Name: `tenant:consumer`
  - Type: `Optional`
  - Protocol: `openid-connect`
  - Display on consent screen: **ON**

- **tenant:business**
  - Name: `tenant:business`
  - Type: `Optional`
  - Protocol: `openid-connect`
  - Display on consent screen: **ON**

- **tenant:commercial**
  - Name: `tenant:commercial`
  - Type: `Optional`
  - Protocol: `openid-connect`
  - Display on consent screen: **ON**

- **tenant:investment**
  - Name: `tenant:investment`
  - Type: `Optional`
  - Protocol: `openid-connect`
  - Display on consent screen: **ON**

- **tenant:trust**
  - Name: `tenant:trust`
  - Type: `Optional`
  - Protocol: `openid-connect`
  - Display on consent screen: **ON**

### Step 7: Create Realm Roles

1. Go to **Realm roles** > **Create role**

Create two roles:

- **user**
  - Role name: `user`
  - Description: `Standard user role`

- **admin**
  - Role name: `admin`
  - Description: `Administrator role with elevated privileges`

### Step 8: Create Test Users

1. Go to **Users** > **Add user**

**User 1: John Doe**
- Username: `jdoe@example.com`
- Email: `jdoe@example.com`
- Email verified: **ON**
- First name: `John`
- Last name: `Doe`
- Click **Create**
- Go to **Credentials** tab:
  - Set password: `demo123`
  - Temporary: **OFF**
- Go to **Role mapping** tab:
  - Assign role: `user`
- Go to **Attributes** tab:
  - Add attribute: `displayName` = `John Doe`

**User 2: Jane Smith**
- Username: `jsmith@example.com`
- Email: `jsmith@example.com`
- Email verified: **ON**
- First name: `Jane`
- Last name: `Smith`
- Click **Create**
- Go to **Credentials** tab:
  - Set password: `demo123`
  - Temporary: **OFF**
- Go to **Role mapping** tab:
  - Assign role: `user`
- Go to **Attributes** tab:
  - Add attribute: `displayName` = `Jane Smith`

**User 3: Admin User**
- Username: `admin@anybank.com`
- Email: `admin@anybank.com`
- Email verified: **ON**
- First name: `Admin`
- Last name: `User`
- Click **Create**
- Go to **Credentials** tab:
  - Set password: `admin123`
  - Temporary: **OFF**
- Go to **Role mapping** tab:
  - Assign roles: `user`, `admin`
- Go to **Attributes** tab:
  - Add attribute: `displayName` = `Admin User`

## Troubleshooting

### Token Exchange Not Working

**Symptom**: Backend receives 400 Bad Request when calling token exchange endpoint

**Solution**:
1. Verify Keycloak is started with `--features=token-exchange` flag
2. Check that `anybank-api` client has attribute `token.exchange.grant.enabled=true`
3. Verify the service account for `anybank-api` has necessary permissions

In Docker Compose, ensure:
```yaml
keycloak:
  command:
    - start-dev
    - --features=token-exchange
```

### Import Fails on Startup

**Symptom**: Realm not created when starting Docker Compose

**Solution**:
1. Check Keycloak logs: `docker-compose logs keycloak`
2. Verify `realm-export.json` is mounted: `docker-compose exec keycloak ls -la /opt/keycloak/data/import/`
3. Try manual import via Admin Console: **Realm Settings** > **Action** > **Partial import**

### Invalid Redirect URI

**Symptom**: Error "Invalid parameter: redirect_uri" after login

**Solution**:
1. Verify frontend URL matches exactly in client configuration
2. Check for trailing slashes
3. Ensure wildcard `/*` is present for sub-paths
4. Verify protocol (http vs https) matches

### CORS Issues

**Symptom**: Browser blocks requests from frontend to Keycloak

**Solution**:
1. Add frontend origin to **Web Origins** in `anybank-web` client
2. Ensure origin doesn't include trailing slash
3. Use `+` for all origins in development (not recommended for production)

## Production Considerations

Before deploying to production:

1. **Change Client Secret**:
   - Generate a strong, random secret for `anybank-api`
   - Store in secure secret management system (Vault, AWS Secrets Manager)
   - Update backend `application.yml` with new secret

2. **Enable SSL**:
   - Set `sslRequired: "all"` in realm settings
   - Configure proper SSL certificates
   - Use reverse proxy (nginx, Apache) for SSL termination

3. **Update Redirect URIs**:
   - Replace `localhost` URIs with production domain
   - Remove any wildcard URIs if possible

4. **Configure External Database**:
   - Don't use Keycloak's embedded H2 database
   - Configure PostgreSQL or MySQL
   - Enable connection pooling

5. **Enable MFA**:
   - Configure OTP policy
   - Consider WebAuthn for passwordless authentication

6. **Set Up Email**:
   - Configure SMTP server in realm settings
   - Enable email verification
   - Configure password reset emails

7. **Review Token Lifespans**:
   - Consider shorter access token lifespans (1-5 minutes)
   - Implement refresh token rotation
   - Configure session management policies

8. **Enable Monitoring**:
   - Enable Keycloak metrics
   - Configure log aggregation
   - Set up alerts for failed logins, token exchange errors

9. **Backup Configuration**:
   - Regularly export realm configuration
   - Version control exported JSON
   - Test restore procedures

## Additional Resources

- [Keycloak Documentation](https://www.keycloak.org/documentation)
- [RFC 8693: OAuth 2.0 Token Exchange](https://datatracker.ietf.org/doc/html/rfc8693)
- [OpenID Connect Core Specification](https://openid.net/specs/openid-connect-core-1_0.html)
- [PKCE (RFC 7636)](https://datatracker.ietf.org/doc/html/rfc7636)

## Support

For issues specific to this implementation:
1. Check application logs: `docker-compose logs backend`
2. Check Keycloak logs: `docker-compose logs keycloak`
3. Verify token claims using [jwt.io](https://jwt.io)
4. Review OPA policy decisions: `curl http://localhost:8181/v1/data`
