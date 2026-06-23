import asyncio
import json
import os
import time as time_module
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt
from fastapi import Depends, FastAPI, Header, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from database import (
    init_db, get_current_occupation, get_history, get_stats_today, get_db_stats,
    get_capacity, get_thresholds, get_status, get_config, set_config,
    reset_occupation, clear_history,
)
from mqtt_handler import MQTTHandler
from predictor import get_prediction

# ── Rate limiting ─────────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address)

# ── Auth publique (API Key) ────────────────────────────────────────
API_KEY = os.getenv("API_KEY", "dev-key")

async def verify_api_key(x_api_key: str = Header(None)):
    if x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Clé API invalide ou manquante")

# ── Auth admin (JWT) ───────────────────────────────────────────────
ADMIN_USER     = os.getenv("ADMIN_USER", "admin")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "biblioflow2024")
JWT_SECRET     = os.getenv("JWT_SECRET", "biblioflow-change-in-prod")
JWT_ALGO       = "HS256"
JWT_HOURS      = 8

def create_admin_token() -> str:
    payload = {
        "sub": ADMIN_USER,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_HOURS),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)

async def get_admin(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token admin requis")
    token = authorization.split(" ", 1)[1]
    try:
        jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expirée, reconnectez-vous")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token invalide")

# ── Pydantic models ───────────────────────────────────────────────
class AdminLoginRequest(BaseModel):
    username: str
    password: str

class ConfigUpdateRequest(BaseModel):
    capacity:           Optional[int] = None
    threshold_warning:  Optional[int] = None
    threshold_critical: Optional[int] = None

class ResetOccupationRequest(BaseModel):
    value: int = 0

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
_loop:         asyncio.AbstractEventLoop = None
_mqtt_handler: MQTTHandler              = None
_start_time:   float                    = None

def on_mqtt_message(data: dict):
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
app = FastAPI(title="BiblioFlow API", version="4.0.0", lifespan=lifespan)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "*").split(","),
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["*"],
)

# ── Helper ────────────────────────────────────────────────────────
def _occupation_payload(occ: int) -> dict:
    cap      = get_capacity()
    w, c     = get_thresholds()
    rate     = round(occ / cap * 100, 1) if cap > 0 else 0.0
    return {
        "occupation":         occ,
        "capacity":           cap,
        "rate":               rate,
        "status":             get_status(rate),
        "threshold_warning":  w,
        "threshold_critical": c,
    }

# ── Routes publiques ──────────────────────────────────────────────
@app.get("/health")
@limiter.limit("60/minute")
def health(request: Request):
    occ = get_current_occupation()
    return {
        "status":             "ok",
        "mqtt_connected":     _mqtt_handler.is_connected if _mqtt_handler else False,
        "db_accessible":      True,
        "current_occupation": occ,
        "capacity":           get_capacity(),
        "uptime_seconds":     int(time_module.time() - _start_time) if _start_time else 0,
    }

@app.get("/occupation")
@limiter.limit("60/minute")
def occupation(request: Request):
    return _occupation_payload(get_current_occupation())

@app.get("/history")
@limiter.limit("30/minute")
def history(request: Request, limit: int = 100):
    limit = min(max(1, limit), 1000)
    return get_history(limit)

@app.get("/stats")
@limiter.limit("30/minute")
def stats(request: Request):
    return get_stats_today()

@app.get("/prediction")
@limiter.limit("10/minute")
def prediction(request: Request):
    return get_prediction()

@app.get("/anomalies")
@limiter.limit("20/minute")
def anomalies(request: Request, _: None = Depends(verify_api_key)):
    current = get_current_occupation()
    pred    = get_prediction()
    if pred.get("error") or not pred.get("forecast"):
        return {"anomaly": False, "reason": "forecast_unavailable", "current": current}

    now_hour = datetime.now().strftime("%Y-%m-%dT%H")
    point    = next((p for p in pred["forecast"] if p["ds"].startswith(now_hour)), pred["forecast"][0])
    yhat     = point["yhat"]
    spread   = point["yhat_upper"] - point["yhat_lower"]
    std      = spread / 3.92 if spread > 0 else 1.0
    deviation = (current - yhat) / std if std > 0 else 0.0
    is_anomaly = abs(deviation) > 2.0
    message = None
    if is_anomaly:
        direction = "au-dessus" if deviation > 0 else "en-dessous"
        message = f"Occupation {abs(deviation):.1f}σ {direction} de la prévision ({yhat} attendu, {current} observé)"
    return {"anomaly": bool(is_anomaly), "current": current, "expected": yhat,
            "deviation_sigma": round(deviation, 2), "message": message}

