import sqlite3
import os
from datetime import datetime

DB_PATH  = "biblio.db"
CAPACITY = int(os.getenv("CAPACITY", "50"))

def get_status(rate: float) -> str:
    if rate >= 90: return "saturé"
    if rate >= 70: return "chargé"
    return "normal"

def init_db():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS events (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp  TEXT    NOT NULL,
            event_type TEXT    NOT NULL,
            occupation INTEGER NOT NULL
        )
    """)
    conn.commit()
    conn.close()
    print(f"[DB] SQLite initialisé — capacité : {CAPACITY} personnes")

def insert_event(event_type: str, occupation: int):
    conn = sqlite3.connect(DB_PATH)
    conn.execute(
        "INSERT INTO events (timestamp, event_type, occupation) VALUES (?, ?, ?)",
        (datetime.now().isoformat(), event_type, occupation)
    )
    conn.commit()
    conn.close()

def get_current_occupation() -> int:
    """Retourne la dernière occupation issue d'un événement réel (entrée/sortie)."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.execute(
        "SELECT occupation FROM events WHERE event_type IN ('entry','exit') ORDER BY id DESC LIMIT 1"
    )
    row = cursor.fetchone()
    conn.close()
    return row[0] if row else 0

def get_history(limit: int = 100) -> list:
    """Historique complet : entrées, sorties ET événements suspects (timeout, demi-tour)."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.execute(
        "SELECT timestamp, event_type, occupation FROM events ORDER BY id DESC LIMIT ?",
        (limit,)
    )
    rows = cursor.fetchall()
    conn.close()
    result = []
    for r in rows:
        occ  = r[2]
        rate = round(occ / CAPACITY * 100, 1) if CAPACITY > 0 else 0.0
        result.append({
            "timestamp":  r[0],
            "event_type": r[1],
            "occupation": occ,
            "capacity":   CAPACITY,
            "rate":       rate,
            "status":     get_status(rate),
        })
    return result

def get_all_events() -> list:
    """Événements réels uniquement (pour l'entraînement Prophet)."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.execute(
        "SELECT timestamp, occupation FROM events "
        "WHERE event_type IN ('entry','exit') ORDER BY id ASC"
    )
    rows = cursor.fetchall()
    conn.close()
    return rows

def get_stats_today() -> dict:
    today = datetime.now().strftime("%Y-%m-%d")
    conn  = sqlite3.connect(DB_PATH)

    cursor = conn.execute(
        "SELECT event_type, COUNT(*) FROM events "
        "WHERE timestamp LIKE ? AND event_type IN ('entry','exit') GROUP BY event_type",
        (f"{today}%",)
    )
    counts  = {row[0]: row[1] for row in cursor.fetchall()}
    entries = counts.get("entry", 0)
    exits   = counts.get("exit", 0)

    cursor = conn.execute(
        "SELECT MAX(occupation), AVG(occupation) FROM events "
        "WHERE timestamp LIKE ? AND event_type IN ('entry','exit')",
        (f"{today}%",)
    )
    row      = cursor.fetchone()
    peak_occ = int(row[0]) if row[0] is not None else 0
    avg_occ  = round(row[1], 1) if row[1] is not None else 0.0

    cursor = conn.execute(
        "SELECT substr(timestamp,12,2) AS h, AVG(occupation) AS a "
        "FROM events WHERE timestamp LIKE ? AND event_type IN ('entry','exit') "
        "GROUP BY h ORDER BY a DESC LIMIT 1",
        (f"{today}%",)
    )
    row       = cursor.fetchone()
    peak_hour = f"{row[0]}:00" if row else None

    cursor = conn.execute(
        "SELECT COUNT(*) FROM events "
        "WHERE timestamp LIKE ? AND event_type IN ('timeout','half_turn')",
        (f"{today}%",)
    )
    suspects = cursor.fetchone()[0]

    conn.close()

    current   = get_current_occupation()
    peak_rate = round(peak_occ / CAPACITY * 100, 1) if CAPACITY > 0 else 0.0
    if avg_occ > 0:
        ratio = current / avg_occ
        trend = "hausse" if ratio > 1.2 else "baisse" if ratio < 0.8 else "stable"
    else:
        trend = "stable"

    return {
        "entries_today":      entries,
        "exits_today":        exits,
        "suspects_today":     suspects,
        "peak_hour":          peak_hour,
        "peak_occupation":    peak_occ,
        "peak_rate":          peak_rate,
        "average_occupation": avg_occ,
        "capacity":           CAPACITY,
        "trend":              trend,
    }
