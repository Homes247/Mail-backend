import traceback
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func, text
from database import get_db, engine, Base
from middleware.jwt_middleware import get_current_user
from models.user import User
from models.chat import ChatConversation, ChatMessage
from models.channel import ChannelMessage
from pydantic import BaseModel
from typing import Optional
from config import UPLOAD_DIR, BASE_URL, resolve_avatar_url, file_url
import os, uuid
from datetime import datetime, timezone, timedelta
from services.storage_service import check_and_update_storage

IST_OFFSET = timezone(timedelta(hours=5, minutes=30))

def now_ist() -> datetime:
    """Always returns current IST time as naive datetime (for MySQL storage)."""
    return datetime.now(IST_OFFSET).replace(tzinfo=None)

def to_utc_iso(dt) -> str:
    """Convert a stored naive IST datetime → UTC ISO string for the frontend."""
    if not dt: return None
    # All stored datetimes are naive IST — attach IST offset before converting
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=IST_OFFSET)
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")

router = APIRouter(prefix="/chat", tags=["chat"])

class SendMessageRequest(BaseModel):
    to_user_id: int
    message: str

class ForwardMessageRequest(BaseModel):
    message_id: int
    to_user_id: int

class ForwardAnyRequest(BaseModel):
    source_id: int
    source_type: str  # "chat" or "channel"
    to_user_id: Optional[int] = None  # required for user forward, omitted for channel forward

class ForwardChannelMessageRequest(BaseModel):
    channel_message_id: int
    to_user_id: int

class EditMessageRequest(BaseModel):
    message: str

class MessageResponse(BaseModel):
    id: int
    sender_id: int
    sender_name: str
    sender_avatar_color: str
    sender_avatar_url: Optional[str]
    message: str
    is_mine: bool
    is_file: bool = False
    file_path: Optional[str] = None
    created_at: str
    is_edited: bool = False
    updated_at: Optional[str] = None


def get_or_create_conversation(db: Session, user1_id: int, user2_id: int) -> ChatConversation:
    # Always store with lower id first for uniqueness
    uid1, uid2 = min(user1_id, user2_id), max(user1_id, user2_id)
    conv = db.query(ChatConversation).filter(
        ChatConversation.user1_id == uid1,
        ChatConversation.user2_id == uid2
    ).first()
    if not conv:
        conv = ChatConversation(user1_id=uid1, user2_id=uid2)
        db.add(conv)
        db.commit()
        db.refresh(conv)
    return conv


# ── Table init endpoint (call once to create tables if they don't exist) ──────
@router.post("/init")
def init_chat_tables():
    """Create chat tables if they don't exist. Safe to call multiple times."""
    try:
        import models.chat  # ensure models are registered
        Base.metadata.create_all(bind=engine, tables=[
            ChatConversation.__table__,
            ChatMessage.__table__,
        ])
        return {"status": "ok", "message": "Chat tables created/verified successfully"}
    except Exception as e:
        tb = traceback.format_exc()
        print("CHAT INIT ERROR:", tb)
        return JSONResponse(status_code=500, content={"error": str(e), "detail": tb})


