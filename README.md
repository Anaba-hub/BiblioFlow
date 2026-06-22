# BiblioFlow — Monitoring d'occupation IoT + IA

Système de monitoring en temps réel de l'occupation d'une bibliothèque.  
Projet académique IoT + IA — RNCP 39394 (Expert SI & Sécurité).

---

## Architecture

```
ESP32 (Wokwi)
  └─ 2 capteurs de passage (boutons)
  └─ Machine à états A→B (entrée) / B→A (sortie)
  └─ MQTT publish → broker.hivemq.com:1883
     topic : biblio/occupation
     payload : {"occupation": 5, "event": "entry"}
        │
        ▼
HiveMQ (broker public MQTT)
        │
        ▼
Backend FastAPI (Python)
  └─ mqtt_handler.py  → souscription MQTT, validation payload, SQLite
  └─ database.py      → SQLite (table events : timestamp, event_type, occupation)
  └─ predictor.py     → Prophet — prévision 24 h (cache 30 min)
  └─ main.py          → REST API + WebSocket + rate limiting + auth
        │
        ├─ GET  /health          → monitoring (MQTT, DB, uptime)
        ├─ GET  /occupation      → occupation courante
        ├─ GET  /history         → historique événements
        ├─ GET  /stats           → KPIs du jour
        ├─ GET  /prediction      → forecast Prophet 24 h
        ├─ GET  /anomalies  🔒   → détection d'anomalie IA (X-Api-Key requis)
        └─ WS   /ws              → flux temps réel
        │
        ▼
Frontend React (Vite + Recharts + Tailwind)
  └─ OccupancyCounter  → compteur temps réel (WebSocket)
  └─ StatsPanel        → KPIs + badge anomalie IA
  └─ HistoryChart      → graphique historique
  └─ PredictionChart   → forecast avec zone de confiance
```

---

## Couverture RNCP 39394

| Bloc | Intitulé | Éléments du projet |
|------|----------|--------------------|
| **BC01** | Pilotage stratégique SI | Architecture multi-couches, Docker, CI/CD GitHub Actions, choix technologiques justifiés |
| **BC02** | Optimisation services & IA | Prophet 24 h, cache prévision, endpoint `/stats` (KPIs), détection d'anomalies IA (`/anomalies`) |
| **BC03** | Infrastructure & cybersécurité par IA | Conteneurisation Docker, rate limiting (slowapi), API Key auth, headers sécurité nginx, monitoring `/health` |
| **BC04** | IoT sécurisé + IA | ESP32 Wokwi, MQTT avec validation stricte des payloads, support credentials MQTT, Prophet pour analyse données IoT |

---

## Choix technologiques

| Décision | Alternative écartée | Raison |
|----------|---------------------|--------|
| **Prophet** | LSTM | Prophet gère mieux la saisonnalité avec peu de données ; pas besoin de GPU |
| **Modèle cumulatif** | Fenêtre glissante | Chaque jour enrichit le modèle ; meilleur sur le long terme |
| **SQLite** | PostgreSQL | Suffit pour ce POC ; zéro configuration |
| **HiveMQ public** | Broker privé | Simplifie le POC ; pas d'infra à gérer |
| **React + Vite** | Next.js | Pas besoin de SSR ; build statique déployable sur Vercel |

---

## Démarrage local

```bash
# Backend
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env       # optionnel
uvicorn main:app --reload

# Frontend (dans un autre terminal)
cd frontend
cp .env.example .env
npm install
npm run dev
# → http://localhost:5173
```

---

## Démarrage Docker

```bash
docker compose up --build

# Frontend : http://localhost
# Backend  : http://localhost:8000
```

Variables d'environnement (optionnelles) :

| Variable | Défaut | Description |
|----------|--------|-------------|
| `API_KEY` | `dev-key` | Clé pour `/anomalies` |
| `MQTT_USER` | _(vide)_ | Login MQTT (broker sécurisé) |
| `MQTT_PASSWORD` | _(vide)_ | Mot de passe MQTT |
| `MAX_OCCUPANCY` | `500` | Plafond de validation des payloads IoT |
| `CORS_ORIGINS` | `*` | Origines autorisées (ex: `https://monapp.vercel.app`) |

---

## Déploiement Vercel (frontend)

```bash
cd frontend
# Configurer dans Vercel : VITE_API_URL=https://ton-backend.com
#                          VITE_API_KEY=ta-cle-secrete
vercel deploy
```

---

## API Reference

```
GET  /health          → {"status":"ok","mqtt_connected":true,"uptime_seconds":3600,...}
GET  /occupation      → {"occupation": 5}
GET  /history?limit=  → [{timestamp, event_type, occupation}, ...]
GET  /stats           → {entries_today, exits_today, peak_hour, average_occupation, trend}
GET  /prediction      → {error, forecast:[{ds, yhat, yhat_lower, yhat_upper}]}
GET  /anomalies       → {anomaly, current, expected, deviation_sigma, message}
                        Header requis : X-Api-Key: <API_KEY>
WS   /ws              → {occupation, event}  (flux temps réel)
```

---

## Simulation Wokwi

1. Ouvrir [wokwi.com](https://wokwi.com) → nouveau projet ESP32
2. Importer `sensors/sketch.ino` et `sensors/diagram.json`
3. Panneau Libraries → ajouter **PubSubClient** et **LiquidCrystal I2C**  
   _(ou utiliser `sensors/libraries.txt` avec l'extension VS Code Wokwi)_
4. ▶ Play → attendre la connexion MQTT (LCD affiche l'IP)
5. Bouton **A** puis **B** → entrée enregistrée ; **B** puis **A** → sortie

---

## Structure du projet

```
BiblioFlow/
├── backend/           FastAPI + SQLite + MQTT + Prophet
├── frontend/          React + Vite + Recharts + Tailwind
├── sensors/           Firmware ESP32 + schéma Wokwi
├── docker-compose.yml
└── .github/workflows/ci.yml
```
