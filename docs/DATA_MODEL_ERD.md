# Data Model ERD

This document describes the persisted SQLAlchemy tables and the JSON payloads stored inside loan applications.

## Database entities

<!-- AUTO-GENERATED: ERD_START -->
```mermaid
erDiagram
    VENDORS {
        int id PK
        string name
        string primary_contact
        string phone
        string email
        datetime created_at
        boolean is_active
    }

    LOCATIONS {
        int id PK
        int vendor_id FK
        string location_name
        string street
        string city
        string state
        string zip_code
        string phone
        string email
        datetime created_at
        boolean is_active
    }

    SALESPEOPLE {
        int id PK
        int location_id FK
        string email
        string password_hash
        string first_name
        string last_name
        string phone
        string employee_code
        datetime created_at
        boolean is_active
        datetime last_login
    }

    LOAN_APPLICATIONS {
        int id PK
        int salesperson_id FK
        int location_id FK
        json borrower_data
        json coborrower_data
        json loan_data
        json dealer_data
        json documents_and_consents_data
        string status
        string application_number
        datetime submitted_at
        datetime updated_at
        datetime reviewed_at
        text notes
    }

    IDEMPOTENCY_KEYS {
        int id PK
        string key
        datetime created_at
        datetime expires_at
    }

    LENDERS {
        int id PK
        string name
        string contact_email
        string contact_phone
        text notes
        boolean is_active
        datetime created_at
    }

    LENDER_PREFERENCES {
        int id PK
        int lender_id FK
        float min_loan_amount
        float max_loan_amount
        float ltv_min
        float ltv_max
        json equipment_types
        json naics_codes
        json states
        datetime updated_at
    }

    LENDER_MATCHES {
        int id PK
        int application_id FK
        int lender_id FK
        float loan_amount
        float ltv
        string reason
        datetime created_at
    }

    VENDORS ||--o{ LOCATIONS : has
    LOCATIONS ||--o{ SALESPEOPLE : employs
    SALESPEOPLE ||--o{ LOAN_APPLICATIONS : submits
    LOCATIONS ||--o{ LOAN_APPLICATIONS : submits
    LENDERS ||--o{ LENDER_PREFERENCES : has
    LOAN_APPLICATIONS ||--o{ LENDER_MATCHES : matched
    LENDERS ||--o{ LENDER_MATCHES : receives
```
<!-- AUTO-GENERATED: ERD_END -->

## Loan application JSON payloads

`loan_applications` stores several JSON blobs:

- borrower_data, coborrower_data: BorrowerIntakePayload (models/loan_application.py)
  - firstName, lastName, dateOfBirth, ssn, email, phone
  - employerName, annualIncome, status
  - farmType, acresOwned, acresLeased, farmWebsite, farmsocialmediaaccount, yearsInOperation
  - farmIncomeLast3Years: [{year, income, notFiled}]
  - naicsCode, farmLegalEntity
  - softCreditPullConsent, existingFarmDebt, personalDebt, insuranceStatus
  - bankruptcyHistory, priorLoanDefaults, priorRepossess, priorRepossession, taxLienHistory
- loan_data: dict (not typed in backend schema)
- dealer_data: dict (not typed in backend schema)
- documents_and_consents_data: dict (not typed in backend schema)

BorrowerInfo (schemas/borrower.py) also defines a borrower address used in API payloads:

- address: {street, city, state, zip}

## Non-persistent API schemas

- LenderOffer and OffersResponse define response payloads for lender decisions.
- AzureTokenResponse defines the auth response payload.
