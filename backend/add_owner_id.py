import asyncio
import os
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

load_dotenv()

DB_HOST = os.getenv("DB_HOST", "127.0.0.1")
DB_PORT = os.getenv("DB_PORT", "3306")
DB_NAME = os.getenv("DB_NAME", "gdocsheet")
DB_USER = os.getenv("DB_USER", "root")
DB_PASS = os.getenv("DB_PASS", "")

DATABASE_URL = f"mysql+aiomysql://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/{DB_NAME}?charset=utf8mb4"

async def main():
    engine = create_async_engine(DATABASE_URL)
    async with engine.begin() as conn:
        print("Adding owner_id to documents table...")
        try:
            await conn.execute(text("ALTER TABLE documents ADD COLUMN owner_id VARCHAR(36) NULL;"))
            print("Column owner_id added successfully.")
        except Exception as e:
            if 'Duplicate column name' in str(e):
                print("Column owner_id already exists.")
            else:
                print("Failed to add column:", e)
        
        print("Assigning existing documents to the first user in the database...")
        user_result = await conn.execute(text("SELECT id FROM users ORDER BY created_at ASC LIMIT 1;"))
        first_user = user_result.fetchone()
        
        if first_user:
            user_id = first_user[0]
            await conn.execute(text("UPDATE documents SET owner_id = :uid WHERE owner_id IS NULL;"), {"uid": user_id})
            print(f"Assigned documents to user {user_id}.")
        else:
            print("No users found in the database. Documents remain unassigned.")
            
        print("Migration complete!")
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(main())
