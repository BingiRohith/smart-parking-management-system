import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

// Create a single socket instance shared across the app
const socket = io(SOCKET_URL, {
  autoConnect: false, // Connect manually when needed
  withCredentials: true,
});

export default socket;
