import sys
import asyncio
sys.path.append('.')
from app.database import engine, AsyncSessionLocal
from app.api.documents import share_document, DocumentShareCreate
from sqlalchemy import text
from app.models.user import User

async def main():
    async with AsyncSessionLocal() as session:
        class DummyUser:
            id = 1
        try:
            body = DocumentShareCreate(email="admin@vsnapmail.co.in", permission="view")
            # doc_id from screenshot: c03481d1-032d-46a1-bdb4-91e9976ba443
            res = await share_document("c03481d1-032d-46a1-bdb4-91e9976ba443", body, session, DummyUser())
            print("SUCCESS:", res)
        except Exception as e:
            print("EXCEPTION:", str(e))
            import traceback
            traceback.print_exc()

asyncio.run(main())
