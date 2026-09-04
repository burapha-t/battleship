// Newline-delimited JSON framing over a raw TCP socket.

function send(sock, obj) {
  if (sock && !sock.destroyed) sock.write(JSON.stringify(obj) + '\n');
}

// Returns a function to feed socket 'data' chunks into; calls onMessage(obj)
// once per complete line.
function createReader(onMessage) {
  let buf = '';
  return (chunk) => {
    buf += chunk;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line) continue;
      try {
        onMessage(JSON.parse(line));
      } catch (e) {
        // ignore malformed frame
      }
    }
  };
}

module.exports = { send, createReader };
