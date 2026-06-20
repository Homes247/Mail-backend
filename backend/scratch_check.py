import sys
import asyncio
sys.path.append('.')
from app.database import engine
from sqlalchemy import text

async def main():
    async with engine.begin() as conn:
        try:
            res = await conn.execute(text('DESCRIBE document_shares'))
            print("SCHEMA:", res.fetchall())
        except Exception as e:
            print("ERROR:", str(e))

asyncio.run(main())
