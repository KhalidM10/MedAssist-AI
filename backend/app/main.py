from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.config import get_settings
from app.core.limiter import limiter
from app.api.routes import (
    auth, triage, appointments, clinics, patients,
    orders, dashboard, permissions, audit, sessions, admin, public, webhooks,
)
from app.api.routes import notifications, ws
from app.middleware.audit import AuditMiddleware

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Init WebSocket Redis pub/sub (non-fatal if Redis is down)
    from app.core.ws_manager import ws_manager
    await ws_manager.init_redis(settings.redis_url)
    yield


app = FastAPI(
    title="MedAssist AI API",
    description="Kenya-first AI health guidance and triage platform",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)
app.add_middleware(AuditMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── REST routes ───────────────────────────────────────────────────────────────
app.include_router(auth.router,          prefix="/api/v1/auth",           tags=["auth"])
app.include_router(triage.router,        prefix="/api/v1/triage",         tags=["triage"])
app.include_router(appointments.router,  prefix="/api/v1/appointments",   tags=["appointments"])
app.include_router(clinics.router,       prefix="/api/v1/clinics",        tags=["clinics"])
app.include_router(patients.router,      prefix="/api/v1/patients",       tags=["patients"])
app.include_router(orders.router,        prefix="/api/v1/orders",         tags=["orders"])
app.include_router(dashboard.router,     prefix="/api/v1/dashboard",      tags=["dashboard"])
app.include_router(permissions.router,   prefix="/api/v1/permissions",    tags=["permissions"])
app.include_router(audit.router,         prefix="/api/v1/audit-logs",     tags=["audit"])
app.include_router(sessions.router,      prefix="/api/v1/sessions",       tags=["sessions"])
app.include_router(notifications.router, prefix="/api/v1/notifications",  tags=["notifications"])
app.include_router(admin.router,         prefix="/api/v1/admin",           tags=["admin"])
app.include_router(public.router,        prefix="/api/v1/platform",         tags=["platform"])
app.include_router(webhooks.router,      prefix="/api/v1/webhooks",          tags=["webhooks"])

# ── WebSocket ─────────────────────────────────────────────────────────────────
app.include_router(ws.router, tags=["websocket"])


@app.get("/", tags=["health"])
async def root():
    return {"service": "MedAssist AI", "version": "1.0.0", "status": "operational"}


@app.get("/health", tags=["health"])
async def health_check():
    return {"status": "healthy"}
