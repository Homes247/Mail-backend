import asyncio
from app.database import engine
from sqlalchemy import text

async def test():
    async with engine.begin() as c:
        r = await c.execute(text('DESCRIBE users'))
        print([row[0] for row in r.fetchall()])

asyncio.run(test())
