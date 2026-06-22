import asyncio
import json
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from database import init_db, get_current_occupation, get_history
from mqtt_handler import MQTTHandler
from predictor import get_prediction

# ── WebSocket Manager ─────────────────────────────────────────────
class ConnectionManager:
    def __init__(self):
        self.clients: list[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.clients.append(ws)
        print(f"[WS] Client connecté — {len(self.clients)} actif(s)")

    def disconnect(self, ws: WebSocket):
        if ws in self.clients:
            self.clients.remove(ws)
            print(f"[WS] Client déconnecté — {len(self.clients)} actif(s)")

    async def broadcast(self, data: dict):
        if not self.clients:
            return
        message = json.dumps(data)
        dead    = []
        for ws in self.clients:
            try:
                await ws.send_text(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)

manager = ConnectionManager()
_loop: asyncio.AbstractEventLoop = None

def on_mqtt_message(data: dict):
    """Bridge thread MQTT → coroutine asyncio (thread-safe)."""
    if _loop and not _loop.is_closed():
        asyncio.run_coroutine_threadsafe(manager.broadcast(data), _loop)

# ── Cycle de vie ──────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    global _loop
    _loop = asyncio.get_running_loop()

    init_db()
    print("[DB] SQLite initialisé")

    mqtt = MQTTHandler(on_mqtt_message)
    mqtt.start()

    yield

    mqtt.stop()
    print("[MQTT] Déconnecté")

# ── Application ───────────────────────────────────────────────────
app = FastAPI(title="BiblioFlow API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routes REST ───────────────────────────────────────────────────
@app.get("/occupation")
def occupation():
    """Occupation courante."""
    return {"occupation": get_current_occupation()}

@app.get("/history")
def history(limit: int = 100):
    """Historique des événements (entrée/sortie)."""
    return get_history(limit)

@app.get("/prediction")
def prediction():
    """Prévision Prophet sur les 24 prochaines heures."""
    return get_prediction()

# ── WebSocket ─────────────────────────────────────────────────────
@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await manager.connect(ws)
    # Envoi immédiat de l'occupation courante au nouveau client
    await ws.send_text(json.dumps({
        "occupation": get_current_occupation(),
        "event": "init"
    }))
    try:
        while True:
            await ws.receive_text()   # maintient la connexion ouverte
    except WebSocketDisconnect:
        manager.disconnect(ws)
