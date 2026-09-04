'use strict';

// ---- talk to the local bridge in client.js ----
const es = new EventSource('/events');
es.onmessage = (e) => handle(JSON.parse(e.data));
function action(obj) {
  fetch('/action', { method: 'POST', body: JSON.stringify(obj) });
}

const SIZE = 8;
const SHIP_LEN = 4;
const SHIP_COUNT = 4;
const COL = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const key = (r, c) => r + ',' + c;
const naval = (r, c) => COL[c] + (r + 1);

const S = {
  phase: 'name',          // name | lobby | placement | play | end
  me: null,
  myScore: 0,
  opp: null,
  oppScore: 0,
  online: 0,
  clients: [],
  linked: false,
  // placement
  orient: 'H',
  ships: [],              // [[r,c] x4] straight runs
  ready: false,
  status: '',
  // play
  myTurn: false,
  waitingFor: null,
  incoming: {},           // enemy shots on my fleet:  "r,c" -> 'hit'|'miss'
  outgoing: {},           // my shots on their water:  "r,c" -> 'hit'|'miss'
  mySunk: [],             // indices into S.ships that are fully hit
  enemySunk: [],          // bboxes {r,c,w,h} of ships I have sunk
  lastCall: null,
  turnNo: 0,
  count: 0,
  countHandle: null,
  log: [],
  // end
  result: null,
  rematchMsg: null,
};

const app = document.getElementById('app');

// ---------------- incoming server messages ----------------
function handle(m) {
  switch (m.type) {
    case '_link':
      S.linked = !!m.connected;
      break;

    case 'connected':
      break;

    case 'welcome':
      S.me = m.nickname;
      S.phase = 'lobby';
      render();
      break;

    case 'lobby':
      S.online = m.count;
      S.clients = m.clients;
      if (typeof m.score === 'number') S.myScore = m.score;
      if (m.you && !S.me) S.me = m.you;
      if (S.phase === 'lobby') render();
      break;

    case 'matchStart':
      S.opp = m.opponent;
      S.phase = 'placement';
      newRound();
      logLine({ raw: m.rematch ? 'rematch — fresh sheets' : 'game on — versus ' + m.opponent });
      logLine({ raw: (m.youFirst ? 'you' : m.opponent) + ' shoots first' });
      render();
      break;

    case 'placed':
      S.ready = true;
      S.status = 'fleet drawn. waiting for ' + S.opp + '…';
      render();
      break;

    case 'turn':
      S.phase = 'play';
      S.myTurn = m.your;
      S.waitingFor = m.waitingFor || null;
      S.count = m.seconds || 10;
      render();
      startCountdown();
      break;

    case 'fireResult': {
      const k = key(m.r, m.c);
      if (m.youShot) S.outgoing[k] = m.result;
      else S.incoming[k] = m.result;

      if (m.sunk) {
        if (m.youShot) {
          S.enemySunk.push(bbox(floodHits(S.outgoing, m.r, m.c)));
        } else {
          const idx = S.ships.findIndex((sh) =>
            sh.every(([r, c]) => S.incoming[key(r, c)] === 'hit'));
          if (idx >= 0 && !S.mySunk.includes(idx)) S.mySunk.push(idx);
        }
      }

      S.turnNo += 1;
      S.lastCall = { coord: naval(m.r, m.c), result: m.result };
      logLine({
        t: S.turnNo,
        who: m.youShot ? 'me' : String(m.by || '').toLowerCase(),
        coord: naval(m.r, m.c),
        result: m.result,
        sunk: m.sunk,
        auto: m.auto,
      });
      render();
      break;
    }

    case 'matchEnd':
      S.phase = 'end';
      S.result = m.status;                 // 'Win' | 'Lost'
      S.myScore = m.you.score;
      S.oppScore = m.opponent.score;
      stopCountdown();
      logLine({ raw: 'match over — ' + m.status.toLowerCase() + '  ' + m.you.score + '–' + m.opponent.score });
      render();
      break;

    case 'rematchPending':
      S.rematchMsg = m.from + ' wants to play again — your call.';
      render();
      break;

    case 'toLobby':
      S.phase = 'lobby';
      newRound();
      render();
      break;

    case 'opponentLeft':
      toast('Opponent left the game');
      S.phase = 'lobby';
      newRound();
      render();
      break;

    case 'reset':
      S.phase = S.me ? 'lobby' : 'name';
      S.myScore = 0;
      S.oppScore = 0;
      newRound();
      logLine({ raw: 'server reset — scores wiped' });
      render();
      break;

    case 'error':
      toast(m.msg);
      break;
  }
}

