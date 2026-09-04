// Headless end-to-end check of the server's game logic: two TCP clients play a
// full scripted match + rematch. Start the server first, then: node selfcheck.js
const net = require('net');
const { send, createReader } = require('./lib/wire');
const G = require('./lib/game');
const cfg = require('./config');

function mkClient(name) {
  const c = { name, sock: null, msgs: [], board: null, id: null };
  c.sock = net.connect(cfg.GAME_PORT, cfg.SERVER_HOST, () => {});
  c.sock.on('data', createReader((m) => { c.msgs.push(m); c.last = m; }));
  c.send = (o) => send(c.sock, o);
  return c;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, label, ms = 3000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (fn()) return; await wait(30); }
  throw new Error('timeout waiting for: ' + label);
}
const has = (c, type) => c.msgs.some((m) => m.type === type);
const grab = (c, type) => [...c.msgs].reverse().find((m) => m.type === type);

(async () => {
  const a = mkClient('Alice');
  const b = mkClient('Bob');
  await wait(200);

  a.send({ type: 'join', nickname: 'Alice' });
  b.send({ type: 'join', nickname: 'Bob' });
  await until(() => has(a, 'matchStart') && has(b, 'matchStart'), 'matchStart');
  console.log('matchStart ok; Alice first =', grab(a, 'matchStart').youFirst);

  const shipsA = G.randomShips();
  const shipsB = G.randomShips();
  a.board = G.newBoard(shipsA);
  b.board = G.newBoard(shipsB);
  a.send({ type: 'place', ships: shipsA });
  b.send({ type: 'place', ships: shipsB });
  await until(() => has(a, 'turn') && has(b, 'turn'), 'turn');
  console.log('placement -> playing ok');

  // Whoever has your:true fires; opponent's real ship layout is known here only
  // for the test so we can force a fast win.
  const layout = { Alice: shipsB, Bob: shipsA }; // targets
  let done = false;
  const fireNext = (c) => {
    const targetCells = layout[c.name].flat();
    // fire at ship cells first for a quick finish
    const fired = new Set(
      c.msgs.filter((m) => m.type === 'fireResult' && m.youShot).map((m) => m.r + ',' + m.c)
    );
    let pick = targetCells.find(([r, cc]) => !fired.has(r + ',' + cc));
    if (!pick) pick = [0, 0];
    c.send({ type: 'fire', r: pick[0], c: pick[1] });
  };

  for (let i = 0; i < 40 && !done; i++) {
    const turnA = grab(a, 'turn');
    const turnB = grab(b, 'turn');
    if (turnA && turnA.your) fireNext(a);
    else if (turnB && turnB.your) fireNext(b);
    await wait(80);
    if (has(a, 'matchEnd') && has(b, 'matchEnd')) done = true;
  }
  if (!done) throw new Error('match did not end');

  const endA = grab(a, 'matchEnd');
  const endB = grab(b, 'matchEnd');
  console.log('matchEnd ok:', endA.status, '/', endB.status,
    '| scores', endA.you.score, endA.opponent.score);
  if (!((endA.status === 'Win') !== (endB.status === 'Win'))) throw new Error('both same status');

  // rematch
  a.msgs.length = 0; b.msgs.length = 0;
  a.send({ type: 'rematch', agree: true });
  b.send({ type: 'rematch', agree: true });
  await until(() => has(a, 'matchStart') && has(b, 'matchStart'), 'rematch matchStart');
  const winnerFirst = grab(a, 'matchStart').youFirst === (endA.status === 'Win');
  console.log('rematch ok; previous winner fires first =', winnerFirst);
  if (!winnerFirst) throw new Error('previous winner does not start rematch');

  console.log('\nALL CHECKS PASSED');
  a.sock.end(); b.sock.end();
  process.exit(0);
})().catch((e) => { console.error('FAIL:', e.message); process.exit(1); });
