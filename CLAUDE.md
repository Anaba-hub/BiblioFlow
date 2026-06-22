# BiblioFlow – Contexte projet pour Claude Code

## Ce que tu dois savoir

Je construis un système de monitoring d'occupation en temps réel pour une bibliothèque,
dans le cadre d'un projet académique IoT + IA.

### Architecture complète

```
ESP32 (Wokwi, simulé)
  └─ 2 boutons simulant des capteurs de passage
  └─ LCD1602 I2C + 3 LEDs (vert/ambre/rouge)
  └─ Machine à états : A→B = entrée, B→A = sortie
  └─ Publie en MQTT sur broker.hivemq.com, topic "biblio/occupation"
     Payload : {"occupation": 5, "event": "entry"}

Backend Python (FastAPI) — DÉJÀ CODÉ
  └─ mqtt_handler.py  : souscrit à HiveMQ, stocke en SQLite
  └─ database.py      : SQLite (table events : timestamp, event_type, occupation)
  └─ predictor.py     : Prophet — prévision 24h par agrégation horaire
  └─ main.py          : FastAPI
       GET  /occupation          → occupation courante
       GET  /history?limit=100   → historique événements
       GET  /prediction          → forecast Prophet 24h
       WS   /ws                  → flux temps réel (broadcast à chaque événement MQTT)

Frontend React — À CONSTRUIRE (c'est ta mission)
```

---

## Ta mission : construire le frontend React

### Stack attendue
- React + Vite
- Recharts pour les graphiques
- Tailwind CSS pour le style
- WebSocket natif (pas de lib externe)

### Ce que l'IHM doit afficher

**1. Compteur temps réel**
- Valeur d'occupation courante, mise à jour via WebSocket `/ws`
- Au chargement : appel `GET /occupation` pour l'état initial
- Indicateur de statut de connexion WebSocket (connecté / déconnecté)

**2. Historique**
- Graphique linéaire (Recharts LineChart)
- Source : `GET /history`
- Axe X : timestamp, Axe Y : occupation
- Rafraîchi automatiquement à chaque message WebSocket

**3. Prévision de pic (Prophet)**
- Graphique linéaire avec zone de confiance (yhat_lower / yhat_upper)
- Source : `GET /prediction`
- Affiche un message si `error` est non null (données insuffisantes)
- Bouton "Actualiser la prévision"

### Contraintes
- Backend tourne sur `http://localhost:8000` (configurable via `.env`)
- WebSocket : `ws://localhost:8000/ws`
- CORS déjà activé côté backend (allow_origins=["*"])
- Le frontend sera déployé sur Vercel — prévoir un `.env.example` avec VITE_API_URL

### Structure de fichiers attendue

```
frontend/
├── src/
│   ├── App.jsx
│   ├── components/
│   │   ├── OccupancyCounter.jsx
│   │   ├── HistoryChart.jsx
│   │   └── PredictionChart.jsx
│   ├── hooks/
│   │   └── useWebSocket.js
│   └── main.jsx
├── .env.example
├── index.html
└── package.json
```

---

## Format des données backend

**WebSocket message :**
```json
{"occupation": 5, "event": "entry"}
{"occupation": 5, "event": "init"}
```

**GET /history :**
```json
[
  {"timestamp": "2025-01-15T14:32:10", "event_type": "entry", "occupation": 5},
  ...
]
```

**GET /prediction :**
```json
{
  "error": null,
  "forecast": [
    {"ds": "2025-01-15T15:00:00", "yhat": 4.2, "yhat_lower": 2.1, "yhat_upper": 6.3},
    ...
  ]
}
```

---

## Ce qui a déjà été décidé (ne pas remettre en question)

- Prophet pour la prévision (pas LSTM)
- Modèle cumulatif (pas fenêtre glissante) — chaque jour enrichit le modèle
- Pas de gestion des passages simultanés (limitation assumée du POC)
- Broker MQTT public HiveMQ (pas d'auth)
- SQLite suffit pour ce POC (pas de PostgreSQL)

---

Commence par créer le projet Vite + React, installe les dépendances,
puis construis les composants dans l'ordre : OccupancyCounter → HistoryChart → PredictionChart.
