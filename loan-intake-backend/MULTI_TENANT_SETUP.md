# Multi-Tenant Loan Intake System - Architecture

## System Design

This system supports **multiple vendors (dealers)**, each with **multiple locations**, and each location having **multiple salespeople**.

### Data Model Hierarchy

```
Vendor (Dealer Organization)
  └── Locations (Physical Branches)
        └── Salespeople (Sales Representatives)
              └── Loan Applications
```

## Database Schema

### Vendors Table
- `id`: Primary key
- `name`: Dealer name
- `primary_contact`: Main contact person
- `phone`, `email`: Contact info
- `is_active`: Status flag

### Locations Table
- `id`: Primary key
- `vendor_id`: Foreign key to vendors
- `location_name`: Branch name
- `street`, `city`, `state`, `zip_code`: Address
- `phone`, `email`: Contact info
- `is_active`: Status flag

### Salespeople Table
- `id`: Primary key
- `location_id`: Foreign key to locations
- `email`: Login username (unique)
- `password_hash`: Hashed password
- `first_name`, `last_name`: Name
- `phone`: Contact
- `employee_code`: Optional employee ID
- `is_active`: Status flag
- `last_login`: Last login timestamp

### Loan Applications Table
- `id`: Primary key
- `salesperson_id`: Who submitted it
- `location_id`: Which location
- `application_number`: Unique identifier (e.g., LA-20231220-ABC123)
- `borrower_data`: JSON with borrower info
- `coborrower_data`: JSON with co-borrower (optional)
- `loan_data`: JSON with loan/equipment details
- `dealer_data`: JSON with dealer info
- `status`: submitted, reviewing, approved, denied
- `submitted_at`: Submission timestamp

## Authentication Flow

1. **Salesperson Login**
   - POST `/auth/login` with email and password
   - Returns JWT token + salesperson info
   - Token expires in 8 hours

2. **Protected Endpoints**
   - Include token in header: `Authorization: Bearer <token>`
   - Token contains salesperson ID and location association

3. **Access Control**
   - Salespeople can see their own applications
   - Salespeople can see all applications from their location
   - Cannot see applications from other locations

## API Endpoints

### Authentication (`/auth`)
- `POST /auth/login` - Login with email/password
- `GET /auth/me` - Get current user info

### Loan Management (`/loans`)
- `POST /loans/submit` - Submit new loan application
- `GET /loans/my-applications` - Get my submissions
- `GET /loans/location-applications` - Get all applications from my location
- `GET /loans/{id}` - Get application details (if access allowed)

### Admin Management (`/admin`)
- `POST /admin/vendors` - Create vendor
- `GET /admin/vendors` - List vendors
- `POST /admin/locations` - Create location
- `GET /admin/locations` - List locations (filterable by vendor)
- `POST /admin/salespeople` - Create salesperson
- `GET /admin/salespeople` - List salespeople (filterable by location)
- `PATCH /admin/salespeople/{id}/deactivate` - Deactivate salesperson

### Existing Endpoints (Unchanged)
- `/upload/id` - OCR ID scanning
- `/upload/invoice` - OCR invoice parsing
- `/lookup/serial` - Serial number decoder
- `/lookup/naics` - NAICS code lookup
- `/address/autocomplete` - Address suggestions
- `/dealers/search` - Dealer search (Google Places)

## Setup Instructions

### 1. Install Dependencies
```bash
cd loan-intake-backend
pip install -r requirements.txt
```

### 2. Initialize Database
```bash
python seed_database.py
```

This creates:
- 2 sample vendors
- 3 locations
- 5 salespeople
- All with password: `password123`

### 3. Start Server
```bash
python main.py
```

### 4. Test Login
```bash
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=john.smith@greenvalley.com&password=password123"
```

## Frontend Integration Changes

### 1. Add Login Page
Create `Login.js` component:
- Email input
- Password input
- Login button
- Store JWT token in localStorage
- Redirect to loan form after login

### 2. Update API Calls
Add authentication header to all API calls:
```javascript
const token = localStorage.getItem('access_token');
fetch(url, {
  headers: {
    'Authorization': `Bearer ${token}`
  }
})
```

### 3. Modify Loan Submission
Change `/submit` endpoint to `/loans/submit` and include token.

### 4. Add Application History
Create page to show:
- My applications: `/loans/my-applications`
- Team applications: `/loans/location-applications`

### 5. Auto-populate Salesperson Info
After login, store and display:
- Salesperson name
- Location name
- Vendor name

## Production Considerations

1. **Environment Variables**
   - `SECRET_KEY`: Change from default (use strong random key)
   - `DATABASE_URL`: Switch from SQLite to PostgreSQL
   - Example: `postgresql://user:pass@localhost/loan_intake`

2. **Admin Security**
   - Add admin role/permissions
   - Protect `/admin/*` endpoints with admin middleware
   - Add IP whitelist for admin access

3. **Password Policy**
   - Enforce minimum length (8+ chars)
   - Require complexity (uppercase, lowercase, numbers)
   - Add password reset flow

4. **Rate Limiting**
   - Add rate limiter to prevent brute force
   - Limit login attempts per IP

5. **Logging**
   - Log all login attempts
   - Log loan submissions
   - Track failed authentication

6. **Backup**
   - Regular database backups
   - Store loan documents securely

## Sample Data

After running `seed_database.py`:

**Vendor 1: Green Valley Equipment**
- Location: Des Moines
  - john.smith@greenvalley.com (password123)
  - sarah.jones@greenvalley.com (password123)
- Location: Ames
  - tom.brown@greenvalley.com (password123)

**Vendor 2: Red Power Equipment**
- Location: Cedar Rapids
  - mary.wilson@redpower.com (password123)
  - david.lee@redpower.com (password123)

## Testing Workflow

1. Login as john.smith@greenvalley.com
2. Submit a loan application
3. View in "My Applications"
4. Login as sarah.jones@greenvalley.com (same location)
5. See John's application in "Location Applications"
6. Login as tom.brown@greenvalley.com (different location)
7. Should NOT see John's application
