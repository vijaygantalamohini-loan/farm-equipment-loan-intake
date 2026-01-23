# Multi-Tenant Implementation Guide

## Overview
This guide explains how to implement the multi-location, multi-salesperson system for your loan intake application.

## Architecture Summary

**Hierarchy:**
```
Vendor (Dealer) → Multiple Locations → Multiple Salespeople → Loan Applications
```

**Key Features:**
- ✅ Vendor management with multiple locations
- ✅ Location-specific accounts
- ✅ 4-6+ salespeople per location
- ✅ Authentication with JWT tokens
- ✅ Access control (salespeople see only their location's data)
- ✅ Application tracking and history

## Backend Setup (Already Created)

### Files Created:
1. **database.py** - SQLAlchemy models and database setup
2. **services/auth_service.py** - Authentication logic (password hashing, JWT tokens)
3. **routers/auth_routes.py** - Login endpoints
4. **routers/loan_routes.py** - Loan submission and viewing
5. **routers/admin_routes.py** - Vendor/location/salesperson management
6. **seed_database.py** - Sample data generator
7. **MULTI_TENANT_SETUP.md** - Detailed backend documentation

### Installation Steps:

```bash
cd c:\FarmEquipment\loan-intake-backend

# Install new dependencies
pip install sqlalchemy passlib[bcrypt] python-jose[cryptography]

# Initialize database and create sample data
python seed_database.py

# Restart server (it will auto-create tables on startup)
python main.py
```

### Sample Accounts (after running seed_database.py):

**Green Valley Equipment - Des Moines:**
- john.smith@greenvalley.com / password123
- sarah.jones@greenvalley.com / password123

**Green Valley Equipment - Ames:**
- tom.brown@greenvalley.com / password123

**Red Power Equipment - Cedar Rapids:**
- mary.wilson@redpower.com / password123
- david.lee@redpower.com / password123

## Frontend Setup (Partially Created)

### Files Created:
1. **src/components/Login.js** - Login page component
2. **src/components/Login.css** - Login styling
3. **src/components/ApplicationHistory.js** - View submitted applications
4. **src/components/ApplicationHistory.css** - History styling

### Required Changes to Existing Files:

#### 1. Update App.js

Add authentication state and routing:

```javascript
import React, { useState, useEffect } from 'react';
import './App.css';
import LoanApplicationWizard from './LoanApplicationWizard';
import Login from './components/Login';
import ApplicationHistory from './components/ApplicationHistory';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [salesperson, setSalesperson] = useState(null);
  const [currentView, setCurrentView] = useState('wizard'); // 'wizard' or 'history'

  useEffect(() => {
    // Check if already logged in
    const token = localStorage.getItem('access_token');
    const savedSalesperson = localStorage.getItem('salesperson');
    
    if (token && savedSalesperson) {
      setIsAuthenticated(true);
      setSalesperson(JSON.parse(savedSalesperson));
    }
  }, []);

  const handleLoginSuccess = (salespersonData) => {
    setIsAuthenticated(true);
    setSalesperson(salespersonData);
  };

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('salesperson');
    setIsAuthenticated(false);
    setSalesperson(null);
    setCurrentView('wizard');
  };

  if (!isAuthenticated) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="App">
      {/* Header with salesperson info */}
      <header className="app-header">
        <div className="header-left">
          <h2>Loan Intake Portal</h2>
          {salesperson && (
            <span className="user-badge">
              {salesperson.first_name} {salesperson.last_name} - {salesperson.location_name}
            </span>
          )}
        </div>
        <div className="header-right">
          <button
            className={`nav-btn ${currentView === 'wizard' ? 'active' : ''}`}
            onClick={() => setCurrentView('wizard')}
          >
            New Application
          </button>
          <button
            className={`nav-btn ${currentView === 'history' ? 'active' : ''}`}
            onClick={() => setCurrentView('history')}
          >
            Applications
          </button>
          <button className="logout-btn" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="app-main">
        {currentView === 'wizard' ? (
          <LoanApplicationWizard salesperson={salesperson} />
        ) : (
          <ApplicationHistory />
        )}
      </main>
    </div>
  );
}

export default App;
```

#### 2. Update App.css

Add header styles:

```css
/* Add to existing App.css */

.app-header {
  background: white;
  border-bottom: 2px solid #e0e0e0;
  padding: 15px 30px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}

.header-left h2 {
  margin: 0 0 5px 0;
  color: #333;
  font-size: 20px;
}

.user-badge {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 600;
}

.header-right {
  display: flex;
  gap: 10px;
  align-items: center;
}

.nav-btn {
  padding: 10px 20px;
  border: 2px solid #667eea;
  background: white;
  color: #667eea;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
}

.nav-btn.active,
.nav-btn:hover {
  background: #667eea;
  color: white;
}

.logout-btn {
  padding: 10px 20px;
  border: 2px solid #e74c3c;
  background: white;
  color: #e74c3c;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
}

.logout-btn:hover {
  background: #e74c3c;
  color: white;
}

.app-main {
  min-height: calc(100vh - 80px);
  background: #f5f5f5;
}
```

#### 3. Update LoanApplicationWizard.js

Modify the submit function to include authentication and use new endpoint:

```javascript
// In LoanApplicationWizard.js, update the handleFinalSubmit function:

const handleFinalSubmit = async () => {
  try {
    // Get authentication token
    const token = localStorage.getItem('access_token');
    if (!token) {
      alert('Session expired. Please login again.');
      window.location.reload();
      return;
    }

    // Prepare loan data
    const loanData = {
      borrower_data: {
        ...borrower,
        address: borrowerAddress
      },
      coborrower_data: hasCoBorrower ? {
        ...coBorrower,
        address: coBorrowerAddress
      } : null,
      loan_data: {
        loanPurpose: loanPurpose,
        loanAmount: loanAmount,
        naicsCode: naicsCode,
        naicsDescription: naicsDescription,
        purchaseEquipment: purchaseEquipment,
        tradeInEquipment: tradeInEquipment,
        equipmentDetails: equipmentDetails
      },
      dealer_data: dealerInfo
    };

    // Submit to authenticated endpoint
    const response = await fetch('http://localhost:8000/loans/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(loanData)
    });

    if (!response.ok) {
      throw new Error('Submission failed');
    }

    const result = await response.json();
    
    alert(`Application submitted successfully!\n\nApplication Number: ${result.application_number}\n\nYou can view it in the Applications tab.`);
    
    // Reset form or redirect
    // Option 1: Reset to step 1
    setCurrentStep(1);
    // Option 2: Or switch to history view
    // props.onViewChange && props.onViewChange('history');
    
  } catch (err) {
    console.error('Submission error:', err);
    alert('Failed to submit application. Please try again.');
  }
};
```

## Testing the System

### 1. Backend Testing

```bash
# Start backend
cd c:\FarmEquipment\loan-intake-backend
python main.py

# In a new terminal, test login:
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=john.smith@greenvalley.com&password=password123"

# Should return:
# {
#   "access_token": "eyJ...",
#   "token_type": "bearer",
#   "salesperson": {...}
# }
```

### 2. Frontend Testing

```bash
# Start frontend
cd c:\FarmEquipment\loan-intake-frontend
npm start
```

**Test Flow:**
1. Login with john.smith@greenvalley.com / password123
2. Should see header with name and location
3. Fill out loan application
4. Submit application
5. Click "Applications" tab to see submitted application
6. Login as sarah.jones@greenvalley.com (same location)
7. Should see John's application in "Location Applications"
8. Login as tom.brown@greenvalley.com (different location)
9. Should NOT see John's application

## Adding New Vendors/Locations/Salespeople

### Option 1: Via API (Postman/curl)

```bash
# Create vendor
curl -X POST http://localhost:8000/admin/vendors \
  -H "Content-Type: application/json" \
  -d '{"name": "ABC Equipment", "phone": "555-1234"}'

# Create location
curl -X POST http://localhost:8000/admin/locations \
  -H "Content-Type: application/json" \
  -d '{
    "vendor_id": 1,
    "location_name": "Cedar Falls",
    "city": "Cedar Falls",
    "state": "IA"
  }'

# Create salesperson
curl -X POST http://localhost:8000/admin/salespeople \
  -H "Content-Type: application/json" \
  -d '{
    "location_id": 1,
    "email": "jane.doe@abc.com",
    "password": "password123",
    "first_name": "Jane",
    "last_name": "Doe"
  }'
```

### Option 2: Via Database Script

Create `add_salesperson.py`:

```python
from database import SessionLocal, Salesperson
from services.auth_service import hash_password

db = SessionLocal()

new_salesperson = Salesperson(
    location_id=1,  # Change to your location ID
    email="new.person@dealer.com",
    password_hash=hash_password("password123"),
    first_name="New",
    last_name="Person",
    phone="555-1234"
)

db.add(new_salesperson)
db.commit()
print("Salesperson added!")
db.close()
```

## Security Notes

⚠️ **IMPORTANT for Production:**

1. **Change SECRET_KEY** in `services/auth_service.py`
   ```python
   SECRET_KEY = os.getenv("SECRET_KEY", "your-actual-secret-key-here")
   ```
   Generate with: `python -c "import secrets; print(secrets.token_hex(32))"`

2. **Use PostgreSQL** instead of SQLite
   Set environment variable:
   ```
   DATABASE_URL=postgresql://user:password@localhost/loan_intake
   ```

3. **Protect Admin Endpoints**
   Add authentication middleware to `/admin/*` routes

4. **Enable HTTPS**
   Use SSL certificates in production

5. **Add Rate Limiting**
   Prevent brute force login attempts

## Troubleshooting

**Problem: "Module not found: sqlalchemy"**
```bash
pip install sqlalchemy passlib[bcrypt] python-jose[cryptography]
```

**Problem: "Database locked"**
- SQLite issue with multiple processes
- Solution: Switch to PostgreSQL for production

**Problem: "401 Unauthorized"**
- Token expired (8 hours by default)
- Solution: Login again or increase `ACCESS_TOKEN_EXPIRE_MINUTES`

**Problem: Can't see other location's applications**
- This is by design for security
- Only location teammates can see each other's applications

## Next Steps

1. ✅ Install backend dependencies
2. ✅ Run `seed_database.py` to create sample data
3. ✅ Restart backend server
4. ✅ Update frontend App.js with authentication
5. ✅ Update LoanApplicationWizard.js submit function
6. ✅ Test login flow
7. ✅ Test application submission
8. ✅ Test application history
9. ⏳ Add admin UI for managing users (optional)
10. ⏳ Deploy to production

## Questions?

See [MULTI_TENANT_SETUP.md](./MULTI_TENANT_SETUP.md) for detailed backend documentation.
