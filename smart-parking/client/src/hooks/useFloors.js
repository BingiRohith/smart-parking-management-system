import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import socket from '../services/socket';

/**
 * useFloors — fetches summary of all active floors and updates
 * available/occupied counts in real-time when any slot changes.
 */
export const useFloors = () => {
  const [floors, setFloors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchFloors = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { data } = await api.get('/floors');
      setFloors(data.floors);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load parking data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFloors();
  }, [fetchFloors]);

  // Real-time: update floor summary counts when any slot changes
  useEffect(() => {
    if (!socket.connected) socket.connect();

    const handleSummaryUpdate = ({ floorId, availableCount, occupiedCount }) => {
      setFloors((prev) =>
        prev.map((f) => (f._id === floorId ? { ...f, availableCount, occupiedCount } : f))
      );
    };

    socket.on('floor_summary_updated', handleSummaryUpdate);

    return () => {
      socket.off('floor_summary_updated', handleSummaryUpdate);
    };
  }, []);

  return { floors, loading, error, refetch: fetchFloors };
};
