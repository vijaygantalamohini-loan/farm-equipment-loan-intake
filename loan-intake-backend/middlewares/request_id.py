"""
Middleware to attach a request ID to each request/response.
"""

import uuid
from fastapi import Request


def add_request_id(app):
    """Attach X-Request-ID to requests and responses."""

    @app.middleware("http")
    async def request_id_middleware(request: Request, call_next):
        request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
        request.state.request_id = request_id
        try:
            import structlog

            structlog.contextvars.bind_contextvars(request_id=request_id)
        except Exception:
            pass

        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response

    return app
