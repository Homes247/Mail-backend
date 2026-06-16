import json
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from pydantic import BaseModel

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
    is_trashed: Optional[int] = None

class DocumentShareCreate(BaseModel):
    email: str
    permission: str = "view"


def _default_content(doc_type: str, title: str) -> str:
    if doc_type == "doc":
        return json.dumps({"html": "<br>"})
    if doc_type == "sheet":
        return json.dumps({"cells": {}, "formats": {"0,0": {"size": "13px"}}})
    if doc_type == "slide":
        page_id = str(uuid.uuid4())
        return json.dumps({
            "id":        page_id,
            "title":     title,
            "pages":     {page_id: {"title": "", "body": ""}},
            "pageOrder": [page_id],
        })
    return "{}"


@router.post("/")
async def create_document(
    body: DocumentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc = Document(
        title=body.title,
        doc_type=body.doc_type,
        content=_default_content(body.doc_type, body.title),
        owner_id=current_user.id,
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)
    return {"id": doc.id, "title": doc.title, "doc_type": doc.doc_type}


@router.get("/")
async def list_documents(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Document, User.name.label('owner_name'))
        .join(User, Document.owner_id == User.id)
        .outerjoin(DocumentShare, Document.id == DocumentShare.document_id)
        .where(
            or_(
                Document.owner_id == current_user.id,
                DocumentShare.user_id == current_user.id,
            ),
        )
        .order_by(Document.updated_at.desc())
        .distinct()
    )
    docs = result.all()
    return [
        {
            "id": row.Document.id, 
            "title": row.Document.title, 
            "doc_type": row.Document.doc_type, 
            "updated_at": row.Document.updated_at, 
            "is_trashed": row.Document.is_trashed, 
            "owner_id": row.Document.owner_id,
            "owner_name": row.owner_name
        }
        for row in docs
    ]


@router.get("/{doc_id}")
async def get_document(
    doc_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user),
):
    doc = await db.get(Document, doc_id)
    if not doc:
        raise HTTPException(404, "Not found")

    if not doc.is_public:
        if not current_user:
            raise HTTPException(401, "Not authenticated")
        if doc.owner_id != current_user.id:
            existing = await db.execute(
                select(DocumentShare).where(
                    DocumentShare.document_id == doc_id,
                    DocumentShare.user_id == current_user.id,
                )
            )
            if not existing.scalar_one_or_none():
                raise HTTPException(403, "Access denied")

    return {"id": doc.id, "title": doc.title, "doc_type": doc.doc_type, "content": doc.content}


@router.put("/{doc_id}")
async def update_document(
    doc_id: str,
    body: DocumentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc = await db.get(Document, doc_id)
    if not doc:
        raise HTTPException(404, "Not found")

    # Allow owner or users with edit permission
    if doc.owner_id != current_user.id:
        share = await db.execute(
            select(DocumentShare).where(
                DocumentShare.document_id == doc_id,
                DocumentShare.user_id == current_user.id,
                DocumentShare.permission.in_(["edit", "Edit", "EDIT"]),
            )
        )
        if not share.scalar_one_or_none():
            raise HTTPException(403, "Forbidden")

    if body.title is not None:
        doc.title = body.title
    if body.content is not None:
        doc.content = body.content
    if body.is_trashed is not None:
        doc.is_trashed = body.is_trashed
        
    await db.commit()
    return {"id": doc.id, "title": doc.title}


@router.delete("/{doc_id}")
async def delete_document(
    doc_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc = await db.get(Document, doc_id)
    if not doc:
        raise HTTPException(404, "Not found")
    if doc.owner_id != current_user.id:
        raise HTTPException(403, "Only the owner can delete this document")
    
    if doc.is_trashed:
        await db.delete(doc)
    else:
        doc.is_trashed = 1
        
    await db.commit()
    return {"deleted": True}

@router.post("/{doc_id}/share")
async def share_document(
    doc_id: str,
    body: DocumentShareCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc = await db.get(Document, doc_id)
    if not doc or doc.owner_id != current_user.id:
        raise HTTPException(404, "Not found or not owner")
    
    # Find user by email
    result = await db.execute(select(User).where(User.email == body.email))
    target_user = result.scalar_one_or_none()
    if not target_user:
        raise HTTPException(404, "User not found")
        
    # Check if already shared
    existing = await db.execute(select(DocumentShare).where(
        DocumentShare.document_id == doc_id,
        DocumentShare.user_id == target_user.id
    ))
    share = existing.scalar_one_or_none()
    if share:
        share.permission = body.permission
    else:
        share = DocumentShare(document_id=doc_id, user_id=target_user.id, permission=body.permission)
        db.add(share)
    
    await db.commit()
    return {"shared": True, "permission": body.permission, "user_id": target_user.id}