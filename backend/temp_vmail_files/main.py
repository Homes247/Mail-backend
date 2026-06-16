from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from models import group
import os

from database import engine, Base
import models.user, models.mail_model, models.attachment
import models.chat, models.channel, models.email_alias  # NEW
import models.organization                               # MULTI-TENANCY
import models.document, models.document_share           # OFFICE SUITE

from routers import auth, mails, users
from routers import chat_api, channels_api, admin_api   # NEW
from routers import superadmin_api                       # SUPERADMIN
from routers import organizations_api                    # MULTI-TENANCY
from routers import log_api                              # LOGGING
from routers import files_api                            # FILE SERVING
from routers import documents_api                        # OFFICE SUITE
from logger import get_logger
from middleware.request_logging import RequestLoggingMiddleware

# Create all tables (safe to call repeatedly – only creates missing ones)
try:
    Base.metadata.create_all(bind=engine)
    print("[OK] All database tables verified/created.")
    # Safe migration to add 'reactions' column to 'chat_messages' table if not exists
    from sqlalchemy import inspect, text
    insp = inspect(engine)
    if insp.has_table("chat_messages"):
        cols = [c["name"] for c in insp.get_columns("chat_messages")]
        if "reactions" not in cols:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE chat_messages ADD COLUMN reactions TEXT NULL"))
                conn.commit()
            print("[OK] Migration: Added 'reactions' column to 'chat_messages' table.")
        
        # Safe migration for avatar_url in groups
        if insp.has_table("groups"):
            cols = [c["name"] for c in insp.get_columns("groups")]
            if "avatar_url" not in cols:
                with engine.connect() as conn:
                    conn.execute(text("ALTER TABLE `groups` ADD COLUMN avatar_url VARCHAR(500) NULL"))
                    conn.commit()
                print("[OK] Migration: Added 'avatar_url' column to 'groups' table.")
                
        # Safe migration for avatar_url in channels
        if insp.has_table("channels"):
            cols = [c["name"] for c in insp.get_columns("channels")]
            if "avatar_url" not in cols:
                with engine.connect() as conn:
                    conn.execute(text("ALTER TABLE channels ADD COLUMN avatar_url VARCHAR(500) NULL"))
                    conn.commit()
                print("[OK] Migration: Added 'avatar_url' column to 'channels' table.")

        # Safe migration for channel_messages columns
        if insp.has_table("channel_messages"):
            cols = [c["name"] for c in insp.get_columns("channel_messages")]
            with engine.connect() as conn:
                if "is_file" not in cols:
                    conn.execute(text("ALTER TABLE channel_messages ADD COLUMN is_file SMALLINT DEFAULT 0"))
                    print("[OK] Migration: Added 'is_file' column to 'channel_messages' table.")
                if "file_path" not in cols:
                    conn.execute(text("ALTER TABLE channel_messages ADD COLUMN file_path VARCHAR(500) NULL"))
                    print("[OK] Migration: Added 'file_path' column to 'channel_messages' table.")
                if "reactions" not in cols:
                    conn.execute(text("ALTER TABLE channel_messages ADD COLUMN reactions TEXT NULL"))
                    print("[OK] Migration: Added 'reactions' column to 'channel_messages' table.")
                conn.commit()

        # Safe migration for external_recipients in mails
        if insp.has_table("mails"):
            cols = [c["name"] for c in insp.get_columns("mails")]
            if "external_recipients" not in cols:
                with engine.connect() as conn:
                    conn.execute(text("ALTER TABLE mails ADD COLUMN external_recipients TEXT NULL"))
                    conn.commit()
                print("[OK] Migration: Added 'external_recipients' column to 'mails' table.")

        # Safe migration for phone in users
        if insp.has_table("users"):
            cols = [c["name"] for c in insp.get_columns("users")]
            if "phone" not in cols:
                with engine.connect() as conn:
                    conn.execute(text("ALTER TABLE users ADD COLUMN phone VARCHAR(20) NULL"))
                    conn.commit()
                print("[OK] Migration: Added 'phone' column to 'users' table.")
except Exception as e:
    print(f"[WARNING] create_all error (some tables may not exist): {e}")

# Startup legacy test users cleanup
try:
    from database import SessionLocal
    from models.user import User
    db = SessionLocal()
    fake_users = db.query(User).filter(
        (User.email.like("%test%")) |
        (User.email.like("%tets%")) |
        (User.email.like("%yogireddymiddi2004%")) |
        (User.name.like("%test%")) |
        (User.name.like("%tett%"))
    ).all()
    for u in fake_users:
        if u.is_active == 1:
            print(f"[CLEANUP] Deactivating legacy test user: {u.name} ({u.email})")
            u.is_active = 0
    db.commit()
    db.close()
    print("[OK] Legacy test users deactivation completed.")
except Exception as e:
    print(f"[WARNING] Startup database cleanup failed: {e}")

from config import UPLOAD_DIR
log = get_logger("startup")
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs("logs", exist_ok=True)
print(f"[OK] UPLOAD_DIR resolved to: {UPLOAD_DIR}")

app = FastAPI(title="Vmail API", version="2.0.0")

# ── Logging middleware (must be added FIRST so it wraps everything) ────────────
app.add_middleware(RequestLoggingMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

app.include_router(auth.router)
app.include_router(mails.router)
app.include_router(users.router)
app.include_router(chat_api.router)           # NEW
app.include_router(channels_api.router)       # NEW
app.include_router(admin_api.router)          # NEW
app.include_router(superadmin_api.router)     # SUPERADMIN
app.include_router(organizations_api.router)  # MULTI-TENANCY
app.include_router(log_api.router)            # LOGGING
app.include_router(files_api.router)          # FILE SERVING

from routers import webhook_api               # AWS SNS WEBHOOK
app.include_router(webhook_api.router)
app.include_router(documents_api.router)      # OFFICE SUITE

@app.get("/health")
def health():
    return {"status": "ok", "app": "Vmail v2"}