from typing import Annotated

from backend.auth.auth import get_current_superuser, get_password_hash
from backend.database.database import get_db
from backend.models.users import User
from backend.schemas.users import UserCreate, UserRead
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/admin/users", tags=["admin_users"])


@router.post(
    "/bootstrap",
    response_model=UserRead,
    status_code=status.HTTP_201_CREATED,
    summary="Создать первого администратора (без авторизации)",
    description=(
        "Работает только пока в системе нет ни одного суперпользователя. "
        "После создания первого админа возвращает 403 — дальше используйте "
        "POST /admin/users/ с токеном администратора."
    ),
)
async def bootstrap_admin(
    user_in: UserCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> UserRead:
    existing_admins = await db.scalar(
        select(func.count()).select_from(User).where(User.is_superuser.is_(True))
    )
    if existing_admins:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin already exists. Use admin account to create users.",
        )

    result = await db.execute(select(User).where(User.email == user_in.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    new_admin = User(
        name=user_in.name,
        email=user_in.email,
        hashed_password=get_password_hash(user_in.password),
        is_superuser=True,
        is_active=True,
    )
    db.add(new_admin)

    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Bootstrap race condition: admin was created by another request.",
        )

    await db.refresh(new_admin)
    return UserRead.model_validate(new_admin)


@router.get("/", response_model=list[UserRead])
async def get_all_users(
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(get_current_superuser)],
) -> list[UserRead]:
    result = await db.execute(select(User))
    return [UserRead.model_validate(u) for u in result.scalars().all()]


@router.post("/", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def create_user_admin(
    user_in: UserCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(get_current_superuser)],
) -> UserRead:
    result = await db.execute(select(User).where(User.email == user_in.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    new_user = User(
        name=user_in.name,
        email=user_in.email,
        hashed_password=get_password_hash(user_in.password),
        is_superuser=False,
        is_active=True,
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    return UserRead.model_validate(new_user)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[User, Depends(get_current_superuser)],
) -> None:
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="You cannot delete yourself")

    await db.delete(user)
    await db.commit()
