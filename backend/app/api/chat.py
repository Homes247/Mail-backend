import traceback
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, and_, func
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo

from app.database import get_db
from app.api.auth import get_current_user
from app.models.user import User
from app.models.chat import ChatConversation, ChatMessage
from app.models.channel import Channel, ChannelMember, ChannelMessage

IST_OFFSET = timezone(timedelta(hours=5, minutes=30))
IST = ZoneInfo("Asia/Kolkata")

def now_ist() -> datetime:
    return datetime.now(IST).replace(tzinfo=None)

def to_utc_iso(dt) -> str:
    if not dt: return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=IST_OFFSET)
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")

router = APIRouter(tags=["chat"])

class SendMessageRequest(BaseModel):
    to_user_id: int
    message: str

async def get_or_create_conversation(db: AsyncSession, user1_id: int, user2_id: int) -> ChatConversation:
    uid1, uid2 = min(user1_id, user2_id), max(user1_id, user2_id)
    result = await db.execute(select(ChatConversation).where(
        ChatConversation.user1_id == uid1,
        ChatConversation.user2_id == uid2
    ))
    conv = result.scalar_one_or_none()
    if not conv:
        conv = ChatConversation(user1_id=uid1, user2_id=uid2)
        db.add(conv)
        await db.commit()
        await db.refresh(conv)
    return conv

