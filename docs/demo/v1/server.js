// Battleship server: authoritative game state over a raw TCP socket, plus an
// HTTP status dashboard (online count, client list, reset button).

const net = require('net');
const http = require('http');
const { send, createReader } = require('./lib/wire');
const G = require('./lib/game');
const cfg = require('./config');

const clients = new Map(); // socket -> player { id, name, score, state }
let match = null;          // current 2-player match, or null
let idSeq = 1;
const dashSubs = new Set();

// player.state: 'connecting' | 'lobby' | 'placing' | 'playing' | 'matchend'

// ---------- lookups ----------
const players = () => [...clients.values()];
const byId = (id) => players().find((p) => p.id === id);
const sockOf = (id) => {
  for (const [s, p] of clients) if (p.id === id) return s;
  return null;
};
const otherId = (id) => (id === match.a ? match.b : match.a);

const stamp = () => new Date().toISOString().slice(11, 19);
const log = (...a) => console.log(stamp(), ...a);

// ---------- broadcasting ----------
function pushDashboard() {
  const data = JSON.stringify({
    count: clients.size,
    clients: players().map((p) => ({
      id: p.id,
      name: p.name || '(choosing nickname)',
      score: p.score,
      state: p.state,
    })),
    match: match
      ? {
          a: byId(match.a) && byId(match.a).name,
          b: byId(match.b) && byId(match.b).name,
          phase: match.phase,
          turn: match.turn ? byId(match.turn) && byId(match.turn).name : null,
        }
      : null,
  });
  for (const res of dashSubs) res.write(`data: ${data}\n\n`);
}

function broadcastLobby() {
  const list = players().map((p) => p.name).filter(Boolean);
  for (const [sock, p] of clients) {
    send(sock, {
      type: 'lobby',
      count: clients.size,
      clients: list,
      you: p.name,
      score: p.score,
    });
  }
  pushDashboard();
}

// ---------- match lifecycle ----------
function freshMatch(a, b, first) {
  return {
    a, b, first,
    boards: {},          // id -> board
    phase: 'placement',
    turn: null,
    deadline: 0,
    timer: null,
    lastWinner: null,
    rematch: {},          // id -> true
  };
}

function tryStartMatch() {
  if (match) return;
  const waiting = players().filter((p) => p.state === 'lobby');
  if (waiting.length < 2) return;

  const [a, b] = waiting;
  const first = Math.random() < 0.5 ? a.id : b.id; // server randomises first player
  match = freshMatch(a.id, b.id, first);
  for (const p of [a, b]) {
    p.state = 'placing';
    const opp = p === a ? b : a;
    send(sockOf(p.id), {
      type: 'matchStart',
      opponent: opp.name,
      youFirst: first === p.id,
      rematch: false,
    });
  }
  log(`match: ${a.name} vs ${b.name} | first = ${byId(first).name}`);
  pushDashboard();
}

function handlePlace(p, ships) {
  if (!match || (p.id !== match.a && p.id !== match.b) || match.phase !== 'placement') return;
  const err = G.validatePlacement(ships);
  if (err) { send(sockOf(p.id), { type: 'error', msg: err }); return; }

  match.boards[p.id] = G.newBoard(ships);
  send(sockOf(p.id), { type: 'placed' });
  log(`${p.name} placed ships`);

  if (match.boards[match.a] && match.boards[match.b]) {
    match.phase = 'playing';
    byId(match.a).state = 'playing';
    byId(match.b).state = 'playing';
    startTurn(match.first);
  }
}

function startTurn(id) {
  clearTimeout(match.timer);
  match.turn = id;
  match.deadline = Date.now() + cfg.TURN_SECONDS * 1000;

  const mover = byId(id);
  send(sockOf(id), { type: 'turn', your: true, seconds: cfg.TURN_SECONDS });
  send(sockOf(otherId(id)), {
    type: 'turn', your: false, seconds: cfg.TURN_SECONDS, waitingFor: mover.name,
  });
  pushDashboard();

  match.timer = setTimeout(() => {
    // Timeout: auto-fire a random un-fired slot so the match keeps moving.
    const board = match.boards[otherId(id)];
    const free = [];
    for (let r = 0; r < G.SIZE; r++) {
      for (let c = 0; c < G.SIZE; c++) if (!board.shots[r][c]) free.push([r, c]);
    }
    if (!free.length) return;
    const [r, c] = free[Math.floor(Math.random() * free.length)];
    doFire(id, r, c, true);
  }, cfg.TURN_SECONDS * 1000);
}

