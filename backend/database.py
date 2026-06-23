import sqlite3
import os
from datetime import datetime

DB_PATH = "biblio.db"

# ── Cache config en mémoire (invalidé à chaque set_config) ────────
_config_cache: dict = {}

# ── Config ────────────────────────────────────────────────────────

def get_config(key: str, default: str = None) -> str:
    if key in _config_cache:
        return _config_cache[key]
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.execute("SELECT value FROM config WHERE key = ?", (key,))
    row = cursor.fetchone()
    conn.close()
    val = row[0] if row else default
    if val is not None:
        _config_cache[key] = val
    return val

def set_config(key: str, value: str):
    _config_cache[key] = str(value)
    conn = sqlite3.connect(DB_PATH)
    conn.execute(
        "INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)",
        (key, str(value))
    )
    conn.commit()
    conn.close()

def get_capacity() -> int:
    val = get_config("capacity")
    return int(val) if val else int(os.getenv("CAPACITY", "50"))

def get_thresholds() -> tuple:
    """Retourne (seuil_warning %, seuil_critical %)."""
    w = get_config("threshold_warning")
    c = get_config("threshold_critical")
    return (int(w) if w else 70), (int(c) if c else 90)

def get_status(rate: float) -> str:
    warning, critical = get_thresholds()
    if rate >= critical: return "saturé"
    if rate >= warning:  return "chargé"
    return "normal"

# ── Init ──────────────────────────────────────────────────────────

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
    conn.execute("""
        CREATE TABLE IF NOT EXISTS config (
            key   TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )
    """)
    conn.commit()
    conn.close()
    cap = get_capacity()
    w, c = get_thresholds()
    print(f"[DB] SQLite initialisé — capacité {cap} pers., seuils {w}%/{c}%")

# ── Événements ────────────────────────────────────────────────────

def insert_event(event_type: str, occupation: int):
    conn = sqlite3.connect(DB_PATH)
    conn.execute(
        "INSERT INTO events (timestamp, event_type, occupation) VALUES (?, ?, ?)",
        (datetime.now().isoformat(), event_type, occupation)
    )
    conn.commit()
    conn.close()

def reset_occupation(value: int = 0):
    """Insère un événement spécial 'reset' pour remettre le compteur à une valeur."""
    insert_event("reset", max(0, value))

def clear_history():
    """Efface tous les événements de la base de données."""
    global _config_cache
    conn = sqlite3.connect(DB_PATH)
    conn.execute("DELETE FROM events")
    conn.commit()
    conn.close()

# ── Lectures ──────────────────────────────────────────────────────

def get_current_occupation() -> int:
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.execute(
        "SELECT occupation FROM events "
        "WHERE event_type IN ('entry','exit','reset') ORDER BY id DESC LIMIT 1"
    )
    row = cursor.fetchone()
    conn.close()
    return row[0] if row else 0

def get_history(limit: int = 100) -> list:
    cap = get_capacity()
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
        rate = round(occ / cap * 100, 1) if cap > 0 else 0.0
        result.append({
            "timestamp":  r[0],
            "event_type": r[1],
            "occupation": occ,
            "capacity":   cap,
            "rate":       rate,
            "status":     get_status(rate),
        })
    return result

def get_all_events() -> list:
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.execute(
        "SELECT timestamp, occupation FROM events "
        "WHERE event_type IN ('entry','exit','reset') ORDER BY id ASC"
    )
    rows = cursor.fetchall()
    conn.close()
    return rows

def get_db_stats() -> dict:
    conn = sqlite3.connect(DB_PATH)
    total    = conn.execute("SELECT COUNT(*) FROM events").fetchone()[0]
    entries  = conn.execute("SELECT COUNT(*) FROM events WHERE event_type='entry'").fetchone()[0]
    exits    = conn.execute("SELECT COUNT(*) FROM events WHERE event_type='exit'").fetchone()[0]
    suspects = conn.execute(
        "SELECT COUNT(*) FROM events WHERE event_type IN ('timeout','half_turn')"
    ).fetchone()[0]
    conn.close()
    return {
        "total_events": total,
        "entries":      entries,
        "exits":        exits,
        "suspects":     suspects,
    }

def get_stats_today() -> dict:
    today = datetime.now().strftime("%Y-%m-%d")
    cap   = get_capacity()
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
        "WHERE timestamp LIKE ? AND event_type IN ('entry','exit','reset')",
        (f"{today}%",)
    )
    row      = cursor.fetchone()
    peak_occ = int(row[0]) if row[0] is not None else 0
    avg_occ  = round(row[1], 1) if row[1] is not None else 0.0

    cursor = conn.execute(
        "SELECT substr(timestamp,12,2) AS h, AVG(occupation) AS a "
        "FROM events WHERE timestamp LIKE ? AND event_type IN ('entry','exit','reset') "
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
    peak_rate = round(peak_occ / cap * 100, 1) if cap > 0 else 0.0
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
        "capacity":           cap,
        "trend":              trend,
    }