function newRound() {
  S.ships = [];
  S.ready = false;
  S.status = '';
  S.incoming = {};
  S.outgoing = {};
  S.mySunk = [];
  S.enemySunk = [];
  S.lastCall = null;
  S.turnNo = 0;
  S.log = [];
  S.opp = S.phase === 'placement' ? S.opp : null;
  S.result = null;
  S.rematchMsg = null;
  stopCountdown();
}

// ---------------- helpers for sunk detection ----------------
function floodHits(map, r0, c0) {
  const seen = new Set();
  const out = [];
  const stack = [[r0, c0]];
  while (stack.length) {
    const [r, c] = stack.pop();
    const k = key(r, c);
    if (seen.has(k) || map[k] !== 'hit') continue;
    seen.add(k);
    out.push([r, c]);
    stack.push([r + 1, c], [r - 1, c], [r, c + 1], [r, c - 1]);
  }
  return out;
}
function bbox(cells) {
  const rs = cells.map((x) => x[0]);
  const cs = cells.map((x) => x[1]);
  const r = Math.min(...rs), c = Math.min(...cs);
  return { r, c, w: Math.max(...cs) - c + 1, h: Math.max(...rs) - r + 1 };
}
function shipBox(ship) { return bbox(ship); }

// ---------------- rendering ----------------
function render() {
  if (S.phase === 'name') return renderName();
  if (S.phase === 'lobby') return renderLobby();
  if (S.phase === 'placement') return renderPlacement();
  if (S.phase === 'play') return renderPlay();
  if (S.phase === 'end') return renderEnd();
}

function sheet(inner, opts = {}) {
  const turn = opts.turn
    ? `<span class="mast__turn">turn <b>${opts.turn}</b>${opts.move ? ` &middot; <b>${opts.move}</b>` : ''}</span>`
    : `<span class="mast__turn">${opts.sub || ''}</span>`;
  const clock = opts.clock
    ? `<span class="clock" id="clock"><span id="clocknum">0:${pad(S.count)}</span></span>`
    : `<span></span>`;
  app.innerHTML = `
    <div class="sheet">
      <header class="mast">
        <span class="mast__title">Battleship</span>
        ${turn}
        ${clock}
      </header>
      ${inner}
    </div>`;
}

function renderName() {
  sheet(`
    <div class="note">
      <h2>Pen &amp; paper.</h2>
      <p class="dim">The old notebook game. Draw a fleet, call your shots, mark the hits.</p>
      <div class="field">
        <label for="nick">your name</label>
        <input type="text" id="nick" maxlength="20" autocomplete="off" placeholder="Alice">
      </div>
      <div class="row"><button class="go" id="join">Start</button></div>
    </div>`, { sub: '' });

  const input = document.getElementById('nick');
  input.focus();
  const go = () => {
    const v = input.value.trim();
    if (v) action({ type: 'join', nickname: v });
  };
  document.getElementById('join').onclick = go;
  input.onkeydown = (e) => { if (e.key === 'Enter') go(); };
}

function renderLobby() {
  sheet(`
    <div class="note">
      <h2>Welcome, ${esc(S.me)}.</h2>
      <p class="dim">Score is kept in tally marks and carries between games until the server resets.</p>
      <p class="dim">On the network right now &mdash; <b>${S.online}</b>:</p>
      <ul class="roster">${S.clients.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>
      <p class="waiting">waiting for someone to join…</p>
    </div>`, { sub: 'lobby' });
}

