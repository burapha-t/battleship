import contextlib
import json
import socket
import subprocess
import sys
import threading
import unittest
from pathlib import Path
from unittest.mock import Mock, call, patch
from bot.main import GhostFleetBot
from bot.protocol_client import JsonLineClient


class ClientTests(unittest.TestCase):
    def bot(self):
        bot = GhostFleetBot()
        bot.client = Mock()
        bot.on_message({'type': 'connected', 'id': 'ghost', 'protocolVersion': 1})
        bot.on_message({'type': 'welcome', 'nickname': 'Ghost Fleet'})
        bot.on_message({'type': 'matchStart'})
        bot.engine.budget_seconds = 0
        return bot

    def test_lifecycle_and_duplicate_turns(self):
        bot = self.bot()
        self.assertEqual([c.args[0]['type'] for c in bot.client.send.call_args_list], ['join', 'findMatch', 'place'])
        event = {'type': 'turn', 'turnNumber': 1, 'activePlayerId': 'ghost'}
        bot.on_message(event)
        count = bot.client.send.call_count
        bot.on_message(event)
        self.assertEqual(bot.client.send.call_count, count)
        bot.on_message({'type': 'matchEnd'})
        bot.on_message({'type': 'matchEnd'})
        self.assertEqual(bot.client.send.call_count, count + 1)
        bot.on_message({'type': 'matchStart'})
        self.assertFalse(bot.engine.knowledge.attempted)
        for kind in ('reset', 'opponentLeft'):
            bot.on_message({'type': kind})
            self.assertIsNone(bot.engine)
            bot.client.send.assert_called_with({'type': 'findMatch'})

    def test_omitted_seed_is_fresh_but_explicit_seed_stays_reproducible(self):
        with patch('bot.main.secrets.randbits', side_effect=[111, 222]) as fresh:
            first = GhostFleetBot()
            second = GhostFleetBot()
        self.assertEqual((first.seed, second.seed), (111, 222))
        self.assertEqual(fresh.call_args_list, [call(64), call(64)])

        a, b = GhostFleetBot(seed=42), GhostFleetBot(seed=42)
        self.assertEqual(a.seed, 42)
        self.assertEqual([a.rng.randrange(2**32) for _ in range(4)],
                         [b.rng.randrange(2**32) for _ in range(4)])

    def test_only_own_public_results_enter_engine(self):
        bot = self.bot()
        msg = {'type': 'fireResult', 'by': 'human', 'row': 0, 'col': 0, 'result': 'hit', 'ships': 'hidden'}
        bot.on_message(msg)
        self.assertFalse(bot.engine.knowledge.hits)
        bot.on_message(dict(msg, by='ghost', auto=True))
        self.assertEqual(bot.engine.knowledge.hits, {(0, 0)})
        self.assertEqual(bot.engine.knowledge.attempted, {(0, 0)})
        self.assertFalse(hasattr(bot.engine, 'ships'))
        bot.on_message({'type': 'unknown', 'ships': 'hidden'})

    def test_version_rejected(self):
        with self.assertRaises(RuntimeError):
            self.bot().on_message({'type': 'connected', 'protocolVersion': 2})

    def test_fragmented_utf8_malformed_and_eof(self):
        left, right = socket.socketpair()
        client = JsonLineClient('unused')
        client.sock = left
        received = []
        payload = (json.dumps({'type': 'welcome', 'nickname': 'ผี'}, ensure_ascii=False) + '\n').encode()
        def sender():
            with right:
                for byte in payload:
                    right.sendall(bytes([byte]))
                right.sendall(b'not json\n[]\n{"type":"reset"}\n{"type":"partial"}')
        thread = threading.Thread(target=sender)
        thread.start()
        try:
            client.run(received.append)
        finally:
            client.close()
            thread.join()
        self.assertEqual(received, [{'type': 'welcome', 'nickname': 'ผี'}, {'type': 'reset'}])


KEY = 'a1' * 16


def frame(message):
    return (json.dumps(message) + '\n').encode()


class MatchKeyTests(unittest.TestCase):
    def run_keyed_bot(self, ending):
        left, right = socket.socketpair()
        bot = GhostFleetBot(match_key=KEY)
        bot.client.connect = lambda: None
        bot.client.sock = left
        events = []
        send = bot.client.send
        bot.client.send = lambda message: (events.append(message), send(message))
        server_saw = []

        def server():
            with right, right.makefile('rb') as reader:
                right.sendall(frame({'type': 'connected', 'id': 'ghost', 'protocolVersion': 1}))
                server_saw.append(json.loads(reader.readline()))
                right.sendall(frame({'type': 'welcome', 'nickname': 'Ghost Fleet'}))
                server_saw.append(json.loads(reader.readline()))
                right.sendall(frame({'type': ending}))
                reader.read()

        class Stdout:
            def write(self, text):
                if text.strip():
                    events.append(text.strip())

            def flush(self):
                pass

        thread = threading.Thread(target=server)
        thread.start()
        try:
            with contextlib.redirect_stdout(Stdout()), self.assertRaises(SystemExit) as exit_info:
                bot.run()
        finally:
            thread.join(10)
        self.assertFalse(thread.is_alive())
        return exit_info.exception.code, events, server_saw

    def test_keyed_find_match_then_ready_then_exit_zero_on_end_of_session(self):
        for ending in ('opponentLeft', 'reset'):
            with self.subTest(ending):
                code, events, server_saw = self.run_keyed_bot(ending)
                self.assertEqual(server_saw[1], {'type': 'findMatch', 'matchKey': KEY})
                self.assertEqual([e if isinstance(e, str) else e['type'] for e in events],
                                 ['join', 'findMatch', 'GHOST_READY'])
                self.assertEqual(code, 0)


class ExitWithParentTests(unittest.TestCase):
    def test_bot_exits_when_stdin_closes_while_connected_to_server(self):
        root = Path(__file__).resolve().parents[2]
        with socket.socket() as listener:
            listener.bind(('127.0.0.1', 0))
            listener.listen(1)
            listener.settimeout(10)
            proc = subprocess.Popen(
                [sys.executable, '-m', 'bot.main', '--port', str(listener.getsockname()[1]),
                 '--match-key', KEY, '--exit-with-parent'],
                cwd=root, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
            conn = None
            try:
                conn, _ = listener.accept()
                conn.settimeout(10)
                conn.sendall(frame({'type': 'connected', 'id': 'ghost', 'protocolVersion': 1}))
                with conn.makefile('rb') as reader:
                    self.assertEqual(json.loads(reader.readline())['type'], 'join')
                    conn.sendall(frame({'type': 'welcome', 'nickname': 'Ghost Fleet'}))
                    self.assertEqual(json.loads(reader.readline())['type'], 'findMatch')
                # The bot is now idle on a live connection, so only stdin EOF can end it.
                self.assertEqual(proc.stdout.readline().strip(), b'GHOST_READY')
                self.assertIsNone(proc.poll())
                proc.stdin.close()
                self.assertEqual(proc.wait(timeout=5), 0)
            finally:
                if conn is not None:
                    conn.close()
                if proc.poll() is None:
                    proc.kill()
                proc.wait()
                proc.stdout.close()
