# Debugging Guide - Loan Intake Application

## Quick Reference: Common Issues

### Authentication Failures
- **Symptom**: "Could not validate credentials"
- **Check**: Backend logs for token validation details
- **Check**: Browser console for token storage
- **Check**: Network tab for token being sent in Authorization header

### Backend Not Starting
- **Check**: Port 8000 in use: `Get-NetTCPConnection -LocalPort 8000`
- **Fix**: Kill process: `Stop-Process -Id (Get-NetTCPConnection -LocalPort 8000).OwningProcess -Force`

### Frontend Not Loading
- **Check**: Port 3000 in use: `Get-NetTCPConnection -LocalPort 3000`
- **Check**: npm dependencies installed: `npm install`

---

## Best Practices for Development

### 1. **Always Run Backend in Foreground**

**DON'T DO THIS:**
```powershell
Start-Process python -ArgumentList "main.py" -WindowStyle Minimized
```

**DO THIS INSTEAD:**
```powershell
cd c:\FarmEquipment\loan-intake-backend
python main.py
```

**Why?** You'll see errors immediately in the console.

---

### 2. **Use Separate Terminal Windows**

**Setup:**
1. **Terminal 1**: Backend (keep visible)
   ```powershell
   cd c:\FarmEquipment\loan-intake-backend
   python main.py
   ```

2. **Terminal 2**: Frontend (keep visible)
   ```powershell
   cd c:\FarmEquipment\loan-intake-frontend
   npm start
   ```

3. **Terminal 3**: Testing/debugging commands

---

### 3. **Check Browser Developer Tools**

**Every time you test:**

1. **Console Tab** (F12 → Console)
   - Look for 🔐 auth token logs
   - Look for API request logs
   - Look for error messages

2. **Network Tab** (F12 → Network)
   - Filter for "fetch/XHR"
   - Check each API request:
     - Request Headers (Authorization header present?)
     - Request Payload (data being sent)
     - Response (status code, error details)

3. **Application Tab** (F12 → Application)
   - Local Storage → http://localhost:3000
   - Verify `auth_token` is stored
   - Copy token value for testing

---

### 4. **Backend Request Logging**

The backend now logs every request automatically:

```
============================================================
🔵 INCOMING REQUEST
============================================================
Method: POST
URL: /loans/submit
Query Params: {}
Headers: {...}
🔑 Auth Token (first 50 chars): eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsImtpZCI6IkM...
============================================================
🟢 RESPONSE
============================================================
Status: 401
Duration: 0.25s
============================================================
```

**What to look for:**
- ✅ Authorization header present?
- ✅ Token looks valid (JWT format)?
- ❌ 401 status = auth failure
- ❌ 500 status = server error

---

### 5. **Token Validation Debugging**

When you see "Could not validate credentials":

**Step 1: Check Backend Logs**
Look for:
```
=== TOKEN VERIFICATION DEBUG ===
Token (first 50 chars): eyJ0eXAiOiJKV1Q...
Expected audience: 7b806553-49d6-43c5-8f9f-e65e7cc8df57
Expected issuer: https://AssetFinanceOriginators.ciamlogin.com/...
Token issuer claim (iss): <actual issuer>
Token audience claim (aud): <actual audience>
❌ Token verification failed: <error details>
```

**Step 2: Compare Claims**
- Does token `aud` match `AZURE_AD_CLIENT_ID`?
- Does token `iss` match expected issuer?
- Is token expired? Check `exp` claim

**Step 3: Test Token Manually**
```powershell
$token = 'PASTE_YOUR_TOKEN_HERE'
$headers = @{Authorization = "Bearer $token"}
Invoke-RestMethod -Uri 'http://localhost:8000/debug/test-token' -Method Post -Headers $headers | ConvertTo-Json -Depth 5
```

---

### 6. **Quick Debugging Commands**

**Check what's running:**
```powershell
Get-NetTCPConnection -LocalPort 8000,3000 -ErrorAction SilentlyContinue | Format-Table LocalPort, State, OwningProcess
```

**Check Python processes:**
```powershell
Get-Process python -ErrorAction SilentlyContinue | Format-Table Id, ProcessName
```

**Test backend is responding:**
```powershell
Invoke-RestMethod -Uri 'http://localhost:8000/docs'
```

**Test Azure auth endpoint:**
```powershell
Invoke-RestMethod -Uri 'http://localhost:8000/auth/login' -MaximumRedirection 0
```

---

### 7. **Common Mistakes That Waste Time**

