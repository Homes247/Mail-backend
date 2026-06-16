from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Request
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, and_, asc
from database import get_db
from middleware.jwt_middleware import get_current_user
from models.user import User
from models.channel import Channel, ChannelMember, ChannelMessage
from models.group import Group, GroupMember
from pydantic import BaseModel
from typing import Optional, List
import os
import uuid
import json
from config import UPLOAD_DIR, file_url, resolve_avatar_url
from datetime import datetime, timezone, timedelta
from services.storage_service import check_and_update_storage

IST_OFFSET = timezone(timedelta(hours=5, minutes=30))

def now_ist() -> datetime:
    """Always returns current IST time as naive datetime (for MySQL storage)."""
    return datetime.now(IST_OFFSET).replace(tzinfo=None)

def to_utc_iso(dt) -> str:
    """Convert a stored naive IST datetime → UTC ISO string for the frontend."""
    if not dt: return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=IST_OFFSET)
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")

router = APIRouter(prefix="/channels", tags=["channels"])

class CreateChannelRequest(BaseModel):
    name: str
    description: Optional[str] = None
    is_private: int = 0

class ForwardChannelAnyRequest(BaseModel):
    source_id: int
    source_type: str # "chat" or "channel"

class UpdateChannelRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None

class SendChannelMessageRequest(BaseModel):
    message: str

def sync_groups_to_channels(db: Session, organization_id: int):
    # Find all groups in the organization
    groups = db.query(Group).filter(Group.organization_id == organization_id).all()
    for g in groups:
        channel_name = g.name.strip()
        # Check if corresponding channel exists
        channel = db.query(Channel).filter(
            func.lower(Channel.name) == func.lower(channel_name),
            Channel.organization_id == organization_id
        ).first()
        if not channel:
            channel = Channel(
                name=channel_name,
                description=g.description,
                is_private=0,
                created_by=g.created_by,
                organization_id=organization_id,
                avatar_url=getattr(g, 'avatar_url', None)
            )
            db.add(channel)
            db.flush()
        else:
            group_avatar = getattr(g, 'avatar_url', None)
            if group_avatar and channel.avatar_url != group_avatar:
                channel.avatar_url = group_avatar
        
        # Sync members: only ADD missing group members, never remove manually-added members
        group_member_ids = {m.user_id for m in g.members}
        chan_members = db.query(ChannelMember).filter(ChannelMember.channel_id == channel.id).all()
        chan_member_ids = {m.user_id for m in chan_members}
        
        # Add group members who aren't in the channel yet
        for uid in group_member_ids - chan_member_ids:
            db.add(ChannelMember(channel_id=channel.id, user_id=uid, is_admin=1 if uid == channel.created_by else 0))
    db.commit()

