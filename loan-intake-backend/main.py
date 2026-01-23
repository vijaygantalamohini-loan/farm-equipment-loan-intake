"""
Loan Intake API - Modular Architecture

Main FastAPI application for equipment loan intake processing.
Routers, middleware, and settings are composed via a factory for clarity.
"""

from dotenv import load_dotenv

# Load environment early so router imports (MSAL/CIAM) see real values
load_dotenv()

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import logging
from starlette.exceptions import HTTPException as StarletteHTTPException

from core.settings import get_settings
from logging_config import setup_file_logging, api_logger
from middlewares.request_logging import add_request_logging
from middlewares.request_id import add_request_id
from routers import (
    ocr_routes,
    lookup_routes,
    address_routes,
    dealer_routes,
    azure_auth_routes,
    loan_routes,
    lender_routes,
    prequalification_routes,
    admin_routes,
    debug_auth_routes,
    callback_spa,
    health,
)
from schemas.borrower import BorrowerInfo
from database import init_db
from contextlib import asynccontextmanager

# In-memory storage (replace with DB in production)
borrower_storage = {}


def find_name(lines):
    for line in lines:
        s = line.strip()
        if not any(c.isalpha() for c in s):
            continue
        lower = s.lower()
        if lower.startswith("name:"):
            name = s.split(":", 1)[1].strip()
            parts = name.split()
            if len(parts) >= 2:
                return parts[0].capitalize(), parts[1].capitalize()
        if "," in s:
            last_part, first_part = s.split(",", 1)
            last = last_part.strip().split()[0]
            first = first_part.strip().split()[0]
            return first.capitalize(), last.capitalize()
        parts = s.split()
        if len(parts) >= 2:
            return parts[0].capitalize(), parts[1].capitalize()
    return None, None


def find_dob(lines):
    import re
    mmddyyyy = re.compile(r"\b\d{2}/\d{2}/\d{4}\b")
    iso = re.compile(r"\b\d{4}-\d{2}-\d{2}\b")
    for line in lines:
        s = line.strip()
        m = mmddyyyy.search(s)
        if m:
            return m.group(0)
        m = iso.search(s)
        if m:
            return m.group(0)
    return None


def find_address(lines):
    import re
    street = None
    for i, line in enumerate(lines):
        s = line.strip()
        if street is None and re.match(r"^\d+\s+", s):
            street = s
            continue
        m = re.match(r"^([A-Za-z][A-Za-z\s]+),\s*([A-Z]{2})\s+(\d{5})$", s)
        if m:
            city = m.group(1).strip().title()
            state = m.group(2)
            zip_code = m.group(3)
            return street, city, state, zip_code
        m = re.match(r"^([A-Za-z][A-Za-z\s]+)\s+([A-Z]{2})\s+(\d{5})$", s)
        if m:
            city = m.group(1).strip().title()
            state = m.group(2)
            zip_code = m.group(3)
            return street, city, state, zip_code
        m = re.search(r"\b(\d{5})\b", s)
        if m and street:
            return street, None, None, m.group(1)
    return None, None, None, None


