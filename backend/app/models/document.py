import uuid
from datetime import datetime, timezone, timedelta
from sqlalchemy import String, DateTime, Text, Integer, func
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base

IST_OFFSET = timezone(timedelta(hours=5, minutes=30))

def now_ist() -> datetime:
    return datetime.now(IST_OFFSET).replace(tzinfo=None)

class Document(Base):
    __tablename__ = "documents"

    id:           Mapped[str]      = mapped_column(String(36),  primary_key=True, default=lambda: str(uuid.uuid4()))
    title:        Mapped[str]      = mapped_column(String(500), default="Untitled")
    doc_type:     Mapped[str]      = mapped_column(String(20))   # sheet | doc | slide
    content:      Mapped[str]      = mapped_column(Text,         default="{}")
    owner_id:     Mapped[int]      = mapped_column(Integer,      nullable=False)   # FK → vmail users.id (INT)
    share_token:  Mapped[str]      = mapped_column(String(64),   nullable=True)
    is_public:    Mapped[int]      = mapped_column(Integer,      default=0)
    is_trashed:   Mapped[int]      = mapped_column(Integer,      default=0)
    created_at:   Mapped[datetime] = mapped_column(DateTime,     default=now_ist)
    updated_at:   Mapped[datetime] = mapped_column(DateTime,     default=now_ist, onupdate=now_ist)