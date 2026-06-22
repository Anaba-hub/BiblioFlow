import asyncio
import json
import os
import time as time_module
from contextlib import asynccontextmanager
from datetime import datetime

from fastapi import Depends, FastAPI, Header, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from database import (
    init_db, get_current_occupation, get_history, get_stats_today,
    CAPACITY, get_status,
)
from mqtt_handler import MQTTHandler
from predictor import get_prediction

# ── Rate limiting ─────────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address)

# ── Auth ──────────────────────────────────────────────────────────
API_KEY = os.getenv("API_KEY", "dev-key")

async def verify_api_key(x_api_key: str = Header(None)):
    if x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Clé API invalide ou manquante")

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
_mqtt_handler: MQTTHandler       = None
_start_time: float               = None

def on_mqtt_message(data: dict):
    """Bridge thread MQTT → coroutine asyncio (thread-safe)."""
    if _loop and not _loop.is_closed():
        asyncio.run_coroutine_threadsafe(manager.broadcast(data), _loop)

# ── Cycle de vie ──────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    global _loop, _mqtt_handler, _start_time
    _loop       = asyncio.get_running_loop()
    _start_time = time_module.time()

    init_db()

    _mqtt_handler = MQTTHandler(on_mqtt_message)
    _mqtt_handler.start()

    yield

    _mqtt_handler.stop()
    print("[MQTT] Déconnecté")

# ── Application ───────────────────────────────────────────────────
app = FastAPI(title="BiblioFlow API", version="3.0.0", lifespan=lifespan)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "*").split(","),
    allow_methods=["GET"],
    allow_headers=["*"],
)

# ── Helper ────────────────────────────────────────────────────────
def _occupation_payload(occ: int) -> dict:
    rate = round(occ / CAPACITY * 100, 1) if CAPACITY > 0 else 0.0
    return {
        "occupation": occ,
        "capacity":   CAPACITY,
        "rate":       rate,
        "status":     get_status(rate),
    }

# ── Routes publiques ──────────────────────────────────────────────
@app.get("/health")
@limiter.limit("60/minute")
def health(request: Request):
    """Monitoring : état MQTT, DB et uptime."""
    occ = get_current_occupation()
    return {
        "status":             "ok",
        "mqtt_connected":     _mqtt_handler.is_connected if _mqtt_handler else False,
        "db_accessible":      True,
        "current_occupation": occ,
        "capacity":           CAPACITY,
        "uptime_seconds":     int(time_module.time() - _start_time) if _start_time else 0,
    }

@app.get("/occupation")
@limiter.limit("60/minute")
def occupation(request: Request):
    """Occupation courante avec capacité, taux et statut."""
    return _occupation_payload(get_current_occupation())

@app.get("/history")
@limiter.limit("30/minute")
def history(request: Request, limit: int = 100):
    """Historique complet : entrées, sorties, timeouts, demi-tours."""
    limit = min(max(1, limit), 1000)
    return get_history(limit)

@app.get("/stats")
@limiter.limit("30/minute")
def stats(request: Request):
    """KPIs du jour : entrées, sorties, suspects, heure de pointe, tendance."""
    return get_stats_today()

@app.get("/prediction")
@limiter.limit("10/minute")
def prediction(request: Request):
    """Prévision Prophet 24 h avec pic et alerte imminente (cache 30 min)."""
    return get_prediction()

# ── Route protégée par API Key ────────────────────────────────────
@app.get("/anomalies")
@limiter.limit("20/minute")
def anomalies(request: Request, _: None = Depends(verify_api_key)):
    """Détection d'anomalie IA : compare occupation courante vs prévision Prophet."""
    current = get_current_occupation()
    pred    = get_prediction()

    if pred.get("error") or not pred.get("forecast"):
        return {
            "anomaly":  False,
            "reason":   "forecast_unavailable",
            "current":  current,
            "expected": None,
            "message":  None,
        }

    now_hour = datetime.now().strftime("%Y-%m-%dT%H")
    point    = next(
        (p for p in pred["forecast"] if p["ds"].startswith(now_hour)),
        pred["forecast"][0]
    )

    yhat      = point["yhat"]
    spread    = point["yhat_upper"] - point["yhat_lower"]
    std       = spread / 3.92 if spread > 0 else 1.0
    deviation = (current - yhat) / std if std > 0 else 0.0
    is_anomaly = abs(deviation) > 2.0

    message = None
    if is_anomaly:
        direction = "au-dessus" if deviation > 0 else "en-dessous"
        message = f"Occupation {abs(deviation):.1f}σ {direction} de la prévision ({yhat} attendu, {current} observé)"

    return {
        "anomaly":         bool(is_anomaly),
        "current":         current,
        "expected":        yhat,
        "deviation_sigma": round(deviation, 2),
        "message":         message,
    }

# ── WebSocket ─────────────────────────────────────────────────────
@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await manager.connect(ws)
    payload = _occupation_payload(get_current_occupation())
    payload["event"] = "init"
    await ws.send_text(json.dumps(payload))
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(ws)
