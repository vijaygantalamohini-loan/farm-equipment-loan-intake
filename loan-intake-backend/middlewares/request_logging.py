"""
Request logging middleware.

Captures inbound requests and responses for debugging without cluttering main.py.
"""

import time
from fastapi import Request
import logging


def add_request_logging(app, api_logger):
    """Attach request/response logging middleware to the FastAPI app."""

    @app.middleware("http")
    async def log_requests(request: Request, call_next):
        start_time = time.time()
        request_id = getattr(request.state, "request_id", "unknown")

        # Redact sensitive headers
        headers = dict(request.headers)
        if "authorization" in headers:
            headers["authorization"] = "<redacted>"

        # Console logging
        print(f"\n{'='*60}")
        print(f"INCOMING REQUEST [rid={request_id}]")
        print(f"{'='*60}")
        print(f"Method: {request.method}")
        print(f"URL: {request.url.path}")
        print(f"Query Params: {dict(request.query_params)}")
        print(f"Headers: {headers}")

        # File logging
        api_logger.info(f"REQUEST: {request.method} {request.url.path} rid={request_id}")
        api_logger.debug(f"Query: {dict(request.query_params)}")
        api_logger.debug(f"Headers: {headers}")

        if "authorization" in request.headers:
            print("Auth header present")
            api_logger.info("Auth header present")

        try:
            response = await call_next(request)
        except Exception:
            # Ensure unhandled exceptions are captured in file logs
            logging.exception("Unhandled error while processing request")
            api_logger.exception("Unhandled error while processing request")
            try:
                from logging_config import errors_logger
            except Exception:
                errors_logger = logging.getLogger('errors')
            # Mirror the exception into errors.log with request context
            errors_logger.error(
                "Unhandled error while processing request",
                extra={
                    "status": 500,
                    "method": request.method,
                    "path": request.url.path,
                    "rid": request_id,
                },
            )
            raise

        duration = time.time() - start_time
        print(f"{'='*60}")
        print(f"RESPONSE [rid={request_id}]")
        print(f"{'='*60}")
        print(f"Status: {response.status_code}")
        print(f"Duration: {duration:.2f}s")
        print(f"{'='*60}\n")

        api_logger.info(f"RESPONSE: {response.status_code} ({duration:.2f}s) rid={request_id}")
        # Also record error-level logs for 4xx/5xx to errors.log via dedicated logger
        try:
            from logging_config import errors_logger
        except Exception:
            errors_logger = logging.getLogger('errors')

        if response.status_code >= 500:
            errors_logger.error(
                "HTTP 5xx response",
                extra={
                    "status": response.status_code,
                    "method": request.method,
                    "path": request.url.path,
                    "rid": request_id,
                    "duration": round(duration, 2),
                },
            )
        elif response.status_code >= 400:
            errors_logger.error(
                "HTTP 4xx response",
                extra={
                    "status": response.status_code,
                    "method": request.method,
                    "path": request.url.path,
                    "rid": request_id,
                    "duration": round(duration, 2),
                },
            )
        return response

    return app
