from __future__ import annotations

import json
import socket
from typing import Callable


class JsonLineClient:
    def __init__(self, host: str, port: int = 5050):
        self.host = host
        self.port = port
        self.sock: socket.socket | None = None
        self.buffer = ""

    def connect(self) -> None:
        self.sock = socket.create_connection((self.host, self.port), timeout=10)
        self.sock.settimeout(None)

    def send(self, message: dict) -> None:
        if self.sock is None:
            raise RuntimeError("Not connected")
        payload = json.dumps(message, separators=(",", ":")) + "\n"
        self.sock.sendall(payload.encode("utf-8"))

    def run(self, on_message: Callable[[dict], None]) -> None:
        if self.sock is None:
            raise RuntimeError("Not connected")
        while True:
            chunk = self.sock.recv(4096)
            if not chunk:
                return
            self.buffer += chunk.decode("utf-8")
            while "\n" in self.buffer:
                line, self.buffer = self.buffer.split("\n", 1)
                if not line.strip():
                    continue
                try:
                    on_message(json.loads(line))
                except json.JSONDecodeError:
                    print("[ghost] skipped malformed frame")

    def close(self) -> None:
        if self.sock is not None:
            try:
                self.sock.close()
            finally:
                self.sock = None