def create_app() -> FastAPI:
    """Application factory for easier testing and modular setup."""
    settings = get_settings()

    log_files = setup_file_logging()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        init_db()
        print("Database initialized")
        print("Authentication: Microsoft Entra External ID (CIAM)")
        print(f"CORS allow origins: {settings.allow_origins}")
        print("CORS allow origin regex: ^https?://(127.0.0.1|localhost):30(00|01)$")
        print("\nLog Files:")
        for log_type, log_path in log_files.items():
            print(f"   {log_type}: {log_path}")
        print()
        yield

    app = FastAPI(title=settings.app_name, version=settings.app_version, lifespan=lifespan)

    # Middleware
    add_request_id(app)
    add_request_logging(app, api_logger)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allow_origins,
        # Match localhost dev ports and GitHub Codespaces domains
        allow_origin_regex=r"^https?://(127\.0\.0\.1|localhost):30(00|01)$|^https://.*\.app\.github\.dev$",
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["authorization", "content-type", "idempotency-key"],
        expose_headers=["content-length"],
        max_age=600,
    )

    

    # Routers
    app.include_router(ocr_routes.router)
    app.include_router(lookup_routes.router)
    app.include_router(address_routes.router)
    app.include_router(dealer_routes.router)
    app.include_router(azure_auth_routes.router)
    app.include_router(loan_routes.router)
    app.include_router(lender_routes.router)
    from equipment_intelligence.api.routes import router as equipment_router
    app.include_router(equipment_router)
    app.include_router(prequalification_routes.router)
    app.include_router(admin_routes.router)
    app.include_router(debug_auth_routes.router)
    app.include_router(callback_spa.router)
    app.include_router(health.router)

    # Global HTTPException handler to ensure 4xx/5xx are logged to errors.log
    @app.exception_handler(HTTPException)
    async def http_exception_logger(request: Request, exc: HTTPException):
        rid = getattr(request.state, "request_id", "unknown")
        try:
            from logging_config import errors_logger
        except Exception:
            errors_logger = logging.getLogger('errors')

        errors_logger.error(
            "HTTPException",
            extra={
                "status": exc.status_code,
                "detail": exc.detail,
                "method": request.method,
                "path": request.url.path,
                "rid": rid,
            },
        )
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})

    # Also capture Starlette HTTPException (e.g., 404 Not Found for unmatched routes)
    @app.exception_handler(StarletteHTTPException)
    async def starlette_http_exception_logger(request: Request, exc: StarletteHTTPException):
        rid = getattr(request.state, "request_id", "unknown")
        try:
            from logging_config import errors_logger
        except Exception:
            errors_logger = logging.getLogger('errors')

        errors_logger.error(
            "StarletteHTTPException",
            extra={
                "status": exc.status_code,
                "detail": getattr(exc, "detail", None),
                "method": request.method,
                "path": request.url.path,
                "rid": rid,
            },
        )
        return JSONResponse(status_code=exc.status_code, content={"detail": getattr(exc, "detail", "")})

    # Catch-all handler: log unexpected exceptions with stack trace to errors.log
    @app.exception_handler(Exception)
    async def unhandled_exception_logger(request: Request, exc: Exception):
        rid = getattr(request.state, "request_id", "unknown")
        try:
            from logging_config import errors_logger
        except Exception:
            errors_logger = logging.getLogger('errors')

        # Log full stack trace
        logging.exception("Unhandled server error")
        errors_logger.error(
            "UnhandledException",
            extra={
                "status": 500,
                "detail": str(exc),
                "method": request.method,
                "path": request.url.path,
                "rid": rid,
            },
        )
        return JSONResponse(status_code=500, content={"detail": "Internal Server Error"})

    # Simple top-level health endpoint (no auth) for quick checks
    @app.get("/healthz")
    async def healthz_root():
        s = get_settings()
        return {
            "status": "ok",
            "service": s.app_name,
            "version": s.app_version,
            "backend_url": s.backend_url,
            "frontend_url": s.frontend_url,
        }

    # Borrower endpoints (temporary in-memory)
    @app.get("/")
    async def root():
        """API health check endpoint."""
        return {
            "status": "online",
            "service": settings.app_name,
            "version": settings.app_version,
            "architecture": "Modular (Routers + Services)",
            "endpoints": {
                "OCR": "/ocr/id, /ocr/asset, /ocr/barcode",
                "Lookup": "/lookup/serial/{serial}, /lookup/naics, /lookup/manufacturers",
                "Address": "/address/validate, /address/lookup-zip",
                "Borrower": "/borrower",
            },
            "features": [
                "OCR (ID, Invoice, Barcode)",
                "Serial Number Decoding (6 manufacturers)",
                "NAICS Lookup (150+ keywords)",
                "NHTSA VIN Lookup",
                "USPS Address Validation",
                "Borrower Management",
            ],
        }

    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
