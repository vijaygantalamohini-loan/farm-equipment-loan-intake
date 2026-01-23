# Azure AD B2C Authentication Architecture

## System Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER BROWSER                                 │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │  Loan Intake Portal (React Frontend)                        │   │
│  │  http://localhost:3000                                      │   │
│  │                                                             │   │
│  │  ┌──────────────────────────────────────────────┐         │   │
│  │  │  Login Component                              │         │   │
│  │  │  • "Sign in with Microsoft" button          │         │   │
│  │  │  • Redirects to /auth/login                 │         │   │
│  │  └──────────────────────────────────────────────┘         │   │
│  └────────────────────────────────────────────────────────────┘   │
│                           │                                          │
│                           │ 1. Click "Sign in"                      │
│                           ▼                                          │
└─────────────────────────────────────────────────────────────────────┘
                            │
                            │
┌───────────────────────────▼─────────────────────────────────────────┐
│                      Backend API                                     │
│                   http://localhost:8000                              │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │  GET /auth/login                                            │   │
│  │  • Constructs Azure AD authorization URL                   │   │
│  │  • Includes: client_id, redirect_uri, scope, state        │   │
│  │  • Redirects browser to Azure AD B2C                       │   │
│  └────────────────────────────────────────────────────────────┘   │
│                           │                                          │
└───────────────────────────┼─────────────────────────────────────────┘
                            │ 2. Redirect to Azure
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   Microsoft Azure AD B2C                             │
│          https://yourcompany.b2clogin.com                            │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │  User Flow: B2C_1_signupsignin                             │   │
│  │                                                             │   │
│  │  ┌──────────────────────────────────────┐                 │   │
│  │  │  Login Page                           │                 │   │
│  │  │  • Email/password input              │                 │   │
│  │  │  • Social login buttons              │                 │   │
│  │  │  • MFA prompt (if enabled)           │                 │   │
│  │  │  • Terms acceptance                  │                 │   │
│  │  └──────────────────────────────────────┘                 │   │
│  │                                                             │   │
│  │  User enters credentials and authenticates                 │   │
│  │                                                             │   │
│  └────────────────────────────────────────────────────────────┘   │
│                           │                                          │
│                           │ 3. Authentication success               │
│                           ▼                                          │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │  Generate Authorization Code                                │   │
│  │  • Short-lived code (5 minutes)                            │   │
│  │  • Single-use only                                         │   │
│  └────────────────────────────────────────────────────────────┘   │
│                           │                                          │
└───────────────────────────┼─────────────────────────────────────────┘
                            │ 4. Redirect with code
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Backend API                                     │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │  GET /auth/callback?code=ABC123&state=xyz                  │   │
│  │                                                             │   │
│  │  Step 1: Exchange code for tokens                          │   │
│  │  ─────────────────────────────────────────────────         │   │
│  │  POST to Azure AD token endpoint:                          │   │
│  │  • Send: code, client_id, client_secret                   │   │
│  │  • Receive: access_token, id_token, refresh_token         │   │
│  │                                                             │   │
│  │  Step 2: Verify ID token                                   │   │
│  │  ─────────────────────────────────────────────────         │   │
│  │  • Fetch public keys from Azure (.well-known/jwks)        │   │
│  │  • Verify signature using RS256                           │   │
│  │  • Validate audience (client_id)                          │   │
│  │  • Validate issuer (Azure AD tenant)                      │   │
│  │  • Check expiration                                       │   │
│  │  • Extract claims: email, name, etc.                      │   │
│  │                                                             │   │
│  │  Step 3: Map to salesperson                                │   │
│  │  ─────────────────────────────────────────────────         │   │
│  │  • Query database: SELECT * WHERE email = ?               │   │
│  │  • If found: Update last_login                            │   │
│  │  • If not found: Reject or auto-create                    │   │
│  │  • Get location and vendor info                           │   │
│  │                                                             │   │
│  │  Step 4: Redirect to frontend with token                   │   │
│  │  ─────────────────────────────────────────────────         │   │
│  │  Redirect to:                                              │   │
│  │  http://localhost:3000/auth/callback?token=xyz&            │   │
│  │    salesperson={id,name,location,...}                      │   │
│  └────────────────────────────────────────────────────────────┘   │
│                           │                                          │
└───────────────────────────┼─────────────────────────────────────────┘
                            │ 5. Redirect with token
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         USER BROWSER                                 │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │  Callback Handler Component                                 │   │
│  │  • Extract token from URL                                   │   │
│  │  • Extract salesperson data                                │   │
│  │  • Store in localStorage:                                  │   │
│  │    - access_token: "eyJhbGc..."                           │   │
│  │    - salesperson: {id, name, location}                    │   │
│  │  • Navigate to main application                           │   │
│  └────────────────────────────────────────────────────────────┘   │
│                           │                                          │
│                           ▼                                          │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │  Main Application (Authenticated)                           │   │
│  │  • Show user info in header                                │   │
│  │  • Enable loan application wizard                          │   │
│  │  • Show application history                                │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘


