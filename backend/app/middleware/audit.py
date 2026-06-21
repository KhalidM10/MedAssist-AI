"""
Audit request tracking middleware.

Injects into request.state before every request:
  - request_id:  UUID (used for distributed tracing)
  - start_time:  float (monotonic, for duration calculation)
  - client_ip:   str (real IP respecting X-Forwarded-For)
  - geo:         GeoInfo | None (resolved after response to avoid blocking)

Route handlers read request.state.request_id / request.state.client_ip
so they can include this in their audit log entries without re-parsing.
"""
import time
import uuid

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response

# Paths we never need to trace
_SKIP_PATHS = {"/health", "/", "/docs", "/redoc", "/openapi.json"}


class AuditMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        request_id = uuid.uuid4()
        start = time.monotonic()

        # Real client IP (handles nginx X-Forwarded-For)
        forwarded = request.headers.get("X-Forwarded-For")
        client_ip = (
            forwarded.split(",")[0].strip()
            if forwarded
            else (request.client.host if request.client else "0.0.0.0")
        )

        request.state.request_id = request_id
        request.state.start_time = start
        request.state.client_ip = client_ip
        request.state.method = request.method
        request.state.path = request.url.path

        response = await call_next(request)

        duration_ms = int((time.monotonic() - start) * 1000)
        request.state.duration_ms = duration_ms
        request.state.status_code = response.status_code

        # Attach X-Request-ID so clients can correlate with support tickets
        response.headers["X-Request-ID"] = str(request_id)
        response.headers["X-Response-Time"] = f"{duration_ms}ms"

        return response
