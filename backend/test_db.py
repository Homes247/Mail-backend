import asyncio
from app.database import engine
from sqlalchemy import text

async def test():
    async with engine.begin() as c:
        r = await c.execute(text('SELECT id, email, name FROM users LIMIT 5'))
        print(r.fetchall())

asyncio.run(test())
