import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';
import socket, { acquireSocket, releaseSocket } from '../services/socket';

/**
 * useFloor — fetches a specific floor's slot layout and subscribes
 * to real-time updates via Socket.IO.
 */
export const useFloor = (floorId) => {
  const [floor, setFloor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Guards against out-of-order responses: if floorId changes quickly (or
  // refetch() is called again) before an in-flight request resolves, a
  // later request bumps this counter, and the earlier request's result is
  // discarded on arrival instead of overwriting newer state.
  const requestIdRef = useRef(0);

  const fetchFloor = useCallback(async () => {
    if (!floorId) return;
    const requestId = ++requestIdRef.current;
    try {
      setLoading(true);
      setError(null);
      const { data } = await api.get(`/floors/${floorId}`);
      if (requestIdRef.current !== requestId) return;
      setFloor(data.floor);
    } catch (err) {
      if (requestIdRef.current !== requestId) return;
      setError(err.response?.data?.message || 'Failed to load floor data.');
    } finally {
      if (requestIdRef.current === requestId) {
        setLoading(false);
      }
    }
  }, [floorId]);

  useEffect(() => {
    fetchFloor();
  }, [fetchFloor]);

  // Acquire the shared socket connection once for the lifetime of this
  // hook instance -- deliberately NOT keyed on floorId, so navigating
  // between floors doesn't disconnect/reconnect the transport, only the
  // room membership (handled separately below) changes.
  useEffect(() => {
    acquireSocket();
    return () => releaseSocket();
  }, []);

  // Real-time room subscription — re-joins/leaves per floorId change.
  useEffect(() => {
    if (!floorId) return;

    socket.emit('join_floor', floorId);

    const handleSlotUpdate = ({ slotId, status, updatedAt }) => {
      setFloor((prev) => {
        if (!prev) return prev;
        const updatedSlots = prev.slots.map((slot) =>
          slot._id === slotId ? { ...slot, status, lastUpdated: updatedAt } : slot
        );
        // Recalculate counts from slots — these are virtual getters on the
        // Mongoose model and are NOT updated when the socket only patches slots.
        const availableCount = updatedSlots.filter((s) => s.status === 'available').length;
        const occupiedCount = updatedSlots.filter((s) => s.status === 'occupied').length;
        return { ...prev, slots: updatedSlots, availableCount, occupiedCount };
      });
    };

    socket.on('slot_updated', handleSlotUpdate);

    return () => {
      socket.emit('leave_floor', floorId);
      socket.off('slot_updated', handleSlotUpdate);
    };
  }, [floorId]);

  return { floor, loading, error, refetch: fetchFloor };
};
