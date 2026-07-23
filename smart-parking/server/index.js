require('dotenv').config();
require('express-async-errors');
const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');
const csrfProtection = require('./middleware/csrf');
const socketHandler = require('./socket/socketHandler');

// Route imports
const authRoutes = require('./routes/auth');
const floorRoutes = require('./routes/floors');
const staffRoutes = require('./routes/staff');
const statsRoutes = require('./routes/stats');

// express-async-errors only covers Express route/middleware handling --
// it does nothing for errors thrown in non-Express async code (e.g. a
// future addition to socketHandler.js). Without these, an uncaught error
// there would otherwise crash the whole process, dropping every
// connected client, not just the one request/event that errored.
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  process.exit(1);
});

const app = express();
const server = http.createServer(app);

// Socket.IO setup
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Make io available in route handlers via req.app.get('io')
app.set('io', io);

// ─── MIDDLEWARE ───────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(csrfProtection);

// ─── ROUTES ───────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/floors', floorRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/stats', statsRoutes);

// Health check — reflects actual MongoDB connection state, not just that
// the HTTP server is up, so orchestrators/load balancers don't route
// traffic to an instance that can't actually serve DB-backed requests.
app.get('/api/health', (req, res) => {
  const dbConnected = mongoose.connection.readyState === 1;
  res.status(dbConnected ? 200 : 503).json({
    status: dbConnected ? 'ok' : 'degraded',
    db: mongoose.STATES[mongoose.connection.readyState],
    timestamp: new Date().toISOString(),
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: `Route ${req.originalUrl} not found.` });
});

// Global error handler (must be last)
app.use(errorHandler);

// ─── SOCKET.IO ────────────────────────────────────────────────────────────────
socketHandler(io);

// ─── START SERVER ─────────────────────────────────────────────────────────────
// Connect to MongoDB *before* accepting HTTP traffic, so the server never
// reports itself as up (via /api/health or otherwise) while DB-backed
// routes would actually hang or fail.
const PORT = process.env.PORT || 5000;

(async () => {
  await connectDB();

  server.listen(PORT, () => {
    console.log(`\n🚀 Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
  });
})();

// ─── GRACEFUL SHUTDOWN ────────────────────────────────────────────────────────
// On SIGTERM/SIGINT (e.g. a container orchestrator restarting the
// deployment, or Ctrl+C), stop accepting new connections and close the
// Mongo connection cleanly instead of leaving both to the OS to tear down.
const shutdown = (signal) => {
  console.log(`\n${signal} received, shutting down gracefully...`);
  server.close(async () => {
    await mongoose.connection.close();
    console.log('Server and database connection closed.');
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