function doFire(shooterId, r, c, auto) {
  if (!match || match.phase !== 'playing' || match.turn !== shooterId) return;

  const targetId = otherId(shooterId);
  const out = G.fireAt(match.boards[targetId], r, c);
  if (out.error) {
    if (!auto) send(sockOf(shooterId), { type: 'error', msg: out.error });
    return;
  }
  clearTimeout(match.timer);

  const shooter = byId(shooterId);
  const payload = {
    type: 'fireResult',
    by: shooter.name,
    r, c,
    result: out.result,
    sunk: out.sunk,
    auto: !!auto,
  };
  send(sockOf(shooterId), Object.assign({ youShot: true }, payload));
  send(sockOf(targetId), Object.assign({ youShot: false }, payload));
  log(`${shooter.name} -> ${r},${c}: ${out.result}${out.sunk ? ' (sunk)' : ''}${auto ? ' [timeout]' : ''}`);

  if (out.allSunk) { endMatch(shooterId); return; }
  startTurn(targetId);
}

function endMatch(winnerId) {
  clearTimeout(match.timer);
  const w = byId(winnerId);
  const l = byId(otherId(winnerId));
  w.score += 1;
  match.phase = 'ended';
  match.turn = null;
  match.lastWinner = winnerId;
  match.rematch = {};

  for (const p of [w, l]) {
    p.state = 'matchend';
    const opp = p === w ? l : w;
    send(sockOf(p.id), {
      type: 'matchEnd',
      status: p.id === winnerId ? 'Win' : 'Lost',
      you: { name: p.name, score: p.score },
      opponent: { name: opp.name, score: opp.score },
    });
  }
  log(`result: ${w.name} beat ${l.name}  (${w.score}-${l.score})`);
  pushDashboard();
}

function handleRematch(p, agree) {
  if (!match || match.phase !== 'ended') return;
  if (p.id !== match.a && p.id !== match.b) return;

  if (!agree) { toLobby([match.a, match.b]); return; }

  match.rematch[p.id] = true;
  send(sockOf(otherId(p.id)), { type: 'rematchPending', from: p.name });

  if (match.rematch[match.a] && match.rematch[match.b]) {
    const first = match.lastWinner; // previous winner starts the rematch
    const a = match.a;
    const b = match.b;
    match = freshMatch(a, b, first);
    for (const id of [a, b]) {
      const pl = byId(id);
      pl.state = 'placing';
      send(sockOf(id), {
        type: 'matchStart',
        opponent: byId(otherId(id)).name,
        youFirst: first === id,
        rematch: true,
      });
    }
    log(`rematch: first = ${byId(first).name}`);
    pushDashboard();
  }
}

function toLobby(ids) {
  if (match && match.timer) clearTimeout(match.timer);
  match = null;
  for (const id of ids) {
    const p = byId(id);
    if (!p) continue;
    p.state = 'lobby';
    send(sockOf(id), { type: 'toLobby' });
  }
  broadcastLobby();
  tryStartMatch();
}

function resetAll() {
  if (match && match.timer) clearTimeout(match.timer);
  match = null;
  for (const [sock, p] of clients) {
    p.score = 0;
    p.state = p.name ? 'lobby' : 'connecting';
    send(sock, { type: 'reset' });
  }
  log('*** server reset (game + scores) ***');
  broadcastLobby();
  tryStartMatch();
}

