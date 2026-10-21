from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.routers.admin.users import router as admin_users_router
from backend.routers.auth.auth import router as auth_router

app = FastAPI(title="Auth App")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost", "http://127.0.0.1", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(admin_users_router)
