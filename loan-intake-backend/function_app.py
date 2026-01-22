# Azure Functions for Loan Intake API
# Converts FastAPI routes to Azure Functions (completely FREE hosting)

import azure.functions as func
import json
import logging
from datetime import datetime
from database import SessionLocal, Salesperson, LoanApplication
from services.azure_ad_auth import verify_azure_token, exchange_code_for_token, get_or_create_salesperson_from_azure
import os

app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)

# Environment variables
AZURE_AD_TENANT_NAME = os.getenv("AZURE_AD_TENANT_NAME")
AZURE_AD_POLICY_NAME = os.getenv("AZURE_AD_POLICY_NAME", "B2C_1_signupsignin")
AZURE_AD_CLIENT_ID = os.getenv("AZURE_AD_CLIENT_ID")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:7071")

# Helper function to get current salesperson from token
def get_salesperson_from_token(token: str):
    """Verify token and get salesperson"""
    payload = verify_azure_token(token)
    if not payload:
        return None
    
    db = SessionLocal()
    try:
        salesperson = get_or_create_salesperson_from_azure(payload, db)
        return salesperson
    finally:
        db.close()


@app.route(route="auth/login", methods=["GET"])
def auth_login(req: func.HttpRequest) -> func.HttpResponse:
    """Redirect to Azure AD B2C login"""
    logging.info('Azure AD login redirect requested')
    
    authority = f"https://{AZURE_AD_TENANT_NAME}.b2clogin.com/{AZURE_AD_TENANT_NAME}.onmicrosoft.com/{AZURE_AD_POLICY_NAME}"
    redirect_uri = f"{BACKEND_URL}/api/auth/callback"
    
    authorization_url = (
        f"{authority}/oauth2/v2.0/authorize?"
        f"client_id={AZURE_AD_CLIENT_ID}&"
        f"response_type=code&"
        f"redirect_uri={redirect_uri}&"
        f"response_mode=query&"
        f"scope=openid%20profile%20email&"
        f"state=12345"
    )
    
    return func.HttpResponse(
        status_code=302,
        headers={"Location": authorization_url}
    )


@app.route(route="auth/callback", methods=["GET"])
def auth_callback(req: func.HttpRequest) -> func.HttpResponse:
    """Handle Azure AD B2C callback"""
    logging.info('Azure AD callback received')
    
    code = req.params.get('code')
    if not code:
        error = req.params.get('error_description', 'No authorization code received')
        return func.HttpResponse(
            status_code=302,
            headers={"Location": f"{FRONTEND_URL}/login?error={error}"}
        )
    
    # Exchange code for token
    redirect_uri = f"{BACKEND_URL}/api/auth/callback"
    token_data = exchange_code_for_token(code, redirect_uri)
    
    if not token_data:
        return func.HttpResponse(
            status_code=302,
            headers={"Location": f"{FRONTEND_URL}/login?error=Token exchange failed"}
        )
    
    id_token = token_data.get("id_token")
    access_token = token_data.get("access_token")
    
    # Verify token
    payload = verify_azure_token(id_token)
    if not payload:
        return func.HttpResponse(
            status_code=302,
            headers={"Location": f"{FRONTEND_URL}/login?error=Token verification failed"}
        )
    
    # Get or create salesperson
    db = SessionLocal()
    try:
        salesperson = get_or_create_salesperson_from_azure(payload, db)
        if not salesperson:
            return func.HttpResponse(
                status_code=302,
                headers={"Location": f"{FRONTEND_URL}/login?error=User not found"}
            )
        
        # Redirect to frontend with token
        redirect_url = (
            f"{FRONTEND_URL}?"
            f"token={access_token}&"
            f"salesperson_id={salesperson.id}&"
            f"salesperson_name={salesperson.first_name} {salesperson.last_name}"
        )
        
        return func.HttpResponse(
            status_code=302,
            headers={"Location": redirect_url}
        )
    finally:
        db.close()


@app.route(route="auth/verify", methods=["POST"])
def auth_verify(req: func.HttpRequest) -> func.HttpResponse:
    """Verify Azure AD token"""
    logging.info('Token verification requested')
    
    try:
        req_body = req.get_json()
        token = req_body.get('token')
        
        if not token:
            return func.HttpResponse(
                json.dumps({"error": "No token provided"}),
                status_code=400,
                mimetype="application/json"
            )
        
        salesperson = get_salesperson_from_token(token)
        if not salesperson:
            return func.HttpResponse(
                json.dumps({"error": "Invalid token"}),
                status_code=401,
                mimetype="application/json"
            )
        
        return func.HttpResponse(
            json.dumps({
                "token": token,
                "salesperson": {
                    "id": salesperson.id,
                    "email": salesperson.email,
                    "first_name": salesperson.first_name,
                    "last_name": salesperson.last_name,
                    "location_id": salesperson.location_id
                }
            }),
            status_code=200,
            mimetype="application/json"
        )
    except Exception as e:
        logging.error(f"Error verifying token: {e}")
        return func.HttpResponse(
            json.dumps({"error": str(e)}),
            status_code=500,
            mimetype="application/json"
        )


