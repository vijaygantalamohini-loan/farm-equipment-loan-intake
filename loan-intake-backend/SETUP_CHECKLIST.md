# 🎯 Azure AD B2C Setup Checklist

Use this checklist to track your Azure AD B2C setup progress.

---

## ✅ Code Migration (COMPLETE)

- [x] Remove JWT authentication from backend
- [x] Add Azure AD B2C authentication routes
- [x] Update loan routes to use Azure tokens
- [x] Update frontend Login component
- [x] Create documentation
- [x] Test imports

---

## 📋 Azure Portal Configuration (YOUR STEPS)

### Step 1: Create Azure AD B2C Tenant
- [ ] Go to [Azure Portal](https://portal.azure.com)
- [ ] Create new Azure AD B2C tenant
- [ ] Note tenant name: `_________________.onmicrosoft.com`
- [ ] Note tenant ID (GUID): `_________________________________`

### Step 2: Register Application
- [ ] Navigate to "App registrations"
- [ ] Click "New registration"
- [ ] Application name: `Loan Intake Portal`
- [ ] Supported account types: Select "Accounts in any identity provider or organizational directory (for authenticating users with user flows)"
- [ ] Redirect URI:
  - **Platform**: Select **"Web"** from dropdown (NOT "Single-page application")
  - **URI**: `http://localhost:8000/auth/callback`
- [ ] Click "Register"
- [ ] Copy Application (client) ID: `_________________________________`

### Step 3: Create Client Secret
- [ ] Go to "Certificates & secrets"
- [ ] Click "New client secret"
- [ ] Description: `Loan Intake Backend`
- [ ] Expires: 24 months
- [ ] Click "Add"
- [ ] **IMPORTANT:** Copy secret VALUE immediately: `_________________________________`
  - (You cannot see this again!)

### Step 4: Configure API Permissions
- [ ] Go to "API permissions"
- [ ] Click "Add a permission"
- [ ] Select "Microsoft Graph"
- [ ] Select "Delegated permissions"
- [ ] Check: `openid`, `profile`, `email`, `User.Read`
- [ ] Click "Add permissions"
- [ ] Click "Grant admin consent" (if admin)

### Step 5: Create User Flow
- [ ] Go to "User flows" (in B2C menu)
- [ ] Click "New user flow"
- [ ] Select "Sign up and sign in"
- [ ] Version: Recommended
- [ ] Name: `signupsignin`
  - (Results in: `B2C_1_signupsignin`)
- [ ] Identity providers:
  - [x] Email signup
  - [ ] Google (optional)
  - [ ] Facebook (optional)
  - [ ] Microsoft Account (optional)
- [ ] User attributes to collect:
  - [x] Email Address
  - [x] Given Name
  - [x] Surname
- [ ] Application claims to return:
  - [x] Email Addresses
  - [x] Given Name
  - [x] Surname
  - [x] Display Name
  - [x] User's Object ID
- [ ] Click "Create"

### Step 6: Add Test Users (Optional)
- [ ] Go to "Users"
- [ ] Click "New user"
- [ ] Select "Create Azure AD B2C user"
- [ ] Username: `____________________@_______________.onmicrosoft.com`
- [ ] Name: `____________________`
- [ ] Password: (generate or set)
- [ ] Click "Create"
- [ ] Repeat for additional users

---

## ⚙️ Backend Configuration

### Step 7: Create .env File
- [ ] Copy `.env.example` to `.env`
- [ ] Fill in Azure values from steps above:

```bash
# From Step 1
AZURE_AD_TENANT_NAME=_________________

# From Step 1
AZURE_AD_B2C_TENANT_ID=_________________________________

# From Step 2
AZURE_AD_CLIENT_ID=_________________________________

# From Step 3
AZURE_AD_CLIENT_SECRET=_________________________________

# From Step 5 (should be B2C_1_signupsignin)
AZURE_AD_POLICY_NAME=B2C_1_signupsignin

# Application URLs
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:8000
```

### Step 8: Install Dependencies
- [ ] Open terminal in `loan-intake-backend`
- [ ] Run: `pip install requests python-jose[cryptography]`
- [ ] Verify no errors

### Step 9: Initialize Database
- [ ] Run: `python seed_database.py`
- [ ] Note sample users created

### Step 10: Create Salespeople
- [ ] For each Azure AD user, create matching database record
- [ ] Email must match Azure AD email EXACTLY

**Option A: Use seed data (if emails match)**
- [ ] Seed script already created salespeople

**Option B: Create manually**
```python
from database import SessionLocal, Salesperson
db = SessionLocal()

salesperson = Salesperson(
    location_id=1,
    email="user@company.com",  # Must match Azure AD
    password_hash="",  # Not used for Azure AD users
    first_name="John",
    last_name="Smith",
    is_active=True
)
db.add(salesperson)
db.commit()
db.close()
```

**Option C: Enable auto-provisioning**
- [ ] Edit `services/azure_ad_auth.py`
- [ ] Uncomment auto-provisioning code in `get_or_create_salesperson_from_azure()`
- [ ] Set `DEFAULT_LOCATION_ID` in `.env`

---

## 🧪 Testing

### Step 11: Start Backend
- [ ] Open terminal in `loan-intake-backend`
- [ ] Run: `python main.py`
- [ ] Check for "Database initialized" message
- [ ] Check for "Authentication: Azure AD B2C" message
- [ ] Verify no errors
- [ ] Backend running on: http://localhost:8000

### Step 12: Start Frontend
- [ ] Open terminal in `loan-intake-frontend`
- [ ] Run: `npm start`
- [ ] Verify no errors
- [ ] Frontend running on: http://localhost:3000

### Step 13: Test Login Flow
- [ ] Open browser to http://localhost:3000
- [ ] Click "Sign in with Microsoft" button
- [ ] Should redirect to Azure AD B2C login page
  - URL should contain: `.b2clogin.com`
  - Should show your tenant name
  - Should show user flow name
- [ ] Enter Azure AD credentials
  - Use test user created in Step 6
  - Or use production user
- [ ] Complete MFA if enabled
- [ ] Should redirect back to frontend
  - URL: `http://localhost:3000/auth/callback?token=...`
  - Should see application load
  - Should see user name in header

### Step 14: Test API Authentication
- [ ] Try to submit a loan application
- [ ] Should work without errors
- [ ] Check backend logs for token verification
- [ ] View "Applications" tab
- [ ] Verify application appears in list

### Step 15: Test Authorization
- [ ] Login as User A (Location 1)
- [ ] Submit an application
- [ ] Note application number
- [ ] Logout
- [ ] Login as User B (same Location 1)
- [ ] Should see User A's application in "Location Applications"
- [ ] Logout
- [ ] Login as User C (different Location 2)
- [ ] Should NOT see User A's application

---

## 🔒 Security Verification

### Step 16: Verify Token Security
- [ ] Check browser DevTools → Network
- [ ] Verify requests use HTTPS in production
- [ ] Verify Authorization header present
- [ ] Verify token format: `Bearer eyJ...`

### Step 17: Test Expired Token
- [ ] Wait for token to expire (default 1 hour)
- [ ] Try to use application
- [ ] Should get 401 Unauthorized
- [ ] Should redirect to login

### Step 18: Test Invalid Token
- [ ] Edit token in localStorage
- [ ] Try to use application
- [ ] Should get 401 Unauthorized
- [ ] Should redirect to login

---

## 🚀 Production Preparation

### Step 19: Production Azure Config
- [ ] Create production Azure AD B2C tenant (if different)
- [ ] Register production application
- [ ] Add production redirect URI: `https://yourdomain.com/auth/callback`
- [ ] Enable MFA requirement
- [ ] Configure conditional access policies
- [ ] Set up custom domain (optional)

### Step 20: Production Backend
- [ ] Set production environment variables
- [ ] Change DATABASE_URL to PostgreSQL
- [ ] Enable HTTPS only
- [ ] Configure CORS for production domain
- [ ] Add rate limiting
- [ ] Enable logging
- [ ] Set up monitoring

### Step 21: Production Frontend
- [ ] Update API URLs to production
- [ ] Build production bundle: `npm run build`
- [ ] Deploy to hosting
- [ ] Verify HTTPS certificate

### Step 22: Production Testing
- [ ] Test login flow in production
- [ ] Test application submission
- [ ] Test multi-user scenarios
- [ ] Load test authentication
- [ ] Verify monitoring/logging

---

## 📊 Monitoring & Maintenance

### Step 23: Set Up Monitoring
- [ ] Enable Azure AD B2C sign-in logs
- [ ] Set up Application Insights
- [ ] Configure alerts for:
  - [ ] Failed authentications
  - [ ] Token verification errors
  - [ ] High latency
  - [ ] Error rates

### Step 24: Regular Maintenance
- [ ] Rotate client secrets every 6-12 months
- [ ] Review user accounts quarterly
- [ ] Check for Azure AD updates
- [ ] Monitor authentication logs
- [ ] Review conditional access policies

---

## 🆘 Troubleshooting Reference

### Common Issues:

**"No email found in Azure AD token"**
- [ ] Check user flow return claims include email
- [ ] Verify user has email in Azure AD profile

**"Salesperson not found"**
- [ ] Verify user exists in database
- [ ] Check email matches exactly (case-insensitive)
- [ ] Verify is_active = true

**"Invalid redirect URI"**
- [ ] Check Azure Portal redirect URI matches exactly
- [ ] Include http:// or https://
- [ ] Match port number
- [ ] Check for trailing slash

**"Token verification failed"**
- [ ] Verify tenant name correct
- [ ] Check policy name (B2C_1_signupsignin)
- [ ] Ensure backend can reach Azure API
- [ ] Check client ID matches

**"CORS error"**
- [ ] Add frontend URL to backend CORS config
- [ ] Check both http://localhost:3000 AND http://localhost:3001

---

## ✅ Completion Checklist

Mark when fully complete:

- [ ] All Azure configuration done
- [ ] All environment variables set
- [ ] All dependencies installed
- [ ] Database initialized with users
- [ ] Login flow tested successfully
- [ ] Application submission tested
- [ ] Authorization tested
- [ ] Security verified
- [ ] Production deployment ready
- [ ] Monitoring configured

---

## 📚 Reference Documents

- **Setup Guide**: [AZURE_AD_SETUP.md](./AZURE_AD_SETUP.md)
- **Migration Summary**: [MIGRATION_SUMMARY.md](./MIGRATION_SUMMARY.md)
- **Quick Start**: [MIGRATION_COMPLETE.md](./MIGRATION_COMPLETE.md)
- **Architecture**: [ARCHITECTURE_AZURE_AD.md](./ARCHITECTURE_AZURE_AD.md)

---

**Estimated Setup Time:**
- Azure configuration: 30-45 minutes
- Backend setup: 10 minutes
- Testing: 15 minutes
- **Total: ~60-70 minutes**

Good luck! 🚀
