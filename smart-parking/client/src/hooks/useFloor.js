import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import socket from '../services/socket';

/**
 * useFloor — fetches a specific floor's slot layout and subscribes
 * to real-time updates via Socket.IO.
 */
export const useFloor = (floorId) => {
  const [floor, setFloor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchFloor = useCallback(async () => {
    if (!floorId) return;
    try {
      setLoading(true);
      setError(null);
      const { data } = await api.get(`/floors/${floorId}`);
      setFloor(data.floor);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load floor data.');
    } finally {
      setLoading(false);
    }
  }, [floorId]);

  useEffect(() => {
    fetchFloor();
  }, [fetchFloor]);

  // Real-time socket subscription
  useEffect(() => {
    if (!floorId) return;

    if (!socket.connected) socket.connect();

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