// ---------------- grid builder ----------------
// opts: { mark(r,c)->'hit'|'miss'|'', onCell, onHover, live, overlays:[{type,r,c,w,h}], preview:Set }
function padEl(opts) {
  const pad = document.createElement('div');
  pad.className = 'pad' + (opts.live ? ' pad--live' : '');

  const cols = document.createElement('div');
  cols.className = 'pad__cols';
  cols.innerHTML = '<span></span>' + COL.map((c) => `<span>${c}</span>`).join('');
  pad.appendChild(cols);

  const rows = document.createElement('div');
  rows.className = 'pad__rows';
  rows.innerHTML = Array.from({ length: SIZE }, (_, r) => `<span>${r + 1}</span>`).join('');
  pad.appendChild(rows);

  const body = document.createElement('div');
  body.className = 'pad__body';
  const grid = document.createElement('div');
  grid.className = 'grid';

  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      const mk = opts.mark ? opts.mark(r, c) : '';
      if (mk === 'hit') cell.appendChild(hitMark());
      else if (mk === 'miss') { const d = document.createElement('span'); d.className = 'mk mk--miss'; cell.appendChild(d); }
      if (opts.preview && opts.preview.has(key(r, c))) cell.classList.add('cell--preview');
      if (opts.onCell) {
        cell.classList.add('cell--click');
        cell.addEventListener('click', () => opts.onCell(r, c));
        if (opts.onHover) {
          cell.addEventListener('mouseenter', () => opts.onHover(r, c));
          cell.addEventListener('mouseleave', () => opts.onHover(-1, -1));
        }
      }
      grid.appendChild(cell);
    }
  }

  (opts.overlays || []).forEach((o) => {
    const el = document.createElement('div');
    el.className = 'ov ov--' + o.type;
    const inset = o.type === 'ship' ? 3 : 1;
    el.style.left = `calc(${o.c / SIZE * 100}% + ${inset}px)`;
    el.style.top = `calc(${o.r / SIZE * 100}% + ${inset}px)`;
    el.style.width = `calc(${o.w / SIZE * 100}% - ${inset * 2}px)`;
    el.style.height = `calc(${o.h / SIZE * 100}% - ${inset * 2}px)`;
    grid.appendChild(el);
  });

  body.appendChild(grid);
  pad.appendChild(body);
  return pad;
}

function hitMark() {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'mk mk--hit');
  svg.setAttribute('viewBox', '0 0 30 30');
  const d1 = 'M6 5 Q 15 13 25 26';
  const d2 = 'M25 5 Q 17 16 5 25';
  for (const d of [d1, d2]) {
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', d);
    svg.appendChild(p);
  }
  return svg;
}

const shipCells = () => new Set(S.ships.flat().map(([r, c]) => key(r, c)));

// ---------------- placement ----------------
function renderPlacement() {
  sheet(`
    <div class="spread">
      <section class="page page--left">
        <p class="page__head">your fleet <span>&mdash; four ships, four squares each</span></p>
        <div id="pgrid"></div>
        <div class="row">
          <button id="orient">Facing: ${S.orient === 'H' ? 'across' : 'down'}</button>
          <button id="rand">Shuffle</button>
          <button id="clear">Rub out</button>
        </div>
      </section>
      <div class="binding"></div>
      <section class="page page--right">
        <p class="page__head">fleet <span>&mdash; ${S.ships.length} of ${SHIP_COUNT}</span></p>
        <ul class="checklist">
          ${[0, 1, 2, 3].map((i) => `<li class="${i < S.ships.length ? 'done' : ''}">ship ${i + 1}${i < S.ships.length ? ' &mdash; drawn' : ''}</li>`).join('')}
        </ul>
        <p class="dim">Click a square to drop a ship from that point. Ships can&rsquo;t cross. <b>Shuffle</b> places all four at random.</p>
        <div class="row">
          <button class="go" id="ready" ${S.ships.length === SHIP_COUNT && !S.ready ? '' : 'disabled'}>Ready</button>
        </div>
        ${S.ready ? `<p class="waiting">${esc(S.status)}</p>` : ''}
      </section>
    </div>`, { sub: 'setting up' });

  const occupied = shipCells();
  let hover = [-1, -1];
  let preview = new Set();

  const overlays = S.ships.map((sh) => Object.assign({ type: 'ship' }, shipBox(sh)));

  const pad = padEl({
    overlays,
    preview,
    onCell: tryPlace,
    onHover: (r, c) => { hover = [r, c]; refresh(); },
  });
  document.getElementById('pgrid').appendChild(pad);
  const grid = pad.querySelector('.grid');

  function refresh() {
    preview = new Set();
    if (!S.ready && hover[0] >= 0 && S.ships.length < SHIP_COUNT) {
      const cells = shipFrom(hover[0], hover[1]);
      if (cells && fits(cells, occupied)) preview = new Set(cells.map(([r, c]) => key(r, c)));
    }
    const nodes = grid.querySelectorAll('.cell');
    for (let i = 0; i < nodes.length; i++) {
      const r = Math.floor(i / SIZE), c = i % SIZE;
      nodes[i].classList.toggle('cell--preview', preview.has(key(r, c)));
    }
  }

  document.getElementById('orient').onclick = () => { S.orient = S.orient === 'H' ? 'V' : 'H'; render(); };
  document.getElementById('clear').onclick = () => { if (!S.ready) { S.ships = []; render(); } };
  document.getElementById('rand').onclick = () => { if (!S.ready) { S.ships = randomShips(); render(); } };
  const rb = document.getElementById('ready');
  if (rb) rb.onclick = () => {
    if (S.ships.length === SHIP_COUNT && !S.ready) action({ type: 'place', ships: S.ships });
  };

  function tryPlace(r, c) {
    if (S.ready || S.ships.length >= SHIP_COUNT) return;
    const cells = shipFrom(r, c);
    if (cells && fits(cells, occupied)) { S.ships.push(cells); render(); }
    else toast('Ship won’t fit there');
  }
}