@app.route(route="loans/submit", methods=["POST"])
def loans_submit(req: func.HttpRequest) -> func.HttpResponse:
    """Submit loan application"""
    logging.info('Loan submission requested')
    
    # Get token from Authorization header
    auth_header = req.headers.get('Authorization', '')
    if not auth_header.startswith('Bearer '):
        return func.HttpResponse(
            json.dumps({"error": "No authorization token"}),
            status_code=401,
            mimetype="application/json"
        )
    
    token = auth_header.replace('Bearer ', '')
    salesperson = get_salesperson_from_token(token)
    
    if not salesperson:
        return func.HttpResponse(
            json.dumps({"error": "Invalid token"}),
            status_code=401,
            mimetype="application/json"
        )
    
    try:
        req_body = req.get_json()
        
        db = SessionLocal()
        try:
            # Generate application number
            last_app = db.query(LoanApplication).order_by(LoanApplication.id.desc()).first()
            next_number = 1 if not last_app else last_app.id + 1
            application_number = f"LA-{datetime.now().year}-{next_number:05d}"
            
            # Create loan application
            loan_app = LoanApplication(
                salesperson_id=salesperson.id,
                location_id=salesperson.location_id,
                application_number=application_number,
                borrower_data=req_body.get('borrower', {}),
                coborrower_data=req_body.get('coborrower', {}),
                loan_data=req_body.get('loan', {}),
                dealer_data=req_body.get('dealer', {}),
                status='pending'
            )
            
            db.add(loan_app)
            db.commit()
            db.refresh(loan_app)
            
            return func.HttpResponse(
                json.dumps({
                    "application_number": application_number,
                    "status": "success",
                    "message": "Loan application submitted successfully"
                }),
                status_code=200,
                mimetype="application/json"
            )
        finally:
            db.close()
    except Exception as e:
        logging.error(f"Error submitting loan: {e}")
        return func.HttpResponse(
            json.dumps({"error": str(e)}),
            status_code=500,
            mimetype="application/json"
        )


@app.route(route="loans/my-applications", methods=["GET"])
def loans_my_applications(req: func.HttpRequest) -> func.HttpResponse:
    """Get salesperson's loan applications"""
    logging.info('My applications requested')
    
    auth_header = req.headers.get('Authorization', '')
    if not auth_header.startswith('Bearer '):
        return func.HttpResponse(
            json.dumps({"error": "No authorization token"}),
            status_code=401,
            mimetype="application/json"
        )
    
    token = auth_header.replace('Bearer ', '')
    salesperson = get_salesperson_from_token(token)
    
    if not salesperson:
        return func.HttpResponse(
            json.dumps({"error": "Invalid token"}),
            status_code=401,
            mimetype="application/json"
        )
    
    db = SessionLocal()
    try:
        applications = db.query(LoanApplication).filter(
            LoanApplication.salesperson_id == salesperson.id
        ).all()
        
        result = []
        for app in applications:
            result.append({
                "id": app.id,
                "application_number": app.application_number,
                "status": app.status,
                "created_at": app.created_at.isoformat(),
                "borrower_name": app.borrower_data.get('firstName', '') + ' ' + app.borrower_data.get('lastName', '')
            })
        
        return func.HttpResponse(
            json.dumps(result),
            status_code=200,
            mimetype="application/json"
        )
    finally:
        db.close()


@app.route(route="loans/location-applications", methods=["GET"])
def loans_location_applications(req: func.HttpRequest) -> func.HttpResponse:
    """Get location's loan applications"""
    logging.info('Location applications requested')
    
    auth_header = req.headers.get('Authorization', '')
    if not auth_header.startswith('Bearer '):
        return func.HttpResponse(
            json.dumps({"error": "No authorization token"}),
            status_code=401,
            mimetype="application/json"
        )
    
    token = auth_header.replace('Bearer ', '')
    salesperson = get_salesperson_from_token(token)
    
    if not salesperson:
        return func.HttpResponse(
            json.dumps({"error": "Invalid token"}),
            status_code=401,
            mimetype="application/json"
        )
    
    db = SessionLocal()
    try:
        applications = db.query(LoanApplication).filter(
            LoanApplication.location_id == salesperson.location_id
        ).all()
        
        result = []
        for app in applications:
            result.append({
                "id": app.id,
                "application_number": app.application_number,
                "status": app.status,
                "created_at": app.created_at.isoformat(),
                "borrower_name": app.borrower_data.get('firstName', '') + ' ' + app.borrower_data.get('lastName', ''),
                "salesperson_name": app.salesperson.first_name + ' ' + app.salesperson.last_name
            })
        
        return func.HttpResponse(
            json.dumps(result),
            status_code=200,
            mimetype="application/json"
        )
    finally:
        db.close()
