# Contributions de l'équipe — BiblioFlow

> À compléter par chaque membre avant la soutenance.

| Membre | Réalisations | Fichiers / éléments | Ce qu'il peut expliquer seul |
|--------|-------------|---------------------|------------------------------|
| [Prénom NOM] | Firmware ESP32 — machine à états, détection entrée/sortie, publication MQTT | `sensors/sketch.ino`, `sensors/diagram.json` | Logique A→B/B→A, timeout, demi-tour, protocole MQTT |
| [Prénom NOM] | Backend Python — API FastAPI, handler MQTT, base de données SQLite | `backend/main.py`, `backend/mqtt_handler.py`, `backend/database.py` | Endpoints REST, WebSocket, stockage événements |
| [Prénom NOM] | Prévision IA — modèle Prophet, cache, détection de pic | `backend/predictor.py` | Fonctionnement Prophet, saisonnalité, pic prévu |
| [Prénom NOM] | Frontend React — tableau de bord temps réel, graphiques, alertes | `frontend/src/` (tous les composants) | OccupancyCounter, HistoryTable, AlertBanner, WebSocket |
| [Prénom NOM] | Infrastructure — Docker, CI/CD GitHub Actions, déploiement | `Dockerfile`, `docker-compose.yml`, `.github/workflows/` | Conteneurisation, orchestration, déploiement Vercel |

---

## Logique de comptage (à expliquer en soutenance)

```
Capteur A (extérieur) → Capteur B (intérieur) dans < 3 s = ENTRÉE  (+1)
Capteur B (intérieur) → Capteur A (extérieur) dans < 3 s = SORTIE  (-1)
Un seul capteur déclenché, pas de 2e dans 3 s             = TIMEOUT (stocké, ignoré)
A→A ou B→B (même capteur deux fois)                       = DEMI-TOUR (stocké, ignoré)
Occupation minimale : 0 (jamais négative)
```

## Choix SQLite vs PostgreSQL

Le cahier des charges initial prévoyait PostgreSQL. Après analyse, nous avons choisi **SQLite** pour ce POC pour les raisons suivantes :

| Critère | SQLite (choix) | PostgreSQL |
|---------|----------------|------------|
| Configuration | Aucune (fichier local) | Serveur, utilisateur, mot de passe |
| Performances POC | < 1 ms par requête | Idem |
| Données attendues | ~ 500 événements/jour | > 100 000/jour |
| Migration production | Remplacer `sqlite3` par `psycopg2` + `DATABASE_URL` | — |

**Décision** : SQLite est suffisant pour un POC académique sur une seule machine. La migration PostgreSQL est documentée et réalisable en < 2 heures.

## Limites actuelles

1. Pas de gestion des passages simultanés (2 personnes au même instant)
2. Wokwi = simulation par boutons (pas de capteurs IR réels)
3. Broker HiveMQ public — pas d'authentification MQTT
4. Prophet nécessite ≥ 10 événements réels pour générer une prévision
5. La capacité maximale (50 par défaut) doit être configurée manuellement
