// Battleship game client. Deploy one per machine.
//
//   * opens ONE raw TCP socket to the server (socket programming)
//   * serves the web UI locally and bridges it to that socket:
//       GET  /events  -> Server-Sent Events stream (server -> browser)
//       POST /action  -> forwards a JSON action  (browser -> server)
//
// The player never types an IP or port -- see config.js.

const net = require('net');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { send, createReader } = require('./lib/wire');
const cfg = require('./config');

const PUBLIC = path.join(__dirname, 'public');
const browserSubs = new Set();
let server = null;      // TCP socket to the game server
let connected = false;

function toBrowser(obj) {
  const line = `data: ${JSON.stringify(obj)}\n\n`;
  for (const res of browserSubs) res.write(line);
}

function connect() {
  server = net.connect(cfg.GAME_PORT, cfg.SERVER_HOST, () => {
    connected = true;
    console.log(`connected to game server ${cfg.SERVER_HOST}:${cfg.GAME_PORT}`);
    toBrowser({ type: '_link', connected: true, host: cfg.SERVER_HOST, port: cfg.GAME_PORT });
  });
  server.on('data', createReader((msg) => toBrowser(msg)));
  server.on('close', () => {
    connected = false;
    toBrowser({ type: '_link', connected: false });
    console.log('lost connection to server, retrying in 2s...');
    setTimeout(connect, 2000);
  });
  server.on('error', (e) => console.log('socket error:', e.message));
}
connect();

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };

const web = http.createServer((req, res) => {
  if (req.url === '/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write('\n');
    browserSubs.add(res);
    res.write(`data: ${JSON.stringify({
      type: '_link', connected, host: cfg.SERVER_HOST, port: cfg.GAME_PORT,
    })}\n\n`);
    req.on('close', () => browserSubs.delete(res));
    return;
  }

  if (req.method === 'POST' && req.url === '/action') {
    let body = '';
    req.on('data', (d) => { body += d; });
    req.on('end', () => {
      try {
        if (connected) send(server, JSON.parse(body));
      } catch (e) { /* ignore bad action */ }
      res.end('ok');
    });
    return;
  }

  // static files from public/
  const rel = req.url === '/' ? '/index.html' : req.url.split('?')[0];
  const fp = path.join(PUBLIC, path.normalize(rel));
  if (!fp.startsWith(PUBLIC)) { res.writeHead(403); res.end('forbidden'); return; }
  fs.readFile(fp, (err, data) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'text/plain' });
    res.end(data);
  });
});

web.listen(cfg.CLIENT_WEB_PORT, () => {
  console.log(`\n  Battleship client ready -> open http://localhost:${cfg.CLIENT_WEB_PORT}\n`);
});