# ── Routes admin ──────────────────────────────────────────────────
@app.post("/admin/login")
@limiter.limit("10/minute")
def admin_login(request: Request, body: AdminLoginRequest):
    """Authentification admin — retourne un JWT valable 8 h."""
    if body.username != ADMIN_USER or body.password != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Identifiants incorrects")
    token = create_admin_token()
    return {"token": token, "expires_in": JWT_HOURS * 3600, "username": ADMIN_USER}

@app.get("/admin/config")
@limiter.limit("30/minute")
def admin_get_config(request: Request, _: None = Depends(get_admin)):
    """Retourne la configuration courante + état système."""
    w, c = get_thresholds()
    occ  = get_current_occupation()
    cap  = get_capacity()
    return {
        "capacity":           cap,
        "threshold_warning":  w,
        "threshold_critical": c,
        "current_occupation": occ,
        "rate":               round(occ / cap * 100, 1) if cap > 0 else 0.0,
        "mqtt_connected":     _mqtt_handler.is_connected if _mqtt_handler else False,
        "uptime_seconds":     int(time_module.time() - _start_time) if _start_time else 0,
        "db_stats":           get_db_stats(),
    }

@app.post("/admin/config")
@limiter.limit("20/minute")
async def admin_update_config(request: Request, body: ConfigUpdateRequest, _: None = Depends(get_admin)):
    """Met à jour la configuration (capacity, seuils)."""
    if body.capacity is not None:
        if not (1 <= body.capacity <= 10000):
            raise HTTPException(400, "Capacité doit être entre 1 et 10 000")
        set_config("capacity", body.capacity)
    if body.threshold_warning is not None:
        if not (1 <= body.threshold_warning <= 99):
            raise HTTPException(400, "Seuil alerte doit être entre 1 et 99 %")
        set_config("threshold_warning", body.threshold_warning)
    if body.threshold_critical is not None:
        w = int(get_config("threshold_warning") or 70)
        if not (w < body.threshold_critical <= 100):
            raise HTTPException(400, f"Seuil critique doit être > seuil alerte ({w} %)")
        set_config("threshold_critical", body.threshold_critical)

    # Notifier tous les clients WebSocket de la nouvelle config
    cap  = get_capacity()
    w, c = get_thresholds()
    occ  = get_current_occupation()
    rate = round(occ / cap * 100, 1) if cap > 0 else 0.0
    await manager.broadcast({
        "event":              "config_updated",
        "capacity":           cap,
        "threshold_warning":  w,
        "threshold_critical": c,
        "occupation":         occ,
        "rate":               rate,
        "status":             get_status(rate),
    })
    return {"ok": True, "capacity": cap, "threshold_warning": w, "threshold_critical": c}

@app.post("/admin/reset-occupation")
@limiter.limit("10/minute")
async def admin_reset_occupation(request: Request, body: ResetOccupationRequest, _: None = Depends(get_admin)):
    """Remet l'occupation à une valeur donnée (default 0)."""
    value = max(0, body.value)
    reset_occupation(value)
    payload = _occupation_payload(value)
    payload["event"] = "reset"
    await manager.broadcast(payload)
    return {"ok": True, "occupation": value}

@app.delete("/admin/history")
@limiter.limit("5/minute")
async def admin_clear_history(request: Request, _: None = Depends(get_admin)):
    """Efface tout l'historique des événements."""
    clear_history()
    await manager.broadcast({"event": "history_cleared", "occupation": 0})
    return {"ok": True, "message": "Historique effacé"}

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
