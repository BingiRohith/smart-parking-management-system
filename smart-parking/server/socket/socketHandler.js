const socketHandler = (io) => {
  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Driver joins a floor room to receive real-time slot updates
    socket.on('join_floor', (floorId) => {
      socket.join(`floor_${floorId}`);
      console.log(`Socket ${socket.id} joined floor_${floorId}`);
    });

    // Driver leaves a floor room
    socket.on('leave_floor', (floorId) => {
      socket.leave(`floor_${floorId}`);
      console.log(`Socket ${socket.id} left floor_${floorId}`);
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });
};

module.exports = socketHandler;
