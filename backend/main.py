import os
import json
import logging
import traceback
import uuid

from dotenv import load_dotenv
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.database import engine, Base
from app.api import documents, export, auth, chat

load_dotenv(override=True)

logger = logging.getLogger("uvicorn.error")


def _build_allowed_origins() -> list[str]:
    origins = {"http://localhost:4200", "http://127.0.0.1:4200"}
    env_url = os.getenv("FRONTEND_URL", "").strip()
    if env_url:
        origins.add(env_url)
    # Allow any LAN IP on port 4200 via wildcard not supported by CORSMiddleware,
    # so we also allow the explicit LAN host if set.
    extra = os.getenv("EXTRA_ORIGINS", "")  # comma-separated, e.g. http://192.168.0.10:4200
    for o in extra.split(","):
        o = o.strip()
        if o:
            origins.add(o)
    return list(origins)



import time
import asyncio
from app.lib.document_storage import DocumentStorage
from app.database import SessionLocal
from app.models.document import Document

class ConnectionManager:
    def __init__(self):
        self.rooms: dict[str, dict[str, WebSocket]] = {}
        self.doc_states: dict[str, dict] = {}

    async def _ensure_state(self, doc_id: str):
        if doc_id not in self.doc_states:
            async with SessionLocal() as db:
                doc = await db.get(Document, doc_id)
                content_str = "{}"
                if doc and doc.file_path:
                    try:
                        content_str = await asyncio.to_thread(
                            DocumentStorage.load,
                            doc.owner_id, doc.id,
                            doc.doc_type, doc.file_path
                        )
                    except Exception:
                        pass
                
                state_data = []
                try:
                    state_data = json.loads(content_str)
                except Exception:
                    pass
                if isinstance(state_data, dict):
                    state_data = [state_data]
                    
                self.doc_states[doc_id] = {
                    "seq": 0,
                    "sheets": state_data,
                    "dirty": False,
                    "last_save": time.time(),
                    "doc_info": {
                        "id": doc.id if doc else doc_id,
                        "owner_id": doc.owner_id if doc else 0,
                        "doc_type": doc.doc_type if doc else "sheet"
                    }
                }

    async def connect(self, doc_id: str, ws: WebSocket) -> str:
        await ws.accept()
        await self._ensure_state(doc_id)
        
        client_id = str(uuid.uuid4())
        self.rooms.setdefault(doc_id, {})[client_id] = ws
        
        # Send initial full state
        state = self.doc_states[doc_id]
        payload = json.dumps({
            "type": "update",
            "content": json.dumps(state["sheets"]),
            "seq": state["seq"]
        })
        await ws.send_text(payload)
        
        return client_id

    def disconnect(self, doc_id: str, client_id: str):
        room = self.rooms.get(doc_id)
        if room and client_id in room:
            del room[client_id]
            if not room:
                del self.rooms[doc_id]
                self.doc_states.pop(doc_id, None)

    async def broadcast(self, doc_id: str, message: str, sender_id: str | None = None):
        room = self.rooms.get(doc_id)
        if not room:
            return
        dead = []
        for cid, ws in room.items():
            if cid == sender_id:
                continue
            try:
                await ws.send_text(message)
            except Exception:
                dead.append(cid)
        for cid in dead:
            self.disconnect(doc_id, cid)

    def user_count(self, doc_id: str) -> int:
        return len(self.rooms.get(doc_id, {}))


    async def save_if_dirty(self, doc_id: str):
        state = self.doc_states.get(doc_id)
        if not state or not state["dirty"]:
            return
        now = time.time()
        if now - state["last_save"] < 5.0:
            return
            
        state["dirty"] = False
        state["last_save"] = now
        
        doc_info = state["doc_info"]
        content_str = json.dumps(state["sheets"])
        try:
            await asyncio.to_thread(
                DocumentStorage.save,
                doc_info["owner_id"], doc_info["id"],
                content_str, doc_type=doc_info["doc_type"]
            )
        except Exception:
            pass

    async def _autosave_loop(self):
        while True:
            await asyncio.sleep(5)
            doc_ids = list(self.doc_states.keys())
            for doc_id in doc_ids:
                try:
                    await self.save_if_dirty(doc_id)
                except Exception:
                    pass

