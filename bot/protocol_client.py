"""Adapted from feat/AI-9:bot/protocol_client.py; frame bytes before UTF-8 decoding."""
import json
import logging
import socket


class JsonLineClient:
    def __init__(self, host, port=5050):
        self.host, self.port = host, port
        self.sock = None

    def connect(self):
        self.sock = socket.create_connection((self.host, self.port), timeout=10)
        self.sock.settimeout(None)

    def send(self, message):
        if self.sock is None:
            raise RuntimeError('Not connected')
        self.sock.sendall((json.dumps(message, separators=(',', ':')) + '\n').encode('utf-8'))

    def run(self, on_message):
        if self.sock is None:
            raise RuntimeError('Not connected')
        with self.sock.makefile('rb') as reader:
            for line in reader:
                if not line.endswith(b'\n'):
                    return  # Discard incomplete frame at EOF.
                try:
                    message = json.loads(line.decode('utf-8'))
                    if not isinstance(message, dict) or not isinstance(message.get('type'), str):
                        raise ValueError('Not a protocol object')
                except (ValueError, UnicodeError):
                    logging.warning('Skipped malformed frame')
                    continue
                on_message(message)

    def close(self):
        if self.sock is not None:
            self.sock.close()
            self.sock = None