function shipFrom(r, c) {
  const cells = [];
  for (let k = 0; k < SHIP_LEN; k++) cells.push(S.orient === 'H' ? [r, c + k] : [r + k, c]);
  if (cells.some(([rr, cc]) => rr < 0 || cc < 0 || rr >= SIZE || cc >= SIZE)) return null;
  return cells;
}
function fits(cells, occupied) {
  return cells.every(([r, c]) => !occupied.has(key(r, c)));
}

function randomShips() {
  for (;;) {
    const ships = [];
    const used = new Set();
    let ok = true;
    for (let n = 0; n < SHIP_COUNT && ok; n++) {
      let placed = false;
      for (let t = 0; t < 300 && !placed; t++) {
        const h = Math.random() < 0.5;
        const r = Math.floor(Math.random() * (h ? SIZE : SIZE - SHIP_LEN + 1));
        const c = Math.floor(Math.random() * (h ? SIZE - SHIP_LEN + 1 : SIZE));
        const cells = [];
        for (let k = 0; k < SHIP_LEN; k++) cells.push(h ? [r, c + k] : [r + k, c]);
        if (cells.some(([rr, cc]) => used.has(key(rr, cc)))) continue;
        cells.forEach(([rr, cc]) => used.add(key(rr, cc)));
        ships.push(cells);
        placed = true;
      }
      if (!placed) ok = false;
    }
    if (ok) return ships;
  }
}

// ---------------- play ----------------
function renderPlay() {
  const move = S.myTurn ? 'your move' : `${esc(S.opp || 'their')}’s move`;

  sheet(`
    <div class="spread">
      <section class="page page--left">
        <p class="page__head">my fleet</p>
        <div id="mine"></div>
        <div class="who">
          <span>${esc(S.me)}</span>
          ${tally(S.myScore)}<span class="score-num">${S.myScore}</span>
          <span class="score-word">wins</span>
        </div>
      </section>
      <div class="binding"></div>
      <section class="page page--right">
        <p class="page__head">tracking &mdash; ${esc(S.opp || 'enemy')}${S.myTurn ? '<span class="me"> &middot; your move</span>' : '<span> &middot; waiting</span>'}</p>
        <div id="enemy"></div>
        <div class="notes">
          <div class="notes__head">notes</div>
          <ul id="log"></ul>
        </div>
      </section>
    </div>`, { turn: S.turnNo + 1, move, clock: true });

  paintLog();
  paintClock();

  // my fleet: pencil ships + incoming marks + sunk circles
  const mineShips = new Set(S.ships.flat().map(([r, c]) => key(r, c)));
  const mineOverlays = S.ships.map((sh, i) => {
    const o = Object.assign({ type: S.mySunk.includes(i) ? 'sunk' : 'ship' }, shipBox(sh));
    return o;
  });
  document.getElementById('mine').appendChild(padEl({
    overlays: mineOverlays,
    mark: (r, c) => S.incoming[key(r, c)] || '',
  }));

  // tracking sheet: my shot marks + red circles on ships I have sunk
  document.getElementById('enemy').appendChild(padEl({
    live: S.myTurn,
    overlays: S.enemySunk.map((b) => Object.assign({ type: 'sunk' }, b)),
    mark: (r, c) => S.outgoing[key(r, c)] || '',
    onCell: (r, c) => {
      if (!S.myTurn) { toast('Not your turn'); return; }
      if (S.outgoing[key(r, c)]) { toast('Already called that square'); return; }
      action({ type: 'fire', r, c });
    },
  }));
}

