# Multi-Tenant API Features

## Overview
The loan intake system now has complete multi-tenant architecture where each salesperson belongs to a location and vendor, with proper data isolation.

## Multi-Tenant Hierarchy
```
Vendor (e.g., Green Valley Equipment)
  └─ Location 1 (e.g., Des Moines)
      ├─ Salesperson A
      ├─ Salesperson B
  └─ Location 2 (e.g., Ames)
      ├─ Salesperson C
```

## API Endpoints

### Authentication
- `GET /auth/login` - Redirect to Microsoft Entra External ID login
- `GET /auth/callback` - Handle OAuth callback
- `POST /auth/verify` - Verify token and get user info
- `GET /auth/profile` - Get current user's profile with vendor/location context

### Loan Applications (Multi-Tenant)

#### Individual Access
- `POST /loans/submit` - Submit loan application (auto-associates with salesperson/location)
- `GET /loans/my-applications` - Get ONLY current user's applications
  - Query params: `status_filter`, `limit`

#### Location-Level Access (Team View)
- `GET /loans/location-applications` - Get all applications from user's location
  - Allows team members at same branch to see each other's work
  - Query params: `status_filter`, `limit`

#### Vendor-Level Access (Management View)
- `GET /loans/vendor-applications` - Get all applications from all locations of vendor
  - Useful for regional managers to see entire dealer network
  - Query params: `status_filter`, `limit`

#### Application Details
- `GET /loans/{application_id}` - Get application details
  - **Access control**: Only accessible by salespeople from same location

### Statistics (Multi-Tenant)

- `GET /loans/stats/my-stats` - Personal statistics
  - Total applications
  - Breakdown by status
  
- `GET /loans/stats/location-stats` - Location-level statistics
  - Total for location
  - By status
  - By salesperson

- `GET /loans/stats/vendor-stats` - Vendor-level statistics
  - Total for entire vendor
  - By status
  - By location

## Data Isolation Rules

1. **Salesperson Level**: Users can always see their own data
2. **Location Level**: Users can see data from colleagues at same location
3. **Vendor Level**: Users can see data from all locations under their vendor
4. **Cross-Vendor**: Users CANNOT see data from other vendors

## Example Usage

### 1. Login and Get Profile
```bash
# Login via browser
curl http://localhost:8000/auth/login

# After authentication, use token
curl -H "Authorization: Bearer YOUR_TOKEN" \
     http://localhost:8000/auth/profile
```

### 2. Submit Application
```bash
curl -X POST http://localhost:8000/loans/submit \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "borrower_data": {"firstName": "John", "lastName": "Doe"},
    "loan_data": {"amount": 50000, "purpose": "Equipment Purchase"}
  }'
```

### 3. View My Applications
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
     http://localhost:8000/loans/my-applications
```

### 4. View Location Applications (Team)
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
     http://localhost:8000/loans/location-applications
```

### 5. View Vendor Applications (Management)
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
     http://localhost:8000/loans/vendor-applications
```

### 6. Get Statistics
```bash
# Personal stats
curl -H "Authorization: Bearer YOUR_TOKEN" \
     http://localhost:8000/loans/stats/my-stats

# Location stats
curl -H "Authorization: Bearer YOUR_TOKEN" \
     http://localhost:8000/loans/stats/location-stats

# Vendor stats
curl -H "Authorization: Bearer YOUR_TOKEN" \
     http://localhost:8000/loans/stats/vendor-stats
```

## Security Features

1. **Azure AD Token Validation**: Every request validates Microsoft Entra External ID token
2. **Automatic Association**: Applications automatically linked to authenticated user
3. **Location-Based Access Control**: Users can only view applications from their location
4. **Case-Insensitive Email Lookup**: Handles email variations
5. **Session Refresh**: Database session refreshed to ensure latest data

## Testing Multi-Tenant Scenario

1. **Create Test Users in Different Locations**:
   - User A at Location 1 (Des Moines)
   - User B at Location 1 (Des Moines) - same location as A
   - User C at Location 2 (Ames) - different location

2. **Expected Behavior**:
   - User A can see their own applications
   - User A can see User B's applications (same location)
   - User A CANNOT see User C's applications (different location)
   - All users can see vendor-wide data if querying vendor endpoint

## Database Schema
- `vendors` - Dealer organizations
- `locations` - Physical branches
- `salespeople` - Users (linked to Azure AD, assigned to location)
- `loan_applications` - Applications (linked to salesperson and location)