// ---------- TCP game server ----------
const gameServer = net.createServer((sock) => {
  const player = { id: idSeq++, name: null, score: 0, state: 'connecting' };
  clients.set(sock, player);
  send(sock, { type: 'connected', id: player.id });
  log(`client #${player.id} connected  (online ${clients.size})`);
  pushDashboard();

  sock.on('data', createReader((msg) => {
    const p = clients.get(sock);
    if (!p) return;
    switch (msg.type) {
      case 'join': {
        if (p.name) break; // already joined
        p.name = String(msg.nickname || '').trim().slice(0, 20) || `Player${p.id}`;
        p.state = 'lobby';
        send(sock, { type: 'welcome', nickname: p.name });
        log(`client #${p.id} is "${p.name}"`);
        broadcastLobby();
        tryStartMatch();
        break;
      }
      case 'place':
        handlePlace(p, msg.ships);
        break;
      case 'fire':
        doFire(p.id, msg.r | 0, msg.c | 0, false);
        break;
      case 'rematch':
        handleRematch(p, !!msg.agree);
        break;
    }
  }));

  const drop = () => {
    const p = clients.get(sock);
    if (!p) return;
    clients.delete(sock);
    log(`client #${p.id} (${p.name || '?'}) disconnected  (online ${clients.size})`);

    if (match && (p.id === match.a || p.id === match.b)) {
      const survivor = p.id === match.a ? match.b : match.a;
      if (match.timer) clearTimeout(match.timer);
      match = null;
      const s = byId(survivor);
      if (s) {
        s.state = 'lobby';
        send(sockOf(survivor), { type: 'opponentLeft' });
      }
    }
    broadcastLobby();
    tryStartMatch();
  };
  sock.on('close', drop);
  sock.on('error', drop);
});

gameServer.listen(cfg.GAME_PORT, () => {
  log(`game server (TCP socket) listening on port ${cfg.GAME_PORT}`);
});

// ---------- HTTP status dashboard ----------
const DASHBOARD_HTML = `<!doctype html><meta charset="utf-8">
<title>Battleship Server</title>
<style>
  body{font:14px/1.5 ui-monospace,Menlo,Consolas,monospace;background:#0b1e2d;color:#dbe7f0;margin:0;padding:32px}
  h1{font-size:18px;letter-spacing:.3em;color:#f2c14e;margin:0 0 4px}
  .sub{color:#7fa8c0;margin-bottom:24px}
  .big{font-size:44px;color:#fff}
  ul{list-style:none;padding:0;margin:12px 0;max-width:420px}
  li{display:flex;justify-content:space-between;padding:8px 12px;background:#12293b;border:1px solid #1f3d54;margin-bottom:4px}
  .tag{color:#7fa8c0;font-size:12px}
  button{margin-top:20px;background:#b23b3b;color:#fff;border:0;padding:12px 24px;font:inherit;letter-spacing:.2em;cursor:pointer}
  button:hover{background:#d24b4b}
  .match{margin-top:20px;padding:12px;background:#12293b;border:1px solid #1f3d54;max-width:420px}
</style>
<h1>BATTLESHIP</h1>
<div class="sub">server status</div>
<div>online clients: <span class="big" id="count">0</span></div>
<ul id="list"></ul>
<div class="match" id="match" hidden></div>
<button id="reset">RESET GAME &amp; SCORES</button>
<script>
  const es = new EventSource('/events');
  es.onmessage = (e) => {
    const d = JSON.parse(e.data);
    document.getElementById('count').textContent = d.count;
    document.getElementById('list').innerHTML = d.clients
      .map((c) => '<li><span>' + c.name + '</span><span class="tag">' + c.state +
                  ' &middot; score ' + c.score + '</span></li>')
      .join('') || '<li><span class="tag">no clients connected</span></li>';
    const m = document.getElementById('match');
    if (d.match) {
      m.hidden = false;
      m.textContent = 'match: ' + d.match.a + ' vs ' + d.match.b +
        ' | phase: ' + d.match.phase + (d.match.turn ? ' | turn: ' + d.match.turn : '');
    } else { m.hidden = true; }
  };
  document.getElementById('reset').onclick = () => fetch('/reset', { method: 'POST' });
</script>`;

const dash = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/reset') {
    resetAll();
    res.end('ok');
    return;
  }
  if (req.url === '/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write('\n');
    dashSubs.add(res);
    pushDashboard();
    req.on('close', () => dashSubs.delete(res));
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(DASHBOARD_HTML);
});

dash.listen(cfg.DASHBOARD_PORT, () => {
  log(`status dashboard on http://localhost:${cfg.DASHBOARD_PORT}`);
});