function renderEnd() {
  const won = S.result === 'Win';
  sheet(`
    <div class="note note--center">
      <div class="big-verdict ${won ? 'won' : 'lost'}">${won ? 'You won.' : 'You lost.'}</div>
      <div class="verdict-tag">&mdash; ${won ? 'win' : 'lost'} &mdash;</div>
      <div class="scores">
        <span>${esc(S.me)} <b>${S.myScore}</b></span>
        <span>${esc(S.opp || '—')} <b>${S.oppScore}</b></span>
      </div>
      ${S.rematchMsg ? `<p class="waiting">${esc(S.rematchMsg)}</p>` : ''}
      <div class="row row--center">
        <button class="go" id="rematch">Play again</button>
        <button id="tolobby">Back to lobby</button>
      </div>
      <p class="hint">Both players have to agree. Whoever won goes first.</p>
    </div>`, { sub: 'game over' });

  document.getElementById('rematch').onclick = () => {
    action({ type: 'rematch', agree: true });
    document.getElementById('rematch').disabled = true;
  };
  document.getElementById('tolobby').onclick = () => action({ type: 'rematch', agree: false });
}

// ---------------- tally marks ----------------
function tally(n) {
  if (!n) return '<span class="tally"></span>';
  let s = '<span class="tally">';
  for (let i = 1; i <= n; i++) s += `<i class="${i % 5 === 0 ? 'slash' : ''}"></i>`;
  return s + '</span>';
}

// ---------------- countdown ----------------
function startCountdown() {
  stopCountdown();
  paintClock();
  S.countHandle = setInterval(() => {
    S.count = Math.max(0, S.count - 1);
    paintClock();
    if (S.count === 0) stopCountdown();
  }, 1000);
}
function stopCountdown() {
  if (S.countHandle) clearInterval(S.countHandle);
  S.countHandle = null;
}
function paintClock() {
  const c = document.getElementById('clock');
  if (!c) return;
  const n = document.getElementById('clocknum');
  if (n) n.textContent = '0:' + pad(S.count);
  const urgent = S.count <= 3 && S.count > 0;
  c.classList.toggle('clock--urgent', urgent);
  const ring = c.querySelector('.clock__ring');
  if (urgent && !ring) {
    c.insertAdjacentHTML('beforeend',
      '<svg class="clock__ring" viewBox="0 0 90 46" aria-hidden="true">' +
      '<path d="M14,24 C10,9 78,5 81,23 C83,39 20,45 8,26 C6,20 9,16 15,15"/></svg>');
  } else if (!urgent && ring) {
    ring.remove();
  }
}

// ---------------- misc ui ----------------
function logLine(o) {
  S.log.unshift(o);
  if (S.log.length > 40) S.log.pop();
  paintLog();
}
function paintLog() {
  const ul = document.getElementById('log');
  if (!ul) return;
  ul.innerHTML = S.log.slice(0, 6).map((o) => {
    if (o.raw) return `<li>${esc(o.raw)}</li>`;
    const cls = o.result === 'hit' ? 'r-hit' : 'r-miss';
    return `<li><span class="tt">t${o.t}</span>${esc(o.who)} &rarr; ${esc(o.coord)} ` +
      `<span class="${cls}">${esc(o.result)}</span>` +
      `${o.sunk ? ' &middot; sunk' : ''}${o.auto ? ' &middot; auto' : ''}</li>`;
  }).join('');
}
let toastHandle = null;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastHandle);
  toastHandle = setTimeout(() => { el.hidden = true; }, 2200);
}
function pad(n) { return String(n).padStart(2, '0'); }
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, (ch) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
}

render();
