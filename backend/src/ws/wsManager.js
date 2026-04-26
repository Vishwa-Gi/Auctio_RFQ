const { WebSocketServer } = require('ws');

const rooms = new Map(); // roomName -> Set of ws clients

function initWS(server) {
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws) => {
    ws.currentRooms = new Set();

    ws.on('message', (raw) => {
      let msg;
      try { msg = JSON.parse(raw); } catch { return; }

      if (msg.event === 'joinRoom') {
        const room = msg.room;
        if (!rooms.has(room)) rooms.set(room, new Set());
        rooms.get(room).add(ws);
        ws.currentRooms.add(room);
      }
    });

    ws.on('close', () => {
      for (const room of ws.currentRooms) {
        const set = rooms.get(room);
        if (set) {
          set.delete(ws);
          if (set.size === 0) rooms.delete(room);
        }
      }
    });
  });

  return wss;
}

function broadcast(room, payload) {
  const set = rooms.get(room);
  if (!set) return;
  const data = JSON.stringify(payload);
  for (const ws of set) {
    if (ws.readyState === 1) ws.send(data);
  }
}

module.exports = { initWS, broadcast };
