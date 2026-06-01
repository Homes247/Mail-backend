from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from pydantic import BaseModel
from typing import Optional
from app.database import get_db
from app.models.document import Document
from app.models.document_share import DocumentShare
from app.models.user import User
from app.api.auth import get_current_user, get_optional_current_user

router = APIRouter()

class DocumentCreate(BaseModel):
    title: str = "Untitled"
    doc_type: str  # sheet | doc | slide

class DocumentUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None

@router.post("/")
async def create_document(body: DocumentCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    doc = Document(title=body.title, doc_type=body.doc_type, owner_id=current_user.id)
    db.add(doc)
    await db.flush()
    await db.refresh(doc)
    return {"id": doc.id, "title": doc.title, "doc_type": doc.doc_type}

@router.get("/")
async def list_documents(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(
        select(Document)
        .outerjoin(DocumentShare, Document.id == DocumentShare.document_id)
        .where(
            or_(
                Document.owner_id == current_user.id,
                DocumentShare.user_id == current_user.id
            )
        )
        .order_by(Document.updated_at.desc())
        .distinct()
    )
    docs = result.scalars().all()
    return [{"id": d.id, "title": d.title, "doc_type": d.doc_type, "updated_at": d.updated_at} for d in docs]

@router.get("/{doc_id}")
async def get_document(doc_id: str, db: AsyncSession = Depends(get_db), current_user: Optional[User] = Depends(get_optional_current_user)):
    doc = await db.get(Document, doc_id)
    if not doc:
        raise HTTPException(404, "Not found")
        
    if current_user and doc.owner_id != current_user.id:
        existing = await db.execute(
            select(DocumentShare).where(DocumentShare.document_id == doc_id, DocumentShare.user_id == current_user.id)
        )
        if not existing.scalar_one_or_none():
            share = DocumentShare(user_id=current_user.id, document_id=doc_id)
            db.add(share)
            
    return {"id": doc.id, "title": doc.title, "doc_type": doc.doc_type, "content": doc.content}

@router.put("/{doc_id}")
async def update_document(doc_id: str, body: DocumentUpdate, db: AsyncSession = Depends(get_db)):
    doc = await db.get(Document, doc_id)
    if not doc:
        raise HTTPException(404, "Not found")
    if body.title is not None:
        doc.title = body.title
    if body.content is not None:
        doc.content = body.content
    return {"id": doc.id, "title": doc.title}

@router.delete("/{doc_id}")
async def delete_document(doc_id: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    doc = await db.get(Document, doc_id)
    if not doc:
        raise HTTPException(404, "Not found")
    if doc.owner_id != current_user.id:
        raise HTTPException(403, "Forbidden: Only the owner can delete this document")
    await db.delete(doc)
    return {"deleted": True}
