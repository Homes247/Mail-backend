import jwt
import os
import logging
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, EmailStr
from app.database import get_db
from app.models.user import User
from app.models.user_credential import UserCredential

try:
    import bcrypt
    _bcrypt_available = True
except ImportError:
    _bcrypt_available = False

logger = logging.getLogger("uvicorn.error")
router = APIRouter()

SECRET = os.getenv("JWT_SECRET", "vmail-super-secret-key-change-in-production-2024")
ALGO   = os.getenv("JWT_ALGORITHM", "HS256")
EXP_H  = int(os.getenv("JWT_EXPIRE_HOURS", "24"))


def make_token(user_id: int, email: str) -> str:
    payload = {
        "sub":   str(user_id),
        "email": email,
        "exp":   datetime.now(timezone.utc) + timedelta(hours=EXP_H),
    }
    return jwt.encode(payload, SECRET, algorithm=ALGO)


def verify_password(plain: str, hashed: str) -> bool:
    if not _bcrypt_available:
        raise HTTPException(500, "bcrypt not installed")
    if hashed.startswith("$2y$"):
        hashed = "$2b$" + hashed[4:]
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception as e:
        logger.error(f"bcrypt error: {e}")
        return False


class LoginBody(BaseModel):
    email: EmailStr
    password: str


@router.post("/login")
async def login(body: LoginBody, db: AsyncSession = Depends(get_db)):
    login_email = body.email.strip().lower()

    # VMail stores login emails in user_credentials.login_email (not users.email)
    result = await db.execute(
        select(User)
        .join(UserCredential, UserCredential.user_id == User.id)
        .where(UserCredential.login_email == login_email, User.is_active == 1)
    )
    user = result.scalar_one_or_none()

    # Fallback: some users may only exist in users.email (legacy / direct inserts)
    if not user:
        result = await db.execute(
            select(User).where(User.email == login_email, User.is_active == 1)
        )
        user = result.scalar_one_or_none()

    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "Invalid email or password")

    return {
        "token": make_token(user.id, user.email),
        "user": {
            "id":           user.id,
            "name":         user.name,
            "email":        user.email,
            "avatar_color": user.avatar_color,
            "avatar_url":   user.avatar_url,
            "is_admin":     bool(user.is_admin),
        },
    }


@router.get("/me")
async def me(authorization: str = Header(None), db: AsyncSession = Depends(get_db)):
    user = await get_current_user(authorization, db)
    return {
        "id":           user.id,
        "name":         user.name,
        "email":        user.email,
        "avatar_color": user.avatar_color,
        "avatar_url":   user.avatar_url,
    }


async def get_current_user(
    authorization: str = Header(None),
    db: AsyncSession = Depends(get_db),
) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Not authenticated")

    token = authorization.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, SECRET, algorithms=[ALGO])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(401, "Invalid token")
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except jwt.PyJWTError:
        raise HTTPException(401, "Invalid token")

    user = await db.get(User, int(user_id))
    if not user:
        raise HTTPException(401, "User not found")
    if not user.is_active:
        raise HTTPException(403, "Account inactive")
    return user


async def get_optional_current_user(
    authorization: str = Header(None),
    db: AsyncSession = Depends(get_db),
) -> User | None:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    try:
        token = authorization.split(" ", 1)[1]
        payload = jwt.decode(token, SECRET, algorithms=[ALGO])
        user_id = payload.get("sub")
        if user_id:
            user = await db.get(User, int(user_id))
            return user if (user and user.is_active) else None
    except Exception:
        pass
    return None