import os
import json
from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.database import engine, Base
from app.api import documents, export, auth

load_dotenv()

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:4200")

import uuid

class ConnectionManager:
    def __init__(self):
        self.rooms: dict[str, dict[str, WebSocket]] = {}

    async def connect(self, doc_id: str, ws: WebSocket) -> str:
        await ws.accept()
        client_id = str(uuid.uuid4())
        self.rooms.setdefault(doc_id, {})[client_id] = ws
        return client_id

    def disconnect(self, doc_id: str, client_id: str):
        if doc_id in self.rooms and client_id in self.rooms[doc_id]:
            del self.rooms[doc_id][client_id]
            if not self.rooms[doc_id]:
                del self.rooms[doc_id]

    async def broadcast(self, doc_id: str, message: str, sender_id: str = None):
        if doc_id not in self.rooms:
            return
        dead = []
        for cid, ws in self.rooms[doc_id].items():
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

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL, "http://localhost:4200"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router,      prefix="/api/auth",      tags=["auth"])
app.include_router(documents.router, prefix="/api/documents", tags=["documents"])
app.include_router(export.router,    prefix="/api",           tags=["export"])


@app.websocket("/ws/{doc_id}")
async def websocket_endpoint(websocket: WebSocket, doc_id: str):
    client_id = await manager.connect(doc_id, websocket)

    count = manager.user_count(doc_id)
    await manager.broadcast(doc_id, json.dumps({"type": "presence", "users": count}), sender_id=client_id)
    await websocket.send_text(json.dumps({"type": "presence", "users": count}))

    try:
        while True:
            data = await websocket.receive_text()
            msg  = json.loads(data)
            if msg.get("type") == "update":
                payload = json.dumps({
                    "type":    "update",
                    "content": msg.get("content"),
                    "title":   msg.get("title"),
                    "users":   manager.user_count(doc_id),
                })
                await manager.broadcast(doc_id, payload, sender_id=client_id)
            elif msg.get("type") == "cursor":
                payload = json.dumps({
                    "type": "cursor",
                    "client_id": client_id,
                    "r": msg.get("r"),
                    "c": msg.get("c"),
                })
                await manager.broadcast(doc_id, payload, sender_id=client_id)
    except WebSocketDisconnect:
        manager.disconnect(doc_id, client_id)
        await manager.broadcast(
            doc_id,
            json.dumps({"type": "cursor_remove", "client_id": client_id}),
            sender_id=None
        )
        await manager.broadcast(
            doc_id,
            json.dumps({"type": "presence", "users": manager.user_count(doc_id)}),
            sender_id=None
        )