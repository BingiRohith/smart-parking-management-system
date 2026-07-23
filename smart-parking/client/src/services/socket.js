import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

// Create a single socket instance shared across the app
const socket = io(SOCKET_URL, {
  autoConnect: false, // Connect manually when needed
  withCredentials: true,
});

// Reference-counted connect/disconnect: consumers (useFloor, useFloors)
// call acquireSocket() on mount and releaseSocket() on unmount instead of
// touching socket.connect()/disconnect() directly, so the connection only
// stays open while at least one consumer actually needs it, rather than
// lingering open for the rest of the tab's lifetime once any page has
// ever used it (e.g. after navigating away to /admin or logging out).
let refCount = 0;

export const acquireSocket = () => {
  refCount += 1;
  if (!socket.connected) socket.connect();
  return socket;
};

export const releaseSocket = () => {
  refCount = Math.max(0, refCount - 1);
  if (refCount === 0 && socket.connected) {
    socket.disconnect();
  }
};

export default socket;
