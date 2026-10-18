from __future__ import annotations

import argparse
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

from history import HistoryStore, PlayerMatch, normalize_ships
from models import SonarModel


class AiService:
    def __init__(self, history_path: str):
        self.store = HistoryStore(history_path)

    def save_history(self, payload: dict) -> dict:
        name = str(payload.get("playerName", "")).strip()
        match_id = str(payload.get("matchId", "")).strip()
        ships = payload.get("ships") or []
        shots = payload.get("shots") or []
        if not name or not match_id or not ships:
            raise ValueError("playerName, matchId and ships are required")
        record = PlayerMatch(
            player_name=name,
            match_id=match_id,
            ships=normalize_ships(ships),
            shots=[
                {
                    "row": int(s["row"]),
                    "col": int(s["col"]),
                    "result": "hit" if s.get("result") == "hit" else "miss",
                }
                for s in shots
                if "row" in s and "col" in s
            ],
            won=bool(payload.get("won", False)),
        )
        # Idempotent for React rerenders / accidental retries.
        existing = {(m.player_name.casefold(), m.match_id) for m in self.store.all()}
        key = (record.player_name.casefold(), record.match_id)
        if key not in existing:
            self.store.append(record)
        return {"ok": True, "matches": len(self.store.all())}

    def sonar(self, payload: dict) -> dict:
        shots = payload.get("shots") or []
        records = self.store.all()
        model = SonarModel(records)
        signals = model.scan(shots)
        return {
            "signals": [
                {"cells": signal.cells, "confidence": signal.confidence}
                for signal in signals
            ],
            "trainingMatches": len(records),
            "mode": "personalized" if records else "cold-start",
        }


class Handler(BaseHTTPRequestHandler):
    service: AiService

    def _headers(self, status: int = 200):
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
        self.end_headers()

    def do_OPTIONS(self):
        self._headers(204)

    def do_GET(self):
        if urlparse(self.path).path == "/health":
            self._headers()
            self.wfile.write(b'{"ok":true}')
            return
        self._headers(404)
        self.wfile.write(b'{"error":"not found"}')

    def do_POST(self):
        try:
            length = int(self.headers.get("Content-Length", "0"))
            body = json.loads(self.rfile.read(length).decode("utf-8") or "{}")
            path = urlparse(self.path).path
            if path == "/history":
                result = self.service.save_history(body)
            elif path == "/sonar":
                result = self.service.sonar(body)
            else:
                self._headers(404)
                self.wfile.write(b'{"error":"not found"}')
                return
            self._headers(200)
            self.wfile.write(json.dumps(result).encode("utf-8"))
        except Exception as exc:
            self._headers(400)
            self.wfile.write(json.dumps({"error": str(exc)}).encode("utf-8"))

    def log_message(self, fmt, *args):
        print("[ai-service] " + (fmt % args))


def main() -> None:
    parser = argparse.ArgumentParser(description="Local Battleship AI helper for Sonar + history")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8091)
    parser.add_argument("--history", default=str(Path(__file__).with_name("data") / "player-history.jsonl"))
    args = parser.parse_args()

    service = AiService(args.history)
    Handler.service = service
    server = ThreadingHTTPServer((args.host, args.port), Handler)
    print(f"AI service: http://{args.host}:{args.port}")
    print(f"History: {Path(args.history).resolve()}")
    print("Ctrl+C to stop")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
