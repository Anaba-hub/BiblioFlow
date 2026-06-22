import sqlite3
from datetime import datetime

DB_PATH = "biblio.db"

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

def insert_event(event_type: str, occupation: int):
    conn = sqlite3.connect(DB_PATH)
    conn.execute(
        "INSERT INTO events (timestamp, event_type, occupation) VALUES (?, ?, ?)",
        (datetime.now().isoformat(), event_type, occupation)
    )
    conn.commit()
    conn.close()

def get_current_occupation() -> int:
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.execute(
        "SELECT occupation FROM events ORDER BY id DESC LIMIT 1"
    )
    row = cursor.fetchone()
    conn.close()
    return row[0] if row else 0

def get_history(limit: int = 100) -> list:
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.execute(
        "SELECT timestamp, event_type, occupation FROM events ORDER BY id DESC LIMIT ?",
        (limit,)
    )
    rows = cursor.fetchall()
    conn.close()
    return [
        {"timestamp": r[0], "event_type": r[1], "occupation": r[2]}
        for r in rows
    ]

def get_all_events() -> list:
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.execute(
        "SELECT timestamp, occupation FROM events ORDER BY id ASC"
    )
    rows = cursor.fetchall()
    conn.close()
    return rows
