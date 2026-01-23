# Azure AD B2C Setup Guide

This guide shows how to configure Azure AD B2C authentication for the loan intake system.

## Why Azure AD B2C?

✅ **Enterprise-grade security** - Microsoft manages authentication  
✅ **Multi-factor authentication** - SMS, email, authenticator app  
✅ **Social login** - Google, Facebook, Microsoft accounts  
✅ **Single Sign-On** - One login across multiple apps  
✅ **Self-service** - Password reset, profile management  
✅ **Compliance** - SOC 2, HIPAA, GDPR compliant  
✅ **Scalability** - Handles millions of users  

## Architecture Comparison

### Current (JWT + Database)
```
User → Login Form → Backend checks password → Generate JWT → Store in localStorage
```

### With Azure AD B2C
```
User → Azure AD Login Page → Azure validates → Redirect with token → Backend verifies → Map to salesperson
```

## Azure AD B2C Setup Steps

### 1. Create Azure AD B2C Tenant

1. Go to [Azure Portal](https://portal.azure.com)
2. Search for "Azure AD B2C"
3. Click "Create a resource" → "Azure AD B2C"
4. Click "Create a new Azure AD B2C Tenant"
5. Fill in:
   - Organization name: `Your Company Name`
   - Initial domain name: `yourcompany` (becomes yourcompany.onmicrosoft.com)
   - Country: `United States`
6. Click "Create" (takes 2-3 minutes)

### 2. Register Application

1. In your B2C tenant, go to "App registrations"
2. Click "New registration"
3. Fill in:
   - Name: `Loan Intake Portal`
   - Supported account types: `Accounts in any identity provider or organizational directory (for authenticating users with user flows)`
   - Redirect URI: 
     - Platform: `Web`
     - URI: `http://localhost:8000/auth/callback` (development)
     - For production: `https://yourdomain.com/auth/callback`
4. Click "Register"
5. **Save the Application (client) ID** - you'll need this

### 3. Create Client Secret

1. In your app registration, go to "Certificates & secrets"
2. Click "New client secret"
3. Description: `Loan Intake Backend`
4. Expires: `24 months` (or your preference)
5. Click "Add"
6. **Copy the secret VALUE immediately** (you can't see it again!)

### 4. Configure API Permissions

1. Go to "API permissions"
2. Click "Add a permission"
3. Select "Microsoft Graph"
4. Select "Delegated permissions"
5. Add these permissions:
   - `openid`
   - `profile`
   - `email`
   - `User.Read`
6. Click "Add permissions"
7. Click "Grant admin consent" (if you're admin)

### 5. Create User Flow

User flows define the login experience.

1. Go to "User flows" in Azure AD B2C
2. Click "New user flow"
3. Select "Sign up and sign in"
4. Version: `Recommended`
5. Name: `signupsignin` (results in B2C_1_signupsignin)
6. Identity providers:
   - ✅ Email signup
   - ✅ (Optional) Social accounts: Google, Facebook, Microsoft
7. User attributes and claims to collect/return:
   - ✅ Email Address (collect and return)
   - ✅ Given Name (collect and return)
   - ✅ Surname (collect and return)
   - ✅ Display Name (return)
8. Click "Create"

### 6. Add Users (Optional)

For testing, add some users:

1. Go to "Users" in Azure AD B2C
2. Click "New user"
3. Select "Create Azure AD B2C user"
4. Fill in:
   - Email: `john.smith@yourcompany.com`
   - Name: `John Smith`
   - Password: (auto-generate or set)
5. Click "Create"

### 7. Configure Backend

Update your `.env` file:

```bash
# Get these from Azure Portal
AZURE_AD_TENANT_NAME=yourcompany  # From step 1 (initial domain name)
AZURE_AD_B2C_TENANT_ID=12345678-1234-1234-1234-123456789abc  # Tenant ID (Directory ID)
AZURE_AD_CLIENT_ID=87654321-4321-4321-4321-abcdefghijkl  # Application ID from step 2
AZURE_AD_CLIENT_SECRET=your~secret~value~from~step~3  # Secret value from step 3
AZURE_AD_POLICY_NAME=B2C_1_signupsignin  # User flow name from step 5

FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:8000
```

### 8. Update main.py

Add Azure auth routes:

```python
from routers import auth_routes, azure_auth_routes

# Include both authentication methods
app.include_router(auth_routes.router)  # Username/password (existing)
app.include_router(azure_auth_routes.router)  # Azure AD B2C (new)
```

### 9. Install Dependencies

```bash
pip install requests python-jose[cryptography]
```

### 10. Test Authentication

Start backend:
```bash
python main.py
```

Test Azure login flow:
1. Navigate to: `http://localhost:8000/auth/azure/login`
2. Should redirect to Azure AD B2C login page
3. Login with test user
4. Should redirect back to frontend with token

## Frontend Integration

### Option 1: Azure AD Login Button

Update `Login.js` to add Azure button:

```javascript
function Login({ onLoginSuccess }) {
  // ... existing username/password form ...
  
  const handleAzureLogin = () => {
    // Redirect to Azure AD
    window.location.href = 'http://localhost:8000/auth/azure/login';
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h1>Loan Intake Portal</h1>
        
        {/* Azure AD Login */}
        <button onClick={handleAzureLogin} className="azure-login-btn">
          <img src="/microsoft-logo.png" alt="Microsoft" />
          Sign in with Microsoft
        </button>
        
        <div className="divider">OR</div>
        
        {/* Existing email/password form */}
        <form onSubmit={handleSubmit}>
          {/* ... existing form ... */}
        </form>
      </div>
    </div>
  );
}
```

### Option 2: Callback Handler

Create `src/components/AzureCallback.js`:

```javascript
import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

function AzureCallback({ onLoginSuccess }) {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const token = params.get('token');
    const salespersonData = params.get('salesperson');
    
    if (token && salespersonData) {
      // Store token
      localStorage.setItem('access_token', token);
      localStorage.setItem('salesperson', salespersonData);
      
      // Parse salesperson data
      const salesperson = JSON.parse(salespersonData);
      onLoginSuccess(salesperson);
      
      // Redirect to main app
      navigate('/');
    } else {
      // Handle error
      const error = params.get('error');
      const message = params.get('message');
      alert(message || 'Login failed');
      navigate('/login');
    }
  }, [location, navigate, onLoginSuccess]);

  return <div>Processing login...</div>;
}

export default AzureCallback;
```

## User Provisioning Strategy

You have two options for handling Azure AD users:

### Option 1: Pre-provision (Strict) - RECOMMENDED

**How it works:**
- Admin creates salespeople in database first
- Admin creates matching Azure AD users
- Users must exist in both systems
- Login fails if user not in database

**Advantages:**
- Full control over who can access
- Explicit location assignment
- No surprise users

**Implementation:**
Already implemented in `azure_ad_auth.py` (default behavior)

### Option 2: Auto-provision (Lenient)

**How it works:**
- Any Azure AD user can login
- System auto-creates salesperson record
- Assigns to default location
- Good for large organizations

**Advantages:**
- No manual setup per user
- Immediate access for new hires

**Implementation:**
Uncomment code in `azure_ad_auth.py` function `get_or_create_salesperson_from_azure()`

## Hybrid Approach (Both Authentication Methods)

Support both username/password AND Azure AD:

**Username/Password users:**
- Use `/auth/login` endpoint
- Get JWT token from backend
- Good for external partners

**Azure AD users:**
- Use `/auth/azure/login` endpoint
- Get Azure AD token
- Good for employees

**Backend supports both:**
```python
# In loan_routes.py, update dependency:
from routers.auth_routes import get_current_salesperson
from routers.azure_auth_routes import get_current_salesperson_azure

# Try Azure first, fall back to JWT
async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
):
    # Try Azure token first
    try:
        return await get_current_salesperson_azure(token, db)
    except:
        pass
    
    # Fall back to JWT token
    return await get_current_salesperson(token, db)
```

## Security Best Practices

1. **Use HTTPS in production** - Required for OAuth2
2. **Validate redirect URIs** - Prevent token theft
3. **Store secrets securely** - Use Azure Key Vault
4. **Enable MFA** - Require second factor
5. **Set token expiration** - Default 1 hour is good
6. **Rotate client secrets** - Every 6-12 months
7. **Monitor sign-ins** - Azure AD logs all attempts
8. **Conditional access** - Restrict by IP, device, location

## Troubleshooting

**Error: "AADB2C90118: The user has forgotten their password"**
- Create password reset user flow
- Add to your app configuration

**Error: "Invalid redirect URI"**
- Check redirect URI matches exactly in Azure portal
- Include trailing slash if needed

**Error: "No email found in token"**
- Ensure email is in user flow return claims
- Check token payload structure

**Error: "CORS policy blocked"**
- Add frontend URL to CORS allowed origins
- Check backend CORS middleware configuration

**Token verification fails:**
- Check tenant name matches
- Verify policy name (B2C_1_signupsignin)
- Ensure signing keys are accessible

## Cost

Azure AD B2C pricing (as of 2024):
- **First 50,000 users/month:** FREE
- **Next 100,000:** $0.0055 per user
- **MFA:** $0.03 per authentication

**For most small to medium dealerships: FREE**

## Migration Path

1. **Phase 1:** Add Azure AD alongside existing auth (hybrid)
2. **Phase 2:** Migrate existing users to Azure AD
3. **Phase 3:** Deprecate username/password login
4. **Phase 4:** Remove old auth code

## Support

- Azure AD B2C Docs: https://docs.microsoft.com/azure/active-directory-b2c/
- Pricing: https://azure.microsoft.com/pricing/details/active-directory-b2c/
- Community: https://docs.microsoft.com/answers/topics/azure-ad-b2c.html