## Authenticated API Request Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER BROWSER                                 │
│                                                                      │
│  User submits loan application                                       │
│                           │                                          │
│                           ▼                                          │
│  POST /loans/submit                                                  │
│  Headers:                                                            │
│    Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...   │
│  Body:                                                               │
│    { borrower_data: {...}, loan_data: {...} }                       │
│                           │                                          │
└───────────────────────────┼─────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Backend API                                     │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │  POST /loans/submit endpoint                                │   │
│  │                                                             │   │
│  │  1. Extract token from Authorization header                │   │
│  │     token = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."     │   │
│  │                                                             │   │
│  │  2. Verify token with Azure AD                             │   │
│  │     ┌─────────────────────────────────────────────┐       │   │
│  │     │ verify_azure_token(token)                    │       │   │
│  │     │ • Fetch Azure public keys (cached)          │       │   │
│  │     │ • Decode JWT header, get key ID             │       │   │
│  │     │ • Find matching public key                  │       │   │
│  │     │ • Verify signature with RS256               │       │   │
│  │     │ • Validate claims:                          │       │   │
│  │     │   - aud: our client_id                      │       │   │
│  │     │   - iss: Azure AD issuer                    │       │   │
│  │     │   - exp: not expired                        │       │   │
│  │     │ • Extract email from claims                 │       │   │
│  │     └─────────────────────────────────────────────┘       │   │
│  │                                                             │   │
│  │  3. Get salesperson from database                          │   │
│  │     ┌─────────────────────────────────────────────┐       │   │
│  │     │ get_or_create_salesperson_from_azure()      │       │   │
│  │     │ • Query: SELECT * WHERE email = ?           │       │   │
│  │     │ • Check is_active = true                    │       │   │
│  │     │ • Update last_login timestamp               │       │   │
│  │     │ • Return salesperson with location          │       │   │
│  │     └─────────────────────────────────────────────┘       │   │
│  │                                                             │   │
│  │  4. Process loan submission                                │   │
│  │     • Generate application number                          │   │
│  │     • Save to database:                                    │   │
│  │       - salesperson_id (from token)                        │   │
│  │       - location_id (from salesperson)                     │   │
│  │       - borrower_data (from request)                       │   │
│  │       - loan_data (from request)                           │   │
│  │       - status: "submitted"                                │   │
│  │                                                             │   │
│  │  5. Return response                                        │   │
│  │     { application_number: "LA-20231220-ABC123" }          │   │
│  └────────────────────────────────────────────────────────────┘   │
│                           │                                          │
└───────────────────────────┼─────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         USER BROWSER                                 │
│                                                                      │
│  Show success message:                                               │
│  "Application LA-20231220-ABC123 submitted successfully!"            │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Token Verification Details

```
Azure AD B2C Access Token (JWT):

Header:
─────────────────────────────────────────────
{
  "typ": "JWT",
  "alg": "RS256",        ← RSA signature with SHA-256
  "kid": "XYZ123..."     ← Key ID to find public key
}

Payload (Claims):
─────────────────────────────────────────────
{
  "iss": "https://yourcompany.b2clogin.com/...",  ← Issuer
  "aud": "your-client-id",                         ← Audience
  "exp": 1703102400,                               ← Expiration (Unix timestamp)
  "nbf": 1703098800,                               ← Not before
  "iat": 1703098800,                               ← Issued at
  "sub": "user-unique-id",                         ← Subject (user ID)
  "email": "john.smith@company.com",               ← Email (claim)
  "given_name": "John",                            ← First name
  "family_name": "Smith",                          ← Last name
  "tfp": "B2C_1_signupsignin"                     ← Trust framework policy
}

Signature:
─────────────────────────────────────────────
Base64UrlEncode(
  RSA-SHA256(
    header_base64 + "." + payload_base64,
    Azure_Private_Key
  )
)

Verification Process:
─────────────────────────────────────────────
1. Fetch public keys from Azure:
   GET https://yourcompany.b2clogin.com/.../discovery/v2.0/keys
   
2. Match key by "kid" in token header

3. Verify signature:
   RSA-SHA256(header + payload, Azure_Public_Key) == signature
   
4. Validate claims:
   ✓ aud matches our client_id
   ✓ iss matches Azure AD issuer
   ✓ exp > current_time (not expired)
   ✓ nbf <= current_time (valid start)
   
5. Extract user info from claims:
   email → Query database for salesperson
```