manager = ConnectionManager()




@asynccontextmanager
async def lifespan(app: FastAPI):
    import asyncio
    asyncio.create_task(manager._autosave_loop())
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Pre-warm the connection pool so first requests don't pay ~300ms cold-connect cost
    async def _warm():
        from sqlalchemy import text
        async with engine.connect() as c:
            await c.execute(text("SELECT 1"))
    try:
        await asyncio.gather(*[_warm() for _ in range(3)])
        logger.info("Connection pool warmed up (3 connections)")
    except Exception as e:
        logger.warning(f"Pool warmup failed (non-fatal): {e}")

    yield


app = FastAPI(title="Office Suite API", lifespan=lifespan)

# CORS must be added BEFORE the error-catcher middleware so it runs on
# error responses too.
app.add_middleware(
    CORSMiddleware,
    allow_origins=_build_allowed_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def critical_error_catcher(request: Request, call_next):
    try:
        return await call_next(request)
    except Exception as e:
        logger.exception(f"Unhandled error: {request.method} {request.url}")
        return JSONResponse(
            status_code=500,
            content={"detail": f"Internal server error: {type(e).__name__}: {e}"},
        )


app.include_router(auth.router,      prefix="/api/auth",      tags=["auth"])
app.include_router(documents.router, prefix="/api/documents", tags=["documents"])
app.include_router(export.router,    prefix="/api",           tags=["export"])
app.include_router(chat.router,      prefix="/api/chat",      tags=["chat"])


@app.websocket("/ws/{doc_id}")
async def websocket_endpoint(websocket: WebSocket, doc_id: str):
    client_id = await manager.connect(doc_id, websocket)

    count = manager.user_count(doc_id)
    presence = json.dumps({"type": "presence", "users": count})
    await manager.broadcast(doc_id, presence, sender_id=client_id)
    await websocket.send_text(presence)

    try:
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)
            msg_type = msg.get("type")


            if msg_type == "update":
                payload = json.dumps({
                    "type":    "update",
                    "content": msg.get("content"),
                    "title":   msg.get("title"),
                    "users":   manager.user_count(doc_id),
                })
                await manager.broadcast(doc_id, payload, sender_id=client_id)
                
            elif msg_type == "cell_update":
                sheet_idx = msg.get("sheetIdx", 0)
                r = msg.get("r")
                c = msg.get("c")
                value = msg.get("value")
                formatting = msg.get("formatting")
                
                state = manager.doc_states.get(doc_id)
                if state:
                    sheets = state["sheets"]
                    while len(sheets) <= sheet_idx:
                        sheets.append({})
                    sheet = sheets[sheet_idx]
                    
                    if "cells" not in sheet:
                        sheet["cells"] = {}
                    if str(r) not in sheet["cells"]:
                        sheet["cells"][str(r)] = {}
                    sheet["cells"][str(r)][str(c)] = value
                    
                    if "formats" not in sheet:
                        sheet["formats"] = {}
                    fmt_key = f"{r},{c}"
                    if formatting:
                        sheet["formats"][fmt_key] = formatting
                    else:
                        sheet["formats"].pop(fmt_key, None)
                        
                    state["seq"] += 1
                    state["dirty"] = True
                    
                    payload = json.dumps({
                        "type": "cell_update",
                        "sheetIdx": sheet_idx,
                        "r": r,
                        "c": c,
                        "value": value,
                        "formatting": formatting,
                        "seq": state["seq"]
                    })
                    await manager.broadcast(doc_id, payload, sender_id=client_id)


            elif msg_type == "cursor":
                payload = json.dumps({
                    "type":      "cursor",
                    "client_id": client_id,
                    "r":         msg.get("r"),
                    "c":         msg.get("c"),
                })
                await manager.broadcast(doc_id, payload, sender_id=client_id)

    except WebSocketDisconnect:
        manager.disconnect(doc_id, client_id)
        await manager.broadcast(
            doc_id,
            json.dumps({"type": "cursor_remove", "client_id": client_id}),
        )
        await manager.broadcast(
            doc_id,
            json.dumps({"type": "presence", "users": manager.user_count(doc_id)}),
        )