@router.get("/conversations")
def get_conversations(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        convs = db.query(ChatConversation).filter(
            or_(
                ChatConversation.user1_id == current_user.id,
                ChatConversation.user2_id == current_user.id
            )
        ).order_by(ChatConversation.updated_at.desc()).all()

        result = []
        for conv in convs:
            try:
                other = conv.user2 if conv.user1_id == current_user.id else conv.user1
                last_msg = db.query(ChatMessage).filter(
                    ChatMessage.conversation_id == conv.id
                ).order_by(ChatMessage.created_at.desc()).first()
                
                # Skip conversations that have no messages yet to prevent clutter
                if not last_msg:
                    continue

                unread = db.query(func.count(ChatMessage.id)).filter(
                    ChatMessage.conversation_id == conv.id,
                    ChatMessage.sender_id != current_user.id,
                    ChatMessage.is_read == 0
                ).scalar() or 0
                result.append({
                    "conversation_id": conv.id,
                    "other_user": {
                        "id": other.id,
                        "name": other.name,
                        "email": other.email,
                        "avatar_color": getattr(other, 'avatar_color', '#4f46e5') or '#4f46e5',
                        "avatar_url": resolve_avatar_url(getattr(other, 'avatar_url', None)),
                        "last_login": to_utc_iso(other.last_login) if other.last_login else None
                    },
                    "last_message": last_msg.message if last_msg else None,
                    "last_time": to_utc_iso(last_msg.created_at) if last_msg else None,
                    "unread": unread,
                    "updated_at": to_utc_iso(conv.updated_at) if conv.updated_at else (
                        to_utc_iso(conv.created_at) if conv.created_at else None
                    )
                })
            except Exception as inner_err:
                # Skip broken conversations but don't crash
                print(f"Error processing conversation {conv.id}: {inner_err}")
                continue
        return result
    except Exception as e:
        tb = traceback.format_exc()
        print("GET CONVERSATIONS ERROR:", tb)
        return JSONResponse(
            status_code=500,
            content={"error": str(e), "detail": tb, "hint": "Try POST /api/chat/init to create tables"}
        )


@router.get("/messages/{other_user_id}")
def get_messages(other_user_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        conv = get_or_create_conversation(db, current_user.id, other_user_id)
        # Mark all as read
        db.query(ChatMessage).filter(
            ChatMessage.conversation_id == conv.id,
            ChatMessage.sender_id != current_user.id,
            ChatMessage.is_read == 0
        ).update({"is_read": 1})
        db.commit()

        messages = db.query(ChatMessage).filter(
            ChatMessage.conversation_id == conv.id
        ).order_by(ChatMessage.created_at.asc()).all()

        if current_user.organization_id is None:
            raise HTTPException(status_code=403, detail="Personal accounts do not have access to chat features")

        other = db.query(User).filter(
            User.id == other_user_id,
            User.organization_id == current_user.organization_id
        ).first()
        if not other:
            raise HTTPException(status_code=404, detail="User not found")

        import json
        def safe_load_reactions(reactions_str):
            if not reactions_str:
                return {}
            try:
                return json.loads(reactions_str)
            except Exception:
                return {}

        return {
            "conversation_id": conv.id,
            "other_user": {
                "id": other.id,
                "name": other.name,
                "email": other.email,
                "avatar_color": getattr(other, 'avatar_color', '#4f46e5') or '#4f46e5',
                "avatar_url": resolve_avatar_url(getattr(other, 'avatar_url', None))
            },
            "messages": [{
                "id": m.id,
                "sender_id": m.sender_id,
                "sender_name": m.sender.name,
                "sender_avatar_color": getattr(m.sender, 'avatar_color', '#4f46e5') or '#4f46e5',
                "sender_avatar_url": resolve_avatar_url(getattr(m.sender, 'avatar_url', None)),
                "message": m.message if not getattr(m, 'delete_status', 0) else "[[DELETED]]",
                "is_mine": m.sender_id == current_user.id,
                "is_file": bool(m.is_file) if not getattr(m, 'delete_status', 0) else False,
                "file_path": file_url(m.file_path) if m.is_file and m.file_path and not getattr(m, 'delete_status', 0) else None,
                "created_at": to_utc_iso(m.created_at),
                "is_edited": bool(getattr(m, 'is_edited', 0)),
                "updated_at": to_utc_iso(m.updated_at) if getattr(m, 'updated_at', None) else None,
                "delete_status": bool(getattr(m, 'delete_status', 0)),
                "is_read": bool(getattr(m, 'is_read', 0)),
                "reactions": safe_load_reactions(getattr(m, 'reactions', None))
            } for m in messages]
        }
    except HTTPException:
        raise
    except Exception as e:
        tb = traceback.format_exc()
        print("GET MESSAGES ERROR:", tb)
        return JSONResponse(
            status_code=500,
            content={"error": str(e), "detail": tb, "hint": "Try POST /api/chat/init to create tables"}
        )


@router.post("/send")
def send_message(data: SendMessageRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        if current_user.organization_id is None:
            raise HTTPException(status_code=403, detail="Personal accounts do not have access to chat features")
            
        if check_and_update_storage(db, current_user):
            raise HTTPException(status_code=403, detail="Your storage quota is exhausted. You cannot send messages.")

        other = db.query(User).filter(
            User.id == data.to_user_id, 
            User.is_active == 1,
            User.organization_id == current_user.organization_id
        ).first()
        if not other:
            raise HTTPException(status_code=404, detail="User not found")
        if other.storage_used_mb >= other.storage_limit_mb:
            raise HTTPException(status_code=403, detail="Recipient has exhausted their storage quota and cannot receive messages.")
        conv = get_or_create_conversation(db, current_user.id, data.to_user_id)
        msg = ChatMessage(conversation_id=conv.id, sender_id=current_user.id, message=data.message)
        db.add(msg)
        conv.updated_at = now_ist()
        db.commit()
        db.refresh(msg)
        return {
            "id": msg.id,
            "sender_id": msg.sender_id,
            "sender_name": current_user.name,
            "sender_avatar_color": getattr(current_user, 'avatar_color', '#4f46e5') or '#4f46e5',
            "sender_avatar_url": resolve_avatar_url(getattr(current_user, 'avatar_url', None)),
            "message": msg.message,
            "is_mine": True,
            "is_file": bool(msg.is_file),
            "file_path": file_url(msg.file_path) if msg.is_file and msg.file_path else None,
            "created_at": to_utc_iso(msg.created_at),
            "is_edited": False,
            "updated_at": None,
            "is_read": False,
            "reactions": {}
        }
    except HTTPException:
        raise
    except Exception as e:
        tb = traceback.format_exc()
        print("SEND MESSAGE ERROR:", tb)
        return JSONResponse(
            status_code=500,
            content={"error": str(e), "detail": tb, "hint": "Try POST /api/chat/init to create tables"}
        )

@router.delete("/messages/{message_id}")
@router.post("/messages/{message_id}/delete")
def delete_message(message_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    msg = db.query(ChatMessage).filter(
        ChatMessage.id == message_id,
        ChatMessage.sender_id == current_user.id
    ).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found or not yours")
    msg.delete_status = 1
    msg.message = "[[DELETED]]"
    msg.is_file = 0
    msg.file_path = None
    msg.reactions = "{}"
    db.commit()
    db.refresh(msg)
    return {"status": "ok", "message": "[[DELETED]]"}

@router.put("/messages/{message_id}")
@router.post("/messages/{message_id}/edit")
def edit_message(message_id: int, data: EditMessageRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    msg = db.query(ChatMessage).filter(
        ChatMessage.id == message_id,
        ChatMessage.sender_id == current_user.id
    ).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found or not yours")
    msg.message = data.message
    msg.is_edited = 1
    db.commit()
    db.refresh(msg)
    return {"status": "ok", "message": msg.message, "updated_at": to_utc_iso(msg.updated_at) if msg.updated_at else None}

@router.post("/forward")
def forward_message(data: ForwardMessageRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.organization_id is None:
        raise HTTPException(status_code=403, detail="Personal accounts do not have access to chat features")

    if check_and_update_storage(db, current_user):
        raise HTTPException(status_code=403, detail="Your storage quota is exhausted. You cannot forward messages.")

    orig = db.query(ChatMessage).filter(ChatMessage.id == data.message_id).first()
    if not orig:
        raise HTTPException(status_code=404, detail="Original message not found")
        
    other = db.query(User).filter(
        User.id == data.to_user_id, 
        User.is_active == 1,
        User.organization_id == current_user.organization_id
    ).first()
    if not other:
        raise HTTPException(status_code=404, detail="User not found")
    if other.storage_used_mb >= other.storage_limit_mb:
        raise HTTPException(status_code=403, detail="Recipient has exhausted their storage quota and cannot receive messages.")
        
    conv = get_or_create_conversation(db, current_user.id, data.to_user_id)
    
    new_msg = ChatMessage(
        conversation_id=conv.id,
        sender_id=current_user.id,
        message=orig.message,
        is_file=orig.is_file,
        file_path=orig.file_path
    )
    db.add(new_msg)
    from datetime import datetime
    conv.updated_at = now_ist()
    db.commit()
    db.refresh(new_msg)
    
    return {
        "id": new_msg.id,
        "sender_id": new_msg.sender_id,
        "sender_name": current_user.name,
        "sender_avatar_color": getattr(current_user, 'avatar_color', '#4f46e5') or '#4f46e5',
        "sender_avatar_url": resolve_avatar_url(getattr(current_user, 'avatar_url', None)),
        "message": new_msg.message,
        "is_mine": True,
        "is_file": bool(new_msg.is_file),
        "file_path": file_url(new_msg.file_path) if new_msg.is_file and new_msg.file_path else None,
        "created_at": to_utc_iso(new_msg.created_at),
        "is_edited": False,
        "updated_at": None,
        "is_read": False,
        "reactions": {}
    }


@router.post("/forward-channel-message")
def forward_channel_message_to_dm(
    data: ForwardChannelMessageRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Forward a channel message (including files) to a direct message conversation."""
    if current_user.organization_id is None:
        raise HTTPException(status_code=403, detail="Personal accounts do not have access to chat features")

    orig = db.query(ChannelMessage).filter(ChannelMessage.id == data.channel_message_id).first()
    if not orig:
        raise HTTPException(status_code=404, detail="Channel message not found")

    other = db.query(User).filter(
        User.id == data.to_user_id,
        User.is_active == 1,
        User.organization_id == current_user.organization_id
    ).first()
    if not other:
        raise HTTPException(status_code=404, detail="User not found")
    if other.storage_used_mb >= other.storage_limit_mb:
        raise HTTPException(status_code=403, detail="Recipient has exhausted their storage quota and cannot receive messages.")

    conv = get_or_create_conversation(db, current_user.id, data.to_user_id)

    # Extract the stored filename from file_path (strip any base URL prefix)
    raw_file_path = getattr(orig, 'file_path', None)
    if raw_file_path and raw_file_path.startswith('http'):
        # Strip URL prefix to get bare stored filename
        raw_file_path = raw_file_path.split('/files/')[-1].split('/uploads/')[-1]

    new_msg = ChatMessage(
        conversation_id=conv.id,
        sender_id=current_user.id,
        message=orig.message,
        is_file=getattr(orig, 'is_file', 0),
        file_path=raw_file_path
    )
    db.add(new_msg)
    from datetime import datetime
    conv.updated_at = now_ist()
    db.commit()
    db.refresh(new_msg)

    return {
        "id": new_msg.id,
        "sender_id": new_msg.sender_id,
        "sender_name": current_user.name,
        "sender_avatar_color": getattr(current_user, 'avatar_color', '#4f46e5') or '#4f46e5',
        "sender_avatar_url": resolve_avatar_url(getattr(current_user, 'avatar_url', None)),
        "message": new_msg.message,
        "is_mine": True,
        "is_file": bool(new_msg.is_file),
        "file_path": file_url(new_msg.file_path) if new_msg.is_file and new_msg.file_path else None,
        "created_at": to_utc_iso(new_msg.created_at),
        "is_edited": False,
        "is_read": False,
        "reactions": {}
    }


@router.post("/forward-any")
def forward_any_to_dm(
    data: ForwardAnyRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.organization_id is None:
        raise HTTPException(status_code=403, detail="Personal accounts do not have access to chat features")

    if check_and_update_storage(db, current_user):
        raise HTTPException(status_code=403, detail="Your storage quota is exhausted. You cannot forward messages.")

    if data.source_type == "channel":
        orig = db.query(ChannelMessage).filter(ChannelMessage.id == data.source_id).first()
        if not orig: raise HTTPException(status_code=404, detail="Channel message not found")
    else:
        orig = db.query(ChatMessage).filter(ChatMessage.id == data.source_id).first()
        if not orig: raise HTTPException(status_code=404, detail="Chat message not found")

    other = db.query(User).filter(
        User.id == data.to_user_id,
        User.is_active == 1,
        User.organization_id == current_user.organization_id
    ).first()
    if not other:
        raise HTTPException(status_code=404, detail="User not found")
    if other.storage_used_mb >= other.storage_limit_mb:
        raise HTTPException(status_code=403, detail="Recipient has exhausted their storage quota and cannot receive messages.")

    conv = get_or_create_conversation(db, current_user.id, data.to_user_id)

    raw_file_path = getattr(orig, 'file_path', None)
    if raw_file_path and raw_file_path.startswith('http'):
        raw_file_path = raw_file_path.split('/files/')[-1].split('/uploads/')[-1]

    is_file = getattr(orig, 'is_file', 0)
    new_msg = ChatMessage(
        conversation_id=conv.id,
        sender_id=current_user.id,
        message=orig.message,
        is_file=is_file,
        file_path=raw_file_path
    )
    db.add(new_msg)
    from datetime import datetime
    conv.updated_at = now_ist()
    db.commit()
    db.refresh(new_msg)

    return {"status": "ok", "id": new_msg.id}


@router.post("/upload")
def upload_chat_file(
    to_user_id: int = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        if current_user.organization_id is None:
            return JSONResponse(
                status_code=403,
                content={"detail": "Personal accounts do not have access to chat features"}
            )
            
        if check_and_update_storage(db, current_user):
            return JSONResponse(status_code=403, content={"detail": "Your storage quota is exhausted. You cannot upload files."})

        import os, uuid, mimetypes
        from config import UPLOAD_DIR, MAX_UPLOAD_SIZE_MB

        # ── 1. Extension blocklist ──────────────────────────────────────────
        BLOCKED_EXTS = {
            '.exe', '.bat', '.cmd', '.scr', '.vbs', '.pif', '.com',
            '.jar', '.ps1', '.sh', '.msi', '.dll', '.reg', '.cpl',
            '.hta', '.js', '.jse', '.wsf', '.wsh', '.inf'
        }
        ext = os.path.splitext(file.filename or '')[1].lower()
        if ext in BLOCKED_EXTS:
            return JSONResponse(
                status_code=400,
                content={"detail": f"File type '{ext}' is not allowed for security reasons."}
            )

        # ── 2. Magic byte scan (detect dangerous files by header) ──────────
        header = file.file.read(16)
        
        # Known dangerous magic byte signatures
        BLOCKED_SIGNATURES = [
            b'MZ',           # Windows PE executable
            b'\x7fELF',      # Linux ELF
            b'\xca\xfe\xba\xbe',  # Java class
        ]
        for sig in BLOCKED_SIGNATURES:
            if header.startswith(sig):
                print(f"[SECURITY] Blocked file with magic bytes {sig.hex()}: {file.filename}")
                return JSONResponse(
                    status_code=400,
                    content={"detail": "File blocked: executable format detected by content scan."}
                )

        # ── 3. Save file using optimized synchronous copy in threadpool ──
        import shutil
        os.makedirs(UPLOAD_DIR, exist_ok=True)
        stored_name = f"{uuid.uuid4().hex}{ext}"
        path = os.path.join(UPLOAD_DIR, stored_name)
        
        with open(path, "wb") as f:
            f.write(header)
            shutil.copyfileobj(file.file, f)
            
        file_size = os.path.getsize(path)
        max_bytes = MAX_UPLOAD_SIZE_MB * 1024 * 1024
        if file_size > max_bytes:
            os.remove(path)
            return JSONResponse(
                status_code=400,
                content={"detail": f"File exceeds maximum size of {MAX_UPLOAD_SIZE_MB}MB."}
            )

        # ── 4. Verify recipient and save message ────────────────────────────

        # Verify other user is in same org
        other = db.query(User).filter(
            User.id == to_user_id, 
            User.is_active == 1,
            User.organization_id == current_user.organization_id
        ).first()
        if not other:
            return JSONResponse(status_code=404, content={"detail": "User not found or not in your organization"})
        if other.storage_used_mb >= other.storage_limit_mb:
            return JSONResponse(status_code=403, content={"detail": "Recipient has exhausted their storage quota and cannot receive files."})

        # ── 6. Save message to DB ───────────────────────────────────────────
        conv = get_or_create_conversation(db, current_user.id, to_user_id)
        msg = ChatMessage(
            conversation_id=conv.id,
            sender_id=current_user.id,
            message=file.filename,
            is_file=1,
            file_path=stored_name
        )
        db.add(msg)
        conv.updated_at = now_ist()
        db.commit()
        db.refresh(msg)

        return {
            "id": msg.id,
            "sender_id": msg.sender_id,
            "sender_name": current_user.name,
            "sender_avatar_color": getattr(current_user, 'avatar_color', '#4f46e5') or '#4f46e5',
            "sender_avatar_url": resolve_avatar_url(getattr(current_user, 'avatar_url', None)),

            "message": msg.message,
            "is_mine": True,
            "is_file": True,
            "file_path": file_url(msg.file_path),
            "created_at": to_utc_iso(msg.created_at),
            "is_edited": False,
            "updated_at": None,
            "is_read": False,
            "scan_status": "clean",
            "reactions": {}
        }
    except Exception as e:
        tb = traceback.format_exc()
        print("UPLOAD ERROR:", tb)
        return JSONResponse(
            status_code=500,
            content={"error": str(e), "detail": tb}
        )

@router.post("/upload-stream")
async def upload_chat_file_stream(
    request: Request,
    to_user_id: int,
    filename: str,
    mime_type: str = "",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Raw binary upload endpoint to handle massive files (e.g. 600MB) without python-multipart limits.
    """
    from services.storage_service import check_and_update_storage
    if check_and_update_storage(db, current_user):
        return JSONResponse(status_code=403, content={"detail": "Your storage quota is exhausted. You cannot upload files."})

    from config import UPLOAD_DIR, MAX_UPLOAD_SIZE_MB, file_url, resolve_avatar_url
    import uuid
    import os

    ext = os.path.splitext(filename or "")[1].lower()

    # Security: check allowed extensions
    BLOCKED_EXTS = ['.exe', '.sh', '.bat', '.cmd', '.msi', '.vbs', '.js', '.jar']
    if ext in BLOCKED_EXTS:
        return JSONResponse(
            status_code=400,
            content={"detail": f"File type '{ext}' is not allowed for security reasons."}
        )

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    stored_name = f"{uuid.uuid4().hex}{ext}"
    path = os.path.join(UPLOAD_DIR, stored_name)
    
    max_bytes = MAX_UPLOAD_SIZE_MB * 1024 * 1024
    file_size = 0
    header_checked = False
    buffer = b""
    
    BLOCKED_SIGNATURES = [
        b'MZ', b'\x7fELF', b'\xca\xfe\xba\xbe',
    ]

    try:
        with open(path, "wb") as f:
            async for chunk in request.stream():
                if not chunk:
                    continue
                
                if not header_checked:
                    buffer += chunk
                    if len(buffer) >= 16:
                        header_checked = True
                        for sig in BLOCKED_SIGNATURES:
                            if buffer.startswith(sig):
                                raise Exception("File blocked: executable format detected by content scan.")

                file_size += len(chunk)
                if file_size > max_bytes:
                    raise Exception(f"File exceeds maximum size of {MAX_UPLOAD_SIZE_MB}MB.")
                
                f.write(chunk)
    except Exception as e:
        import traceback
        import logging
        logging.getLogger("vmail.chat_api").error(f"Upload failed: {str(e)}\n{traceback.format_exc()}")
        
        if os.path.exists(path):
            try:
                os.remove(path)
            except:
                pass
        return JSONResponse(status_code=400, content={"detail": str(e)})

    # Verify recipient and save message
    other = db.query(User).filter(
        User.id == to_user_id,
        User.organization_id == current_user.organization_id
    ).first()
    if not other:
        return JSONResponse(status_code=404, content={"detail": "User not found"})

    conv = get_or_create_conversation(db, current_user.id, to_user_id)
    msg = ChatMessage(
        conversation_id=conv.id,
        sender_id=current_user.id,
        message=filename,
        is_file=1,
        file_path=stored_name
    )
    db.add(msg)
    conv.updated_at = now_ist()
    db.commit()
    db.refresh(msg)
    
    return {
        "id": msg.id,
        "sender_id": msg.sender_id,
        "sender_name": current_user.name,
        "sender_avatar_color": getattr(current_user, 'avatar_color', '#4f46e5') or '#4f46e5',
        "sender_avatar_url": resolve_avatar_url(getattr(current_user, 'avatar_url', None)),
        "message": msg.message,
        "is_mine": True,
        "is_file": True,
        "file_path": file_url(msg.file_path),
        "created_at": to_utc_iso(msg.created_at),
        "is_edited": False,
        "updated_at": None,
        "is_read": False,
        "scan_status": "clean",
        "reactions": {}
    }


@router.get("/unread-count")
def get_unread_count(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        count = db.query(func.count(ChatMessage.id)).join(
            ChatConversation, ChatMessage.conversation_id == ChatConversation.id
        ).filter(
            or_(ChatConversation.user1_id == current_user.id, ChatConversation.user2_id == current_user.id),
            ChatMessage.sender_id != current_user.id,
            ChatMessage.is_read == 0
        ).scalar()
        return {"unread": count or 0}
    except Exception as e:
        tb = traceback.format_exc()
        print("UNREAD COUNT ERROR:", tb)
        return JSONResponse(status_code=500, content={"error": str(e), "detail": tb})


class ReactMessageRequest(BaseModel):
    reaction: str


@router.post("/messages/{message_id}/react")
def react_message(
    message_id: int,
    data: ReactMessageRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        import json
        msg = db.query(ChatMessage).filter(ChatMessage.id == message_id).first()
        if not msg:
            raise HTTPException(status_code=404, detail="Message not found")

        try:
            reactions_dict = json.loads(msg.reactions) if msg.reactions else {}
        except Exception:
            reactions_dict = {}

        reaction = data.reaction.strip()
        if not reaction:
            raise HTTPException(status_code=400, detail="Reaction cannot be empty")

        user_list = reactions_dict.get(reaction, [])
        
        was_same_reaction = False
        for u in user_list:
            if u["id"] == current_user.id:
                was_same_reaction = True
                break
                
        if was_same_reaction:
            # Toggle off: remove user from this specific reaction
            reactions_dict[reaction] = [u for u in reactions_dict[reaction] if u["id"] != current_user.id]
            if not reactions_dict[reaction]:
                del reactions_dict[reaction]
        else:
            # Toggle on: add user to this specific reaction
            if reaction not in reactions_dict:
                reactions_dict[reaction] = []
            reactions_dict[reaction].append({
                "id": current_user.id,
                "name": current_user.name
            })

        msg.reactions = json.dumps(reactions_dict, ensure_ascii=False)
        db.commit()

        return {"status": "ok", "reactions": reactions_dict}
    except HTTPException:
        raise
    except Exception as e:
        tb = traceback.format_exc()
        print("REACT MESSAGE ERROR:", tb)
        return JSONResponse(status_code=500, content={"error": str(e), "detail": tb})