## Database Mapping

```
Azure AD User              Loan Application Database
─────────────────────────────────────────────────────────

Azure AD B2C Tenant        vendors table
└── User Accounts          ├── id: 1
    ├── john@company.com   │   name: "Green Valley Equipment"
    ├── sarah@company.com  │
    └── tom@company.com    └── locations table
                               ├── id: 1, vendor_id: 1
                               │   location_name: "Des Moines"
                               │
                               └── salespeople table
                                   ├── id: 1, location_id: 1
                                   │   email: "john@company.com"  ← Match
                                   │   first_name: "John"
                                   │   last_name: "Smith"
                                   │
                                   └── loan_applications table
                                       └── id: 1
                                           salesperson_id: 1  ← Linked
                                           location_id: 1
                                           borrower_data: {...}
                                           loan_data: {...}

Mapping Logic:
──────────────
1. Extract email from Azure token: "john@company.com"
2. Query database: SELECT * FROM salespeople WHERE email = "john@company.com"
3. If found → Use salesperson_id for all operations
4. If not found → Reject (or auto-create if enabled)
```

## Security Layers

```
┌────────────────────────────────────────────────────────────┐
│                     Security Stack                          │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  Layer 1: Transport Security                               │
│  ─────────────────────────────────────────────────        │
│  ✓ HTTPS/TLS 1.3 encryption                               │
│  ✓ Certificate validation                                 │
│                                                             │
│  Layer 2: Azure AD B2C Authentication                      │
│  ─────────────────────────────────────────────────        │
│  ✓ Centralized authentication                             │
│  ✓ Multi-factor authentication                            │
│  ✓ Brute force protection                                 │
│  ✓ Account lockout policies                               │
│  ✓ Conditional access rules                               │
│                                                             │
│  Layer 3: Token Validation                                 │
│  ─────────────────────────────────────────────────        │
│  ✓ RSA signature verification                             │
│  ✓ Audience validation                                    │
│  ✓ Issuer validation                                      │
│  ✓ Expiration checking                                    │
│  ✓ Public key rotation support                            │
│                                                             │
│  Layer 4: Database Authorization                           │
│  ─────────────────────────────────────────────────        │
│  ✓ User must exist in salespeople table                   │
│  ✓ is_active must be true                                 │
│  ✓ Location-based access control                          │
│  ✓ Application ownership validation                       │
│                                                             │
│  Layer 5: API Rate Limiting (TODO)                        │
│  ─────────────────────────────────────────────────        │
│  ⚠ Not implemented yet                                    │
│  □ Add rate limiting middleware                           │
│  □ Limit requests per IP/user                             │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

## Performance Considerations

```
Token Verification Performance:
────────────────────────────────────────────

Initial Request (cold start):
  1. Fetch Azure public keys     ~200ms  (network)
  2. Parse and cache keys         ~5ms   (computation)
  3. Verify token signature       ~10ms  (RSA verification)
  4. Query database               ~20ms  (database)
  ────────────────────────────────────
  Total:                          ~235ms

Subsequent Requests (warm):
  1. Use cached Azure keys        ~0ms   (cache hit)
  2. Verify token signature       ~10ms  (RSA verification)
  3. Query database               ~20ms  (database)
  ────────────────────────────────────
  Total:                          ~30ms

Optimization Strategies:
────────────────────────────────────────────
✓ Cache Azure public keys (lru_cache)
✓ Use database connection pooling
□ Cache salesperson lookups (Redis)
□ Pre-fetch location/vendor data
□ Use database indexes on email column
```

---

**Architecture notes:**
- All communication uses HTTPS in production
- Tokens are short-lived (1 hour default)
- Refresh tokens can extend sessions
- Database queries use indexes for performance
- Public keys are cached to reduce Azure API calls
