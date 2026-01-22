"""Test Azure AD redirect URL"""
import os
from dotenv import load_dotenv

load_dotenv()

AZURE_AD_TENANT_NAME = os.getenv("AZURE_AD_TENANT_NAME")
AZURE_AD_CLIENT_ID = os.getenv("AZURE_AD_CLIENT_ID")
AZURE_AD_POLICY_NAME = os.getenv("AZURE_AD_POLICY_NAME")
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000")

redirect_uri = f"{BACKEND_URL}/auth/callback"
AZURE_AD_AUTHORITY = f"https://{AZURE_AD_TENANT_NAME}.b2clogin.com/{AZURE_AD_TENANT_NAME}.onmicrosoft.com/{AZURE_AD_POLICY_NAME}"

authorization_url = (
    f"{AZURE_AD_AUTHORITY}/oauth2/v2.0/authorize?"
    f"client_id={AZURE_AD_CLIENT_ID}&"
    f"response_type=code&"
    f"redirect_uri={redirect_uri}&"
    f"response_mode=query&"
    f"scope=openid%20profile%20email&"
    f"state=12345"
)

print("=" * 80)
print("Azure AD B2C Redirect URL:")
print("=" * 80)
print(authorization_url)
print()
print("If you click 'Sign in with Microsoft', it should redirect to:")
print(f"http://localhost:8000/auth/login")
print()
print("Which then redirects to:")
print(authorization_url)
print()
print("=" * 80)
