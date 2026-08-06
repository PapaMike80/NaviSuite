import json
import os
import sqlite3
import threading
from contextlib import contextmanager
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

DB_PATH = os.getenv("DB_PATH", "./data/orari.db")
CORS_ORIGINS = [item.strip() for item in os.getenv("CORS_ORIGINS", "*").split(",") if item.strip()]

app = FastAPI(title="NaviTurni Orari API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS if CORS_ORIGINS else ["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

_db_lock = threading.Lock()


class OrariPayload(BaseModel):
    data: dict[str, str] = Field(default_factory=dict)


class NavidiariaEntriesPayload(BaseModel):
    entries: list[dict] = Field(default_factory=list)


@contextmanager
def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


def init_db() -> None:
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    with get_db_connection() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS orari_table_state (
              id INTEGER PRIMARY KEY CHECK (id = 1),
              data TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              version INTEGER NOT NULL DEFAULT 0
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS navidiaria_entries (
              agent_id TEXT PRIMARY KEY,
              entries_json TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              version INTEGER NOT NULL DEFAULT 0
            )
            """
        )
        row = conn.execute("SELECT id FROM orari_table_state WHERE id = 1").fetchone()
        if row is None:
            conn.execute(
                "INSERT INTO orari_table_state (id, data, updated_at, version) VALUES (1, ?, ?, 0)",
                ("{}", datetime.now(timezone.utc).isoformat()),
            )
        conn.commit()


def load_state() -> tuple[dict[str, str], str, int]:
    with get_db_connection() as conn:
        row = conn.execute(
            "SELECT data, updated_at, version FROM orari_table_state WHERE id = 1"
        ).fetchone()
        if row is None:
            return {}, datetime.now(timezone.utc).isoformat(), 0
        try:
            data = json.loads(row["data"] or "{}")
            if not isinstance(data, dict):
                data = {}
        except json.JSONDecodeError:
            data = {}
        return data, row["updated_at"], int(row["version"])


def save_state(data: dict[str, str]) -> tuple[str, int]:
    updated_at = datetime.now(timezone.utc).isoformat()
    with _db_lock:
        with get_db_connection() as conn:
            row = conn.execute("SELECT version FROM orari_table_state WHERE id = 1").fetchone()
            current_version = int(row["version"]) if row else 0
            new_version = current_version + 1
            conn.execute(
                """
                UPDATE orari_table_state
                SET data = ?, updated_at = ?, version = ?
                WHERE id = 1
                """,
                (json.dumps(data, ensure_ascii=False), updated_at, new_version),
            )
            conn.commit()
    return updated_at, new_version


def load_navidiaria(agent_id: str) -> tuple[list[dict], str, int]:
    with get_db_connection() as conn:
        row = conn.execute(
            "SELECT entries_json, updated_at, version FROM navidiaria_entries WHERE agent_id = ?",
            (agent_id,),
        ).fetchone()
        if row is None:
            return [], "", 0
        try:
            entries = json.loads(row["entries_json"] or "[]")
            if not isinstance(entries, list):
                entries = []
        except json.JSONDecodeError:
            entries = []
        return entries, row["updated_at"], int(row["version"])


def save_navidiaria(agent_id: str, entries: list[dict]) -> tuple[str, int]:
    updated_at = datetime.now(timezone.utc).isoformat()
    with _db_lock:
        with get_db_connection() as conn:
            row = conn.execute(
                "SELECT version FROM navidiaria_entries WHERE agent_id = ?",
                (agent_id,),
            ).fetchone()
            current_version = int(row["version"]) if row else 0
            new_version = current_version + 1
            conn.execute(
                """
                INSERT INTO navidiaria_entries (agent_id, entries_json, updated_at, version)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(agent_id) DO UPDATE SET
                  entries_json = excluded.entries_json,
                  updated_at = excluded.updated_at,
                  version = excluded.version
                """,
                (agent_id, json.dumps(entries, ensure_ascii=False), updated_at, new_version),
            )
            conn.commit()
    return updated_at, new_version


@app.on_event("startup")
def on_startup() -> None:
    init_db()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/orari-tabella")
def get_orari_tabella() -> dict:
    data, updated_at, version = load_state()
    return {
        "ok": True,
        "data": data,
        "updatedAt": updated_at,
        "version": version,
    }


@app.put("/api/orari-tabella")
def put_orari_tabella(payload: OrariPayload) -> dict:
    if not isinstance(payload.data, dict):
        raise HTTPException(status_code=400, detail="Campo 'data' non valido")
    updated_at, version = save_state(payload.data)
    return {
        "ok": True,
        "savedKeys": len(payload.data),
        "updatedAt": updated_at,
        "version": version,
    }


@app.post("/api/orari-tabella")
def post_orari_tabella(payload: OrariPayload) -> dict:
    return put_orari_tabella(payload)


@app.get("/api/navidiaria/{agent_id}")
def get_navidiaria(agent_id: str) -> dict:
    normalized = str(agent_id or "").strip()
    if not normalized:
        raise HTTPException(status_code=400, detail="agent_id mancante")
    entries, updated_at, version = load_navidiaria(normalized)
    return {
        "ok": True,
        "agentId": normalized,
        "entries": entries,
        "updatedAt": updated_at,
        "version": version,
    }


@app.put("/api/navidiaria/{agent_id}")
def put_navidiaria(agent_id: str, payload: NavidiariaEntriesPayload) -> dict:
    normalized = str(agent_id or "").strip()
    if not normalized:
        raise HTTPException(status_code=400, detail="agent_id mancante")
    if not isinstance(payload.entries, list):
        raise HTTPException(status_code=400, detail="Campo 'entries' non valido")
    updated_at, version = save_navidiaria(normalized, payload.entries)
    return {
        "ok": True,
        "agentId": normalized,
        "savedEntries": len(payload.entries),
        "updatedAt": updated_at,
        "version": version,
    }


@app.post("/api/navidiaria/{agent_id}")
def post_navidiaria(agent_id: str, payload: NavidiariaEntriesPayload) -> dict:
    return put_navidiaria(agent_id, payload)