@router.get("/conversations")
async def get_conversations(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        result = await db.execute(
            select(ChatConversation).where(
                or_(
                    ChatConversation.user1_id == current_user.id,
                    ChatConversation.user2_id == current_user.id
                )
            ).order_by(ChatConversation.updated_at.desc())
        )
        convs = result.scalars().all()
        
        response = []
        if not convs:
            return response

        # Collect IDs for batched queries
        other_user_ids = []
        conv_ids = []
        for conv in convs:
            conv_ids.append(conv.id)
            other_user_ids.append(conv.user2_id if conv.user1_id == current_user.id else conv.user1_id)

        # Batch fetch users
        res_users = await db.execute(select(User).where(User.id.in_(other_user_ids)))
        users_dict = {u.id: u for u in res_users.scalars().all()}

        # Batch fetch unread counts
        # select conv_id, count(*) from messages where conv_id in (...) and sender_id != me and is_read = 0 group by conv_id
        res_unread = await db.execute(
            select(ChatMessage.conversation_id, func.count(ChatMessage.id))
            .where(
                ChatMessage.conversation_id.in_(conv_ids),
                ChatMessage.sender_id != current_user.id,
                ChatMessage.is_read == 0
            )
            .group_by(ChatMessage.conversation_id)
        )
        unread_dict = {row[0]: row[1] for row in res_unread.all()}

        # Batch fetch last messages (using a subquery or by just fetching latest per conv)
        # For simplicity and DB compatibility, we fetch the latest message per conversation
        # MySQL/MariaDB: select m.* from messages m inner join (select conversation_id, max(created_at) as max_c from messages group by conversation_id) grouped on m.conversation_id = grouped.conversation_id and m.created_at = grouped.max_c
        subq = (
            select(
                ChatMessage.conversation_id,
                func.max(ChatMessage.created_at).label('max_time')
            )
            .where(ChatMessage.conversation_id.in_(conv_ids))
            .group_by(ChatMessage.conversation_id)
            .subquery()
        )
        res_msgs = await db.execute(
            select(ChatMessage)
            .join(subq, and_(
                ChatMessage.conversation_id == subq.c.conversation_id,
                ChatMessage.created_at == subq.c.max_time
            ))
        )
        # If multiple messages have exact same max_time, we might get duplicates, so we map by ID
        last_msgs_dict = {}
        for m in res_msgs.scalars().all():
            last_msgs_dict[m.conversation_id] = m

        for conv in convs:
            other_id = conv.user2_id if conv.user1_id == current_user.id else conv.user1_id
            other = users_dict.get(other_id)
            if not other: continue

            last_msg = last_msgs_dict.get(conv.id)
            if not last_msg: continue

            unread = unread_dict.get(conv.id, 0)

            response.append({
                "conversation_id": conv.id,
                "other_user": {
                    "id": other.id,
                    "name": other.name,
                    "email": other.email,
                    "avatar_color": getattr(other, 'avatar_color', '#4f46e5') or '#4f46e5',
                    "avatar_url": getattr(other, 'avatar_url', None),
                },
                "last_message": last_msg.message,
                "last_time": to_utc_iso(last_msg.created_at),
                "unread": unread,
                "updated_at": to_utc_iso(conv.updated_at) if conv.updated_at else to_utc_iso(conv.created_at)
            })

        return response
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/messages/{other_user_id}")
async def get_messages(other_user_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        conv = await get_or_create_conversation(db, current_user.id, other_user_id)
        
        # Mark read (Async update requires a slightly different approach or just manual mapping)
        res_unread = await db.execute(select(ChatMessage).where(
            ChatMessage.conversation_id == conv.id,
            ChatMessage.sender_id != current_user.id,
            ChatMessage.is_read == 0
        ))
        unreads = res_unread.scalars().all()
        for u in unreads:
            u.is_read = 1
        if unreads:
            await db.commit()
            
        res_msg = await db.execute(select(ChatMessage).where(ChatMessage.conversation_id == conv.id).order_by(ChatMessage.created_at.asc()))
        messages = res_msg.scalars().all()
        
        res_other = await db.execute(select(User).where(User.id == other_user_id))
        other = res_other.scalar_one_or_none()
        
        if not other:
            raise HTTPException(404, "User not found")
            
        # Manually fetch senders since async relationships can be tricky without joinedload
        msgs_response = []
        for m in messages:
            sender_name = current_user.name if m.sender_id == current_user.id else other.name
            sender_color = current_user.avatar_color if m.sender_id == current_user.id else other.avatar_color
            sender_url = current_user.avatar_url if m.sender_id == current_user.id else other.avatar_url
            
            msgs_response.append({
                "id": m.id,
                "sender_id": m.sender_id,
                "sender_name": sender_name,
                "sender_avatar_color": sender_color or '#4f46e5',
                "sender_avatar_url": sender_url,
                "message": m.message if not m.delete_status else "[[DELETED]]",
                "is_mine": m.sender_id == current_user.id,
                "is_file": bool(m.is_file),
                "file_path": m.file_path,
                "created_at": to_utc_iso(m.created_at),
                "is_read": bool(m.is_read)
            })
            
        return {
            "conversation_id": conv.id,
            "other_user": {
                "id": other.id,
                "name": other.name,
                "email": other.email,
                "avatar_color": getattr(other, 'avatar_color', '#4f46e5') or '#4f46e5',
                "avatar_url": getattr(other, 'avatar_url', None)
            },
            "messages": msgs_response
        }
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/send")
async def send_message(data: SendMessageRequest, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        res_other = await db.execute(select(User).where(User.id == data.to_user_id))
        other = res_other.scalar_one_or_none()
        if not other: raise HTTPException(404, "User not found")
        
        conv = await get_or_create_conversation(db, current_user.id, data.to_user_id)
        msg = ChatMessage(conversation_id=conv.id, sender_id=current_user.id, message=data.message)
        db.add(msg)
        conv.updated_at = now_ist()
        await db.commit()
        await db.refresh(msg)
        
        return {
            "id": msg.id,
            "sender_id": msg.sender_id,
            "sender_name": current_user.name,
            "sender_avatar_color": getattr(current_user, 'avatar_color', '#4f46e5') or '#4f46e5',
            "message": msg.message,
            "is_mine": True,
            "created_at": to_utc_iso(msg.created_at)
        }
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/channels")
async def get_channels(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    res = await db.execute(
        select(Channel).join(ChannelMember, Channel.id == ChannelMember.channel_id)
        .where(ChannelMember.user_id == current_user.id)
    )
    channels = res.scalars().all()
    response = []
    for c in channels:
        res_msg = await db.execute(select(ChannelMessage).where(ChannelMessage.channel_id == c.id).order_by(ChannelMessage.created_at.desc()).limit(1))
        last = res_msg.scalar_one_or_none()
        response.append({
            "id": c.id,
            "name": c.name,
            "last_message": last.message if last else "No messages",
            "last_time": to_utc_iso(last.created_at) if last else None
        })
    return response

@router.get("/channels/{channel_id}/messages")
async def get_channel_messages(channel_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    res = await db.execute(select(ChannelMessage).where(ChannelMessage.channel_id == channel_id).order_by(ChannelMessage.created_at.asc()))
    messages = res.scalars().all()
    
    # Check if channel exists
    res_chan = await db.execute(select(Channel).where(Channel.id == channel_id))
    channel = res_chan.scalar_one_or_none()
    if not channel: raise HTTPException(404, "Channel not found")
    
    msgs_response = []
    for m in messages:
        res_sender = await db.execute(select(User).where(User.id == m.sender_id))
        sender = res_sender.scalar_one_or_none()
        msgs_response.append({
            "id": m.id,
            "sender_id": m.sender_id,
            "sender_name": sender.name if sender else "Unknown",
            "sender_avatar_color": getattr(sender, 'avatar_color', '#4f46e5') if sender else '#4f46e5',
            "sender_avatar_url": getattr(sender, 'avatar_url', None) if sender else None,
            "message": m.message,
            "is_mine": m.sender_id == current_user.id,
            "created_at": to_utc_iso(m.created_at)
        })
        
    return {
        "channel_id": channel_id,
        "channel_name": channel.name,
        "messages": msgs_response
    }

class SendChannelMessageRequest(BaseModel):
    message: str

@router.post("/channels/{channel_id}/send")
async def send_channel_message(channel_id: int, data: SendChannelMessageRequest, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    res_chan = await db.execute(select(Channel).where(Channel.id == channel_id))
    channel = res_chan.scalar_one_or_none()
    if not channel: raise HTTPException(404, "Channel not found")
    
    msg = ChannelMessage(channel_id=channel_id, sender_id=current_user.id, message=data.message)
    db.add(msg)
    await db.commit()
    await db.refresh(msg)
    
    return {
        "id": msg.id,
        "sender_id": msg.sender_id,
        "sender_name": current_user.name,
        "message": msg.message,
        "is_mine": True,
        "created_at": to_utc_iso(msg.created_at)
    }

@router.get("/contacts")
async def get_contacts(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    res = await db.execute(select(User).where(User.organization_id == current_user.organization_id))
    users = res.scalars().all()
    return [{"id": u.id, "name": u.name, "email": u.email, "avatar_color": u.avatar_color, "avatar_url": u.avatar_url, "last_login": to_utc_iso(u.last_login) if hasattr(u, 'last_login') else None} for u in users]