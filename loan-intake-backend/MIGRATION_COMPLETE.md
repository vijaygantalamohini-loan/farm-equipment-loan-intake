# Azure AD B2C Migration - Quick Start

## ✅ Migration Complete!

The application has been migrated from JWT authentication to Azure AD B2C.

## What Changed

### Backend Changes:
- ❌ **Removed**: JWT token generation and validation
- ❌ **Removed**: Username/password login endpoints
- ✅ **Added**: Azure AD B2C OAuth2 integration
- ✅ **Added**: Token verification using Azure public keys
- ✅ **Kept**: Password hashing (for admin-created accounts only)

### Frontend Changes:
- ❌ **Removed**: Email/password login form
- ✅ **Added**: "Sign in with Microsoft" button
- ✅ **Added**: Azure AD redirect flow

## Quick Setup (5 Steps)

### Step 1: Install Dependencies

```bash
cd c:\FarmEquipment\loan-intake-backend
pip install requests python-jose[cryptography]
```

### Step 2: Create Azure AD B2C Tenant

Follow the detailed guide in [AZURE_AD_SETUP.md](./AZURE_AD_SETUP.md)

Or quick version:
1. Go to [Azure Portal](https://portal.azure.com)
2. Create Azure AD B2C tenant
3. Register application
4. Create client secret
5. Create "Sign up and sign in" user flow

### Step 3: Configure Environment

Copy `.env.example` to `.env` and fill in Azure values:

```bash
# From Azure Portal - App Registration
AZURE_AD_TENANT_NAME=yourcompany
AZURE_AD_B2C_TENANT_ID=your-tenant-guid
AZURE_AD_CLIENT_ID=your-client-id
AZURE_AD_CLIENT_SECRET=your-client-secret
AZURE_AD_POLICY_NAME=B2C_1_signupsignin

# URLs
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:8000
```

### Step 4: Add Redirect URI in Azure

In Azure Portal → App Registration → Authentication:
- Add redirect URI: `http://localhost:8000/auth/callback`
- For production: `https://yourdomain.com/auth/callback`

### Step 5: Start Application

```bash
# Backend
cd c:\FarmEquipment\loan-intake-backend
python main.py

# Frontend
cd c:\FarmEquipment\loan-intake-frontend
npm start
```

## Testing Authentication

1. Open http://localhost:3000
2. Click "Sign in with Microsoft"
3. You'll be redirected to Azure AD B2C login
4. Enter your Azure AD credentials
5. After login, you'll be redirected back to the application

## User Management

### Option 1: Pre-create Users (Recommended)

1. Create user in Azure AD B2C
2. Create matching salesperson in database:

```python
from database import SessionLocal, Salesperson
db = SessionLocal()

salesperson = Salesperson(
    location_id=1,
    email="user@company.com",  # Must match Azure AD email
    password_hash="",  # Not used for Azure AD users
    first_name="John",
    last_name="Smith"
)
db.add(salesperson)
db.commit()
```

### Option 2: Auto-provision Users

Uncomment the auto-provisioning code in `services/azure_ad_auth.py` function `get_or_create_salesperson_from_azure()`

## API Endpoints

### Authentication:
- `GET /auth/login` - Redirects to Azure AD B2C
- `GET /auth/callback` - Azure redirects here after login
- `POST /auth/verify` - Verify Azure token

### Loan Management (Protected):
- `POST /loans/submit` - Submit application (requires Azure token)
- `GET /loans/my-applications` - Get user's applications
- `GET /loans/location-applications` - Get location's applications

### Admin (Unprotected - secure in production):
- `POST /admin/vendors` - Create vendor
- `POST /admin/locations` - Create location
- `POST /admin/salespeople` - Create salesperson

## Security Features

✅ **Azure AD B2C provides:**
- Multi-factor authentication
- Conditional access policies
- Brute force protection
- Token encryption
- Automatic key rotation
- Compliance certifications

✅ **Token validation:**
- Signature verification using Azure public keys
- Audience validation
- Issuer validation
- Expiration checking

## Troubleshooting

**"No email found in Azure AD token"**
- Ensure email is in user flow return claims
- Check Azure Portal → User flows → Your flow → User attributes

**"Salesperson not found"**
- User must exist in database
- Email must match exactly (case-insensitive)
- Check user is active: `is_active=True`

**"Invalid redirect URI"**
- Check URI matches exactly in Azure Portal
- Include `/auth/callback` path
- No trailing slash

**Token verification fails**
- Verify tenant name is correct
- Check policy name (B2C_1_signupsignin)
- Ensure internet connection for key fetching

## Migration Checklist

- [x] Remove JWT code from main.py
- [x] Remove JWT auth routes
- [x] Update loan_routes.py to use Azure auth
- [x] Update admin_routes.py comments
- [x] Simplify auth_service.py
- [x] Update Login.js component
- [x] Update Login.css styling
- [ ] Configure Azure AD B2C tenant
- [ ] Add environment variables
- [ ] Test login flow
- [ ] Create users in database
- [ ] Deploy to production

## Production Checklist

Before deploying to production:

1. **Azure AD Configuration:**
   - [ ] Use production tenant (not .b2clogin.com test)
   - [ ] Configure custom domain
   - [ ] Set up production redirect URIs
   - [ ] Enable MFA
   - [ ] Configure conditional access

2. **Security:**
   - [ ] Store secrets in Azure Key Vault
   - [ ] Enable HTTPS only
   - [ ] Configure CORS for production domain
   - [ ] Add rate limiting
   - [ ] Enable audit logging

3. **Database:**
   - [ ] Switch from SQLite to PostgreSQL
   - [ ] Set up database backups
   - [ ] Configure connection pooling

4. **Monitoring:**
   - [ ] Enable Application Insights
   - [ ] Set up alerts for failed logins
   - [ ] Monitor token validation failures

## Support & Resources

- **Azure AD B2C Docs**: https://docs.microsoft.com/azure/active-directory-b2c/
- **Setup Guide**: See [AZURE_AD_SETUP.md](./AZURE_AD_SETUP.md)
- **Pricing**: First 50,000 users/month FREE

## Need Help?

Contact your Azure AD administrator or refer to the detailed setup guide in [AZURE_AD_SETUP.md](./AZURE_AD_SETUP.md).
