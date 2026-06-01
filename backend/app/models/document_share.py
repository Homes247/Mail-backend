from datetime import datetime
import uuid
from sqlalchemy import String, DateTime, func, PrimaryKeyConstraint
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base

class DocumentShare(Base):
    __tablename__ = "document_shares"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    document_id: Mapped[str] = mapped_column(String(36))
    user_id: Mapped[str] = mapped_column(String(36))
    permission: Mapped[str] = mapped_column(String(10), default="edit")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