❌ **Running backend minimized** → Can't see errors  
✅ **Run in visible terminal**

❌ **Not checking browser console** → Miss client-side errors  
✅ **Always have DevTools open**

❌ **Not verifying token format** → Wrong token type (access vs id)  
✅ **Check token structure matches expectations**

❌ **Testing with old tokens** → Cached auth fails  
✅ **Sign out and sign in fresh**

❌ **Not reading backend logs** → Miss validation failures  
✅ **Watch backend terminal for detailed logs**

---

### 8. **Debugging Workflow**

When something breaks:

1. **Check backend terminal** - What error do you see?
2. **Check frontend console** - Any JavaScript errors?
3. **Check Network tab** - What's the HTTP status code?
4. **Check backend logs** - What's the detailed error?
5. **Check environment variables** - Are they loaded correctly?

---

### 9. **Testing Token Flow**

**Complete token flow test:**

1. **Login** → Check console for "🔐 SAVING AUTH TOKEN"
2. **Refresh page** → Check console for "🔐 LOADED AUTH TOKEN"
3. **Make API call** → Check backend for "🔵 INCOMING REQUEST" with token
4. **Check validation** → Look for "✓ Token verified successfully"

**If any step fails, that's where the issue is.**

---

### 10. **Environment Variable Issues**

**Problem:** Settings not loading  
**Debug:**
```python
# Add to main.py startup
import os
print(f"AZURE_AD_CLIENT_ID: {os.getenv('AZURE_AD_CLIENT_ID')}")
print(f"AZURE_AD_TENANT_NAME: {os.getenv('AZURE_AD_TENANT_NAME')}")
print(f"FRONTEND_URL: {os.getenv('FRONTEND_URL')}")
```

**Common causes:**
- `.env` file not in backend root
- `load_dotenv()` not called first
- Module-level variables read before `load_dotenv()`

---

## Tools to Install

### Python Debugging
```bash
pip install ipdb  # Interactive debugger
```

Usage:
```python
import ipdb; ipdb.set_trace()  # Add breakpoint
```

### VS Code Extensions
- **REST Client** - Test API endpoints directly in VS Code
- **Thunder Client** - Postman alternative
- **Python** - Debugging support

---

## Quick Wins

### 1. Create a test script
```python
# test_auth_flow.py
import requests

# Test login redirect
response = requests.get('http://localhost:8000/auth/login', allow_redirects=False)
print(f"Login redirect: {response.headers.get('Location')}")

# Test token validation
token = "YOUR_TOKEN_HERE"
response = requests.post(
    'http://localhost:8000/debug/test-token',
    headers={'Authorization': f'Bearer {token}'}
)
print(f"Token valid: {response.json()}")
```

### 2. Add a health check endpoint
```python
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "tenant": os.getenv("AZURE_AD_TENANT_NAME"),
        "client_id": os.getenv("AZURE_AD_CLIENT_ID")[:10] + "...",
        "auth_type": "CIAM"
    }
```

### 3. Browser bookmark for quick access
- Backend API Docs: http://localhost:8000/docs
- Frontend: http://localhost:3000
- Backend Health: http://localhost:8000/health

---

## What We Learned From This Session

### The Problem
Backend was sending `access_token` instead of `id_token`, causing validation to fail.

### Why It Was Hard to Debug
1. Backend running minimized - couldn't see logs
2. No request logging - didn't see what token was being sent
3. No frontend logging - didn't see what token was stored
4. No comparison of expected vs actual token claims

### The Fix
1. Changed backend to send `id_token` instead of `access_token`
2. Added comprehensive logging at every step
3. Added token validation debugging

### Time Saved Next Time
With proper logging in place: **5 minutes instead of 2 hours**

---

## Emergency Reset

If everything is broken:

```powershell
# Stop everything
Get-Process python -ErrorAction SilentlyContinue | Stop-Process -Force
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force

# Clear browser cache and localStorage
# In browser: F12 → Application → Clear Storage → Clear Site Data

# Restart backend (visible terminal)
cd c:\FarmEquipment\loan-intake-backend
python main.py

# Restart frontend (separate terminal)
cd c:\FarmEquipment\loan-intake-frontend
npm start

# Test login flow from scratch
```

---

## Summary

**The key to fast debugging:**
1. ✅ Visible terminals with logs
2. ✅ Browser DevTools always open
3. ✅ Comprehensive logging at each step
4. ✅ Test endpoints for manual verification
5. ✅ Compare expected vs actual values

**Most issues are visible within 30 seconds if you can see the logs!**