@router.get("/")
def get_my_channels(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not current_user.organization_id:
        return []
    sync_groups_to_channels(db, current_user.organization_id)
    memberships = db.query(ChannelMember).filter(ChannelMember.user_id == current_user.id).all()
    result = []
    for m in memberships:
        ch = m.channel
        last_msg = db.query(ChannelMessage).filter(
            ChannelMessage.channel_id == ch.id
        ).order_by(ChannelMessage.created_at.desc()).first()
        result.append({
            "id": ch.id,
            "name": ch.name,
            "description": ch.description,
            "is_private": ch.is_private,
            "is_admin": getattr(m, "is_admin", 0) == 1,
            "member_count": db.query(ChannelMember).filter(ChannelMember.channel_id == ch.id).count(),
            "avatar_url": resolve_avatar_url(getattr(ch, "avatar_url", None)),
            "last_message": last_msg.message[:60] if last_msg else None,
            "last_time": to_utc_iso(last_msg.created_at) if last_msg else None,
        })
    return result

@router.get("/all")
def get_all_channels(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not current_user.organization_id:
        return []
    sync_groups_to_channels(db, current_user.organization_id)
    channels = db.query(Channel).filter(Channel.organization_id == current_user.organization_id).all()
    member_channel_ids = {m.channel_id for m in db.query(ChannelMember).filter(ChannelMember.user_id == current_user.id).all()}
    return [{
        "id": ch.id,
        "name": ch.name,
        "description": ch.description,
        "is_private": ch.is_private,
        "member_count": db.query(ChannelMember).filter(ChannelMember.channel_id == ch.id).count(),
        "is_member": ch.id in member_channel_ids,
        "avatar_url": resolve_avatar_url(getattr(ch, "avatar_url", None))
    } for ch in channels]

@router.post("/")
def create_channel(data: CreateChannelRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not current_user.organization_id:
        raise HTTPException(status_code=403, detail="Personal accounts do not have access to channels")
    existing = db.query(Channel).filter(Channel.name == data.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Channel name already exists")
    ch = Channel(
        name=data.name, 
        description=data.description, 
        is_private=data.is_private, 
        created_by=current_user.id,
        organization_id=current_user.organization_id
    )
    db.add(ch)
    db.flush()
    db.add(ChannelMember(channel_id=ch.id, user_id=current_user.id, is_admin=1))
    
    existing_group = db.query(Group).filter(func.lower(Group.name) == func.lower(ch.name), Group.organization_id == current_user.organization_id).first()
    if not existing_group:
        grp = Group(
            name=ch.name,
            description=ch.description,
            created_by=current_user.id,
            organization_id=current_user.organization_id
        )
        db.add(grp)
        db.flush()
        db.add(GroupMember(group_id=grp.id, user_id=current_user.id))
        
    db.commit()
    db.refresh(ch)
    return {"id": ch.id, "name": ch.name, "description": ch.description}

@router.post("/{channel_id}/join")
def join_channel(channel_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not current_user.organization_id:
        raise HTTPException(status_code=403, detail="Personal accounts do not have access to channels")
    ch = db.query(Channel).filter(Channel.id == channel_id, Channel.organization_id == current_user.organization_id).first()
    if not ch:
        raise HTTPException(status_code=404, detail="Channel not found")
    existing = db.query(ChannelMember).filter(ChannelMember.channel_id == channel_id, ChannelMember.user_id == current_user.id).first()
    if not existing:
        db.add(ChannelMember(channel_id=channel_id, user_id=current_user.id))
        
        group = db.query(Group).filter(func.lower(Group.name) == func.lower(ch.name), Group.organization_id == current_user.organization_id).first()
        if group:
            if not db.query(GroupMember).filter(GroupMember.group_id == group.id, GroupMember.user_id == current_user.id).first():
                db.add(GroupMember(group_id=group.id, user_id=current_user.id))
                
        db.commit()
    return {"message": "Joined"}

@router.get("/{channel_id}/members")
def get_channel_members(channel_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    member = db.query(ChannelMember).filter(ChannelMember.channel_id == channel_id, ChannelMember.user_id == current_user.id).first()
    if not member:
        raise HTTPException(status_code=403, detail="Not a member")
    members = db.query(ChannelMember).filter(ChannelMember.channel_id == channel_id).all()
    return [{
        "id": m.user.id,
        "name": m.user.name,
        "email": m.user.email,
        "avatar_color": m.user.avatar_color,
        "avatar_url": resolve_avatar_url(getattr(m.user, "avatar_url", None)),
        "is_admin": bool(getattr(m, "is_admin", 0))
    } for m in members]

class EditChannelMessageRequest(BaseModel):
    message: str

@router.delete("/messages/{message_id}")
@router.post("/messages/{message_id}/delete")
def delete_channel_message(message_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    msg = db.query(ChannelMessage).filter(
        ChannelMessage.id == message_id,
        ChannelMessage.sender_id == current_user.id
    ).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found or not yours")
    msg.delete_status = 1
    msg.message = "[[DELETED]]"
    msg.is_file = 0
    msg.file_path = None
    msg.attachment_name = None
    msg.attachment_size = None
    msg.reactions = "{}"
    db.commit()
    db.refresh(msg)
    return {"status": "ok", "message": "[[DELETED]]"}

@router.put("/messages/{message_id}")
@router.post("/messages/{message_id}/edit")
def edit_channel_message(message_id: int, data: EditChannelMessageRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    msg = db.query(ChannelMessage).filter(
        ChannelMessage.id == message_id,
        ChannelMessage.sender_id == current_user.id
    ).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found or not yours")
    msg.message = data.message
    msg.is_edited = 1
    db.commit()
    db.refresh(msg)
    return {"status": "ok", "message": msg.message, "updated_at": to_utc_iso(msg.updated_at) if msg.updated_at else None}

@router.put("/{channel_id}")
def update_channel(channel_id: int, data: UpdateChannelRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    member = db.query(ChannelMember).filter(ChannelMember.channel_id == channel_id, ChannelMember.user_id == current_user.id).first()
    if not member or not getattr(member, 'is_admin', 0):
        raise HTTPException(status_code=403, detail="Admin access required")
    ch = db.query(Channel).filter(Channel.id == channel_id).first()
    if not ch:
        raise HTTPException(status_code=404, detail="Channel not found")
    old_name = ch.name
    if data.name is not None and data.name.strip() != old_name:
        new_name = data.name.strip()
        existing = db.query(Channel).filter(
            func.lower(Channel.name) == func.lower(new_name),
            Channel.organization_id == ch.organization_id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Channel name already exists")
        ch.name = new_name
        
        # update corresponding group
        group = db.query(Group).filter(
            func.lower(Group.name) == func.lower(old_name),
            Group.organization_id == ch.organization_id
        ).first()
        if group:
            group.name = new_name
            
    if data.description is not None:
        ch.description = data.description
    db.commit()
    db.refresh(ch)
    return {"id": ch.id, "name": ch.name, "description": ch.description}

@router.delete("/{channel_id}")
def delete_channel(channel_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    member = db.query(ChannelMember).filter(ChannelMember.channel_id == channel_id, ChannelMember.user_id == current_user.id).first()
    if not member or not getattr(member, 'is_admin', 0):
        raise HTTPException(status_code=403, detail="Admin access required")
    ch = db.query(Channel).filter(Channel.id == channel_id).first()
    if not ch:
        raise HTTPException(status_code=404, detail="Channel not found")
    db.delete(ch)
    
    group = db.query(Group).filter(func.lower(Group.name) == func.lower(ch.name), Group.organization_id == current_user.organization_id).first()
    if group:
        db.delete(group)
        
    db.commit()
    return {"message": "Channel deleted"}

@router.get("/{channel_id}/messages")
def get_channel_messages(channel_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    member = db.query(ChannelMember).filter(ChannelMember.channel_id == channel_id, ChannelMember.user_id == current_user.id).first()
    if not member:
        raise HTTPException(status_code=403, detail="Not a member")
    if check_and_update_storage(db, current_user):
        raise HTTPException(status_code=403, detail="Storage quota exhausted. You cannot access channel messages.")
    messages = db.query(ChannelMessage).filter(ChannelMessage.channel_id == channel_id).order_by(ChannelMessage.created_at.asc()).all()
    import json
    def safe_load_reactions(reactions_str):
        if not reactions_str:
            return {}
        try:
            return json.loads(reactions_str)
        except Exception:
            return {}
    from config import file_url
    return [{
        "id": m.id,
        "sender_id": m.sender_id,
        "sender_name": m.sender.name,
        "sender_avatar_color": m.sender.avatar_color,
        "sender_avatar_url": resolve_avatar_url(getattr(m.sender, 'avatar_url', None)),
        "message": m.message if not getattr(m, 'delete_status', 0) else "[[DELETED]]",
        "is_mine": m.sender_id == current_user.id,
        "is_file": bool(getattr(m, 'is_file', 0)) if not getattr(m, 'delete_status', 0) else False,
        "file_path": file_url(m.file_path) if getattr(m, 'is_file', 0) and m.file_path and not getattr(m, 'delete_status', 0) else None,
        "created_at": to_utc_iso(m.created_at),
        "is_edited": bool(getattr(m, 'is_edited', 0)),
        "updated_at": to_utc_iso(m.updated_at) if getattr(m, 'updated_at', None) else None,
        "delete_status": bool(getattr(m, 'delete_status', 0)),
        "is_read": True,
        "reactions": safe_load_reactions(getattr(m, 'reactions', None)),
        "attachment_name": m.attachment_name if not getattr(m, 'delete_status', 0) else None,
        "attachment_size": m.attachment_size if not getattr(m, 'delete_status', 0) else None
    } for m in messages]

@router.post("/{channel_id}/messages")
def send_channel_message(channel_id: int, data: SendChannelMessageRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    member = db.query(ChannelMember).filter(ChannelMember.channel_id == channel_id, ChannelMember.user_id == current_user.id).first()
    if not member:
        raise HTTPException(status_code=403, detail="Not a member")
    if check_and_update_storage(db, current_user):
        raise HTTPException(status_code=403, detail="Storage quota exhausted. You cannot send channel messages.")
    msg = ChannelMessage(channel_id=channel_id, sender_id=current_user.id, message=data.message, is_file=0)
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return {
        "id": msg.id,
        "sender_id": msg.sender_id,
        "sender_name": current_user.name,
        "sender_avatar_color": current_user.avatar_color,
        "sender_avatar_url": resolve_avatar_url(getattr(current_user, 'avatar_url', None)),
        "message": msg.message,
        "is_mine": True,
        "is_file": False,
        "file_path": None,
        "created_at": to_utc_iso(msg.created_at),
        "is_edited": False,
        "updated_at": None,
        "is_read": True,
        "reactions": {}
    }

class ReactChannelMessageRequest(BaseModel):
    reaction: str

@router.post("/messages/{message_id}/react")
def react_channel_message(
    message_id: int,
    data: ReactChannelMessageRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    import json
    msg = db.query(ChannelMessage).filter(ChannelMessage.id == message_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
        
    member = db.query(ChannelMember).filter(ChannelMember.channel_id == msg.channel_id, ChannelMember.user_id == current_user.id).first()
    if not member:
        raise HTTPException(status_code=403, detail="Not a member of this channel")

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



from fastapi import UploadFile, File

@router.post("/{channel_id}/upload")
def upload_channel_file(
    channel_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    member = db.query(ChannelMember).filter(ChannelMember.channel_id == channel_id, ChannelMember.user_id == current_user.id).first()
    if not member:
        raise HTTPException(status_code=403, detail="Not a member of this channel")
    if check_and_update_storage(db, current_user):
        raise HTTPException(status_code=403, detail="Storage quota exhausted. You cannot upload files to this channel.")
        
    import os, uuid
    from config import UPLOAD_DIR, MAX_UPLOAD_SIZE_MB, file_url

    BLOCKED_EXTS = {
        '.exe', '.bat', '.cmd', '.scr', '.vbs', '.pif', '.com',
        '.jar', '.ps1', '.sh', '.msi', '.dll', '.reg', '.cpl',
        '.hta', '.js', '.jse', '.wsf', '.wsh', '.inf'
    }
    ext = os.path.splitext(file.filename or '')[1].lower()
    if ext in BLOCKED_EXTS:
        raise HTTPException(status_code=400, detail=f"File type '{ext}' is not allowed.")

    # 1. Read first 16 bytes for magic header check
    header = file.file.read(16)
    
    BLOCKED_SIGNATURES = [
        b'MZ',           # Windows PE executable
        b'\x7fELF',      # Linux ELF
        b'\xca\xfe\xba\xbe',  # Java class
    ]
    for sig in BLOCKED_SIGNATURES:
        if header.startswith(sig):
            raise HTTPException(status_code=400, detail="File blocked: executable format detected.")

    # 2. Save to disk using optimized synchronous copy in threadpool
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
        raise HTTPException(status_code=400, detail=f"File exceeds maximum size of {MAX_UPLOAD_SIZE_MB}MB.")

    msg = ChannelMessage(
        channel_id=channel_id,
        sender_id=current_user.id,
        message=file.filename,
        is_file=1,
        file_path=stored_name,
        attachment_name=file.filename,
        attachment_size=file_size
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)

    return {
        "id": msg.id,
        "sender_id": msg.sender_id,
        "sender_name": current_user.name,
        "sender_avatar_color": current_user.avatar_color,
        "sender_avatar_url": resolve_avatar_url(getattr(current_user, 'avatar_url', None)),
        "message": msg.message,
        "is_mine": True,
        "is_file": True,
        "file_path": file_url(msg.file_path),
        "created_at": to_utc_iso(msg.created_at),
        "is_edited": False,
        "updated_at": None,
        "is_read": True,
        "reactions": {}
    }

@router.post("/{channel_id}/upload-stream")
async def upload_channel_file_stream(
    channel_id: int,
    request: Request,
    filename: str,
    mime_type: str = "",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from services.storage_service import check_and_update_storage
    if check_and_update_storage(db, current_user):
        raise HTTPException(status_code=403, detail="Your storage quota is exhausted. You cannot upload files.")

    member = db.query(ChannelMember).filter(ChannelMember.channel_id == channel_id, ChannelMember.user_id == current_user.id).first()
    if not member:
        raise HTTPException(status_code=403, detail="Not a member of this channel")

    from config import UPLOAD_DIR, MAX_UPLOAD_SIZE_MB, file_url, resolve_avatar_url
    import uuid
    import os

    ext = os.path.splitext(filename or "")[1].lower()
    BLOCKED_EXTS = ['.exe', '.sh', '.bat', '.cmd', '.msi', '.vbs', '.js', '.jar']
    if ext in BLOCKED_EXTS:
        raise HTTPException(status_code=400, detail=f"File type '{ext}' is not allowed.")

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    stored_name = f"{uuid.uuid4().hex}{ext}"
    path = os.path.join(UPLOAD_DIR, stored_name)
    
    max_bytes = MAX_UPLOAD_SIZE_MB * 1024 * 1024
    file_size = 0
    header_checked = False
    buffer = b""
    
    BLOCKED_SIGNATURES = [b'MZ', b'\x7fELF', b'\xca\xfe\xba\xbe']

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
                                raise Exception("File blocked: executable format detected.")

                file_size += len(chunk)
                if file_size > max_bytes:
                    raise Exception(f"File exceeds maximum size of {MAX_UPLOAD_SIZE_MB}MB.")
                
                f.write(chunk)
    except Exception as e:
        if os.path.exists(path):
            try:
                os.remove(path)
            except:
                pass
        raise HTTPException(status_code=400, detail=str(e))

    msg = ChannelMessage(
        channel_id=channel_id,
        sender_id=current_user.id,
        message=filename,
        is_file=1,
        file_path=stored_name,
        attachment_name=filename,
        attachment_size=file_size
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)

    return {
        "id": msg.id,
        "sender_id": msg.sender_id,
        "sender_name": current_user.name,
        "sender_avatar_color": current_user.avatar_color,
        "sender_avatar_url": resolve_avatar_url(getattr(current_user, 'avatar_url', None)),
        "message": msg.message,
        "is_mine": True,
        "is_file": True,
        "file_path": file_url(msg.file_path),
        "created_at": to_utc_iso(msg.created_at),
        "is_edited": False,
        "updated_at": None,
        "is_read": True,
        "reactions": {}
    }
@router.post("/{channel_id}/forward-any")
def forward_any_to_channel(
    channel_id: int,
    data: ForwardChannelAnyRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    member = db.query(ChannelMember).filter(ChannelMember.channel_id == channel_id, ChannelMember.user_id == current_user.id).first()
    if not member:
        raise HTTPException(status_code=403, detail="Not a member of this channel")
    if check_and_update_storage(db, current_user):
        raise HTTPException(status_code=403, detail="Storage quota exhausted. You cannot forward messages to this channel.")

    from models.chat import ChatMessage
    if data.source_type == "channel":
        orig = db.query(ChannelMessage).filter(ChannelMessage.id == data.source_id).first()
        if not orig: raise HTTPException(status_code=404, detail="Channel message not found")
    else:
        orig = db.query(ChatMessage).filter(ChatMessage.id == data.source_id).first()
        if not orig: raise HTTPException(status_code=404, detail="Chat message not found")

    raw_file_path = getattr(orig, 'file_path', None)
    if raw_file_path and raw_file_path.startswith('http'):
        raw_file_path = raw_file_path.split('/files/')[-1].split('/uploads/')[-1]

    is_file = getattr(orig, 'is_file', 0)
    new_msg = ChannelMessage(
        channel_id=channel_id,
        sender_id=current_user.id,
        message=orig.message if is_file else f"[Forwarded]: {orig.message}",
        is_file=is_file,
        file_path=raw_file_path,
        attachment_name=getattr(orig, 'attachment_name', None),
        attachment_size=getattr(orig, 'attachment_size', None)
    )
    db.add(new_msg)
    db.commit()
    db.refresh(new_msg)

    return {"status": "ok", "id": new_msg.id}



@router.post("/{channel_id}/avatar")
async def upload_channel_avatar(
    channel_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    channel = db.query(Channel).filter(
        Channel.id == channel_id,
        Channel.organization_id == current_user.organization_id
    ).first()
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
        
    member = db.query(ChannelMember).filter(ChannelMember.channel_id == channel_id, ChannelMember.user_id == current_user.id).first()
    if not member:
        raise HTTPException(status_code=403, detail="You must be a member to upload avatar")

    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Max 5MB")
    ext = os.path.splitext(file.filename or "avatar.jpg")[1].lower()
    if ext not in [".jpg", ".jpeg", ".png", ".gif", ".webp"]:
        raise HTTPException(status_code=400, detail="Invalid image type")
    stored_name = f"channel_avatar_{channel.id}_{uuid.uuid4().hex}{ext}"
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    with open(os.path.join(UPLOAD_DIR, stored_name), "wb") as f:
        f.write(content)
    channel.avatar_url = file_url(stored_name)
    
    # Sync with the corresponding group so it doesn't get overwritten
    group = db.query(Group).filter(
        func.lower(Group.name) == func.lower(channel.name),
        Group.organization_id == current_user.organization_id
    ).first()
    if group:
        group.avatar_url = channel.avatar_url

    db.commit()
    db.refresh(channel)
    return {
        "id": channel.id,
        "name": channel.name,
        "description": channel.description,
        "avatar_url": resolve_avatar_url(channel.avatar_url)
    }

class AddChannelMemberRequest(BaseModel):
    user_id: int

@router.post("/{channel_id}/members")
def add_channel_member(
    channel_id: int,
    data: AddChannelMemberRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not current_user.organization_id:
        raise HTTPException(status_code=403, detail="Personal accounts do not have access to channels")
    ch = db.query(Channel).filter(Channel.id == channel_id, Channel.organization_id == current_user.organization_id).first()
    if not ch:
        raise HTTPException(status_code=404, detail="Channel not found")
        
    current_member = db.query(ChannelMember).filter(ChannelMember.channel_id == channel_id, ChannelMember.user_id == current_user.id).first()
    if not current_member or not getattr(current_member, 'is_admin', 0):
        raise HTTPException(status_code=403, detail="Admin access required to add members")

    target_user = db.query(User).filter(User.id == data.user_id, User.organization_id == current_user.organization_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found in organization")
    existing = db.query(ChannelMember).filter(ChannelMember.channel_id == channel_id, ChannelMember.user_id == data.user_id).first()
    if not existing:
        db.add(ChannelMember(channel_id=channel_id, user_id=data.user_id))
        
        group = db.query(Group).filter(func.lower(Group.name) == func.lower(ch.name), Group.organization_id == current_user.organization_id).first()
        if group:
            if not db.query(GroupMember).filter(GroupMember.group_id == group.id, GroupMember.user_id == data.user_id).first():
                db.add(GroupMember(group_id=group.id, user_id=data.user_id))
                
        db.commit()
    return {"message": "User added"}

@router.post("/{channel_id}/leave")
def leave_channel(
    channel_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    member = db.query(ChannelMember).filter(ChannelMember.channel_id == channel_id, ChannelMember.user_id == current_user.id).first()
    if not member:
        raise HTTPException(status_code=400, detail="Not a member of this channel")
        
    # Auto-promote logic if the leaving user is an admin
    if getattr(member, 'is_admin', 0):
        other_admins = db.query(ChannelMember).filter(
            ChannelMember.channel_id == channel_id,
            ChannelMember.user_id != current_user.id,
            ChannelMember.is_admin == 1
        ).count()
        if other_admins == 0:
            # Pick the oldest member to promote
            oldest_member = db.query(ChannelMember).filter(
                ChannelMember.channel_id == channel_id,
                ChannelMember.user_id != current_user.id
            ).order_by(ChannelMember.joined_at.asc()).first()
            if oldest_member:
                oldest_member.is_admin = 1

    db.delete(member)
    
    ch = db.query(Channel).filter(Channel.id == channel_id).first()
    if ch:
        group = db.query(Group).filter(func.lower(Group.name) == func.lower(ch.name), Group.organization_id == current_user.organization_id).first()
        if group:
            group_member = db.query(GroupMember).filter(GroupMember.group_id == group.id, GroupMember.user_id == current_user.id).first()
            if group_member:
                db.delete(group_member)
                
    db.commit()
    return {"message": "Left channel"}

@router.delete("/{channel_id}/members/{user_id}")
def remove_channel_member(channel_id: int, user_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    admin_member = db.query(ChannelMember).filter(ChannelMember.channel_id == channel_id, ChannelMember.user_id == current_user.id).first()
    if not admin_member or not getattr(admin_member, 'is_admin', 0):
        raise HTTPException(status_code=403, detail="Admin access required")
    target_member = db.query(ChannelMember).filter(ChannelMember.channel_id == channel_id, ChannelMember.user_id == user_id).first()
    if not target_member:
        raise HTTPException(status_code=404, detail="Member not found")
    db.delete(target_member)
    
    ch = db.query(Channel).filter(Channel.id == channel_id).first()
    if ch:
        group = db.query(Group).filter(func.lower(Group.name) == func.lower(ch.name), Group.organization_id == current_user.organization_id).first()
        if group:
            group_member = db.query(GroupMember).filter(GroupMember.group_id == group.id, GroupMember.user_id == user_id).first()
            if group_member:
                db.delete(group_member)
                
    db.commit()
    return {"message": "Member removed"}

class SetAdminRequest(BaseModel):
    is_admin: int

@router.put("/{channel_id}/members/{user_id}/admin")
def set_channel_admin(channel_id: int, user_id: int, data: SetAdminRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    admin_member = db.query(ChannelMember).filter(ChannelMember.channel_id == channel_id, ChannelMember.user_id == current_user.id).first()
    if not admin_member or not getattr(admin_member, 'is_admin', 0):
        raise HTTPException(status_code=403, detail="Admin access required")
    target_member = db.query(ChannelMember).filter(ChannelMember.channel_id == channel_id, ChannelMember.user_id == user_id).first()
    if not target_member:
        raise HTTPException(status_code=404, detail="Member not found")
    target_member.is_admin = data.is_admin
    db.commit()
    return {"message": "Admin status updated"}