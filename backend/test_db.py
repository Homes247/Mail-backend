import asyncio
from app.database import SessionLocal
from app.models.user import User
from app.models.user_credential import UserCredential
from sqlalchemy import select, text

async def t():
    async with SessionLocal() as db:
        # Test 1: raw query on user_credentials
        r = await db.execute(text("SELECT * FROM user_credentials LIMIT 3"))
        print("user_credentials rows:", r.fetchall())

        # Test 2: join query (same as login)
        result = await db.execute(
            select(User)
            .join(UserCredential, UserCredential.user_id == User.id)
            .where(UserCredential.login_email == "admin@vsnapmail.co.in")
        )
        user = result.scalar_one_or_none()
        print("User found:", user.id if user else None)
        if user:
            print("Hash prefix:", user.password_hash[:6])

asyncio.run(t())
