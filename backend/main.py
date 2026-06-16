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


class ConnectionManager:
    def __init__(self):
        self.rooms: dict[str, dict[str, WebSocket]] = {}

    async def connect(self, doc_id: str, ws: WebSocket) -> str:
        await ws.accept()
        client_id = str(uuid.uuid4())
        self.rooms.setdefault(doc_id, {})[client_id] = ws
        return client_id

    def disconnect(self, doc_id: str, client_id: str):
        room = self.rooms.get(doc_id)
        if room and client_id in room:
            del room[client_id]
            if not room:
                del self.rooms[doc_id]

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


manager = ConnectionManager()


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
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