"""Run from the repository root with python3 -m bot.main."""
import argparse
import logging
import os
import random
import secrets
import sys
import threading

from .engine import DecisionEngine, random_fleet
from .prior import DEFAULT_ARTIFACT, select_prior
from .protocol_client import JsonLineClient


class GhostFleetBot:
    def __init__(self, host='127.0.0.1', port=5050, nickname='Ghost Fleet', seed=None,
                 match_key=None, mode='auto', model_path=DEFAULT_ARTIFACT):
        self.client = JsonLineClient(host, port)
        self.match_key = match_key
        self.nickname = nickname
        self.seed = secrets.randbits(64) if seed is None else seed
        self.rng = random.Random(self.seed)
        self.prior, self.mode_status = select_prior(mode, model_path)
        self.my_id = None
        self.engine = None
        self.last_turn = 0
        self.ended = False

    def run(self):
        try:
            logging.info('%s', self.mode_status)
            self.client.connect()
            self.client.run(self.on_message)
        finally:
            self.client.close()
            self.engine = None

    def on_message(self, msg):
        kind = msg['type']
        if kind == 'connected':
            if msg.get('protocolVersion') != 1:
                raise RuntimeError('Unsupported server protocol version')
            self.my_id = msg['id']
            self.client.send({'type': 'join', 'nickname': self.nickname})
        elif kind == 'welcome':
            logging.info('Joined as %s', msg['nickname'])
            self.client.send({'type': 'findMatch', **({'matchKey': self.match_key} if self.match_key else {})})
            if self.match_key:
                print('GHOST_READY', flush=True)
        elif kind == 'matchStart':
            self.engine = DecisionEngine(seed=self.rng.randrange(2**32), prior=self.prior)
            self.last_turn = 0
            self.ended = False
            self.client.send({'type': 'place', 'ships': random_fleet(self.rng)})
        elif kind == 'turn' and self.engine is not None and not self.ended:
            number = msg['turnNumber']
            if number <= self.last_turn:
                return
            self.last_turn = number
            if msg['activePlayerId'] == self.my_id:
                cell = self.engine.choose()
                if cell is not None:
                    self.client.send({'type': 'fire', 'row': cell[0], 'col': cell[1]})
        elif kind == 'fireResult' and msg['by'] == self.my_id and self.engine is not None:
            self.engine.knowledge.observe((msg['row'], msg['col']), msg['result'],
                                          msg.get('sunkCells') or ())
        elif kind == 'matchEnd' and self.engine is not None and not self.ended:
            self.ended = True
            logging.info('Match ended; requesting rematch')
            self.client.send({'type': 'rematch'})
        elif kind in ('opponentLeft', 'reset'):
            if self.match_key:
                raise SystemExit(0)
            self.engine = None
            self.last_turn = 0
            self.ended = False
            self.client.send({'type': 'findMatch'})
        elif kind == 'error':
            code = msg.get('code')
            logging.warning('Server rejected command: %s', code)
            # Turn races need no retry: server auto-fire/next turn is authoritative.
            if code not in ('not-your-turn', 'already-fired', 'not-in-match'):
                raise RuntimeError('Server rejected bot command: ' + str(code))


def exit_when_stdin_closes():
    """Exit once the launching client's stdin pipe closes, even if its process was killed."""
    def watch():
        try:
            while sys.stdin.buffer.read(4096):
                pass
        except (OSError, ValueError, AttributeError):
            pass
        os._exit(0)
    threading.Thread(target=watch, daemon=True).start()


def main():
    parser = argparse.ArgumentParser(description='Ghost Fleet V1 probability-based TCP opponent')
    parser.add_argument('--server', default='127.0.0.1')
    parser.add_argument('--port', type=int, default=5050)
    parser.add_argument('--nickname', default='Ghost Fleet')
    parser.add_argument('--seed', type=int, help='reproducible random seed (fresh seed when omitted)')
    parser.add_argument('--mode', choices=('auto', 'v1', 'v2'),
                        default=os.environ.get('BATTLESHIP_GHOST_MODE', 'auto'))
    parser.add_argument('--model', default=os.environ.get('BATTLESHIP_GHOST_MODEL', str(DEFAULT_ARTIFACT)))
    parser.add_argument('--match-key', help=argparse.SUPPRESS)
    parser.add_argument('--exit-with-parent', action='store_true', help=argparse.SUPPRESS)
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format='[ghost] %(message)s')
    if args.exit_with_parent:
        exit_when_stdin_closes()
    try:
        GhostFleetBot(args.server, args.port, args.nickname, args.seed, args.match_key,
                      args.mode, args.model).run()
    except KeyboardInterrupt:
        pass
    except (OSError, RuntimeError) as exc:
        logging.error('%s', exc)
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
