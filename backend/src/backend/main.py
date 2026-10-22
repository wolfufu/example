from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.routers.admin.users import router as admin_users_router
from backend.routers.auth.auth import router as auth_router
from backend.routers.auth.two_factor import router as two_factor_router

app = FastAPI(
    title="App",
    openapi_tags=[
        {
            "name": "Authorization",
            "description": "Registration, login, token refresh, logout.",
        },
        {
            "name": "Authentication",
            "description": "Two-factor authentication (TOTP): setup, verify, disable.",
        },
        {
            "name": "Administration",
            "description": "User management. Available only to superusers.",
        },
    ],
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost", "http://127.0.0.1", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(two_factor_router)
app.include_router(admin_users_router)
