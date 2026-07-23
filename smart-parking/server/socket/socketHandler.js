// Connect/join/leave/disconnect fire on every viewer's every visit --
// fine at demo traffic, but floods production logs at real scale with
// no way to turn it off. Gated behind NODE_ENV rather than pulling in a
// logging library for what's currently just connection-lifecycle noise.
const debugLog = (...args) => {
  if (process.env.NODE_ENV !== 'production') console.log(...args);
};

const socketHandler = (io) => {
  io.on('connection', (socket) => {
    debugLog(`Socket connected: ${socket.id}`);

    // Driver joins a floor room to receive real-time slot updates
    socket.on('join_floor', (floorId) => {
      socket.join(`floor_${floorId}`);
      debugLog(`Socket ${socket.id} joined floor_${floorId}`);
    });

    // Driver leaves a floor room
    socket.on('leave_floor', (floorId) => {
      socket.leave(`floor_${floorId}`);
      debugLog(`Socket ${socket.id} left floor_${floorId}`);
    });

    socket.on('disconnect', () => {
      debugLog(`Socket disconnected: ${socket.id}`);
    });
  });
};

module.exports = socketHandler;
