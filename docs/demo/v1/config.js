// Shared configuration. Clients do NOT ask the user for host/port (assignment
// requirement) -- change SERVER_HOST here for a two-machine setup.
module.exports = {
  // Set this to the LAN IP of the machine running server.js when playing across
  // two computers. Keep 127.0.0.1 for a single-machine test.
  SERVER_HOST: '127.0.0.1',

  GAME_PORT: 5050,       // TCP port that game clients connect to
                         // (avoid 5000/7000 on macOS -- AirPlay Receiver uses them)
  DASHBOARD_PORT: 8080,  // server status web page (http://<server>:8080)

  // Local web UI for this client. Override with PORT=xxxx when running two
  // clients on one machine for testing.
  CLIENT_WEB_PORT: Number(process.env.PORT) || 3000,

  TURN_SECONDS: 10,
};
