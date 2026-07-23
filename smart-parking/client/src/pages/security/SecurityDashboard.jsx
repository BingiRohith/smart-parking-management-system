import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useFloor } from '../../hooks/useFloor';
import SlotGrid from '../../components/driver/SlotGrid';
import api from '../../services/api';
import './SecurityDashboard.css';

const SecurityDashboard = () => {
  const { user } = useAuth();
  const floorId = user?.assignedFloor?._id || user?.assignedFloor;
  const { floor, loading, error, refetch } = useFloor(floorId);
  const [updating, setUpdating] = useState(null); // slot ID being updated

  const handleSlotClick = async (slot) => {
    if (updating) return;
    const newStatus = slot.status === 'available' ? 'occupied' : 'available';

    setUpdating(slot._id);
    try {
      await api.patch(`/floors/${floorId}/slots/${slot._id}`, { status: newStatus });
      // Socket will update the UI via useFloor hook — no refetch needed
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update slot. Please try again.');
      refetch(); // Re-sync on error
    } finally {
      setUpdating(null);
    }
  };

  if (!floorId) {
    return (
      <div className="security-page">
        <div className="container">
          <div className="error-state">
            <p>⚠️ No floor assigned to your account.</p>
            <p style={{ fontSize: 13 }}>Please contact your administrator.</p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="page-loading">
        <div className="spinner" />
        <p>Loading your floor...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-state">
        <p>⚠️ {error}</p>
        <button onClick={refetch} className="btn btn--primary">Retry</button>
      </div>
    );
  }

  return (
    <div className="security-page fade-in">
      <div className="container">
        <div className="security-header">
          <div>
            <h1 className="security-header__title">{floor.name}</h1>
            <p className="security-header__sub">
              Tap a slot to toggle its status — changes are reflected instantly for all viewers.
            </p>
          </div>

          <div className="security-header__stats">
            <div className="security-stat security-stat--available">
              <span>{floor.availableCount}</span>
              Available
            </div>
            <div className="security-stat security-stat--occupied">
              <span>{floor.occupiedCount}</span>
              Occupied
            </div>
          </div>
        </div>

        {updating && (
          <div className="security-updating-banner">
            <div className="spinner" style={{ width: 14, height: 14 }} />
            Updating slot...
          </div>
        )}

        <div className="security-grid-wrapper card">
          <SlotGrid
            slots={floor.slots}
            onSlotClick={handleSlotClick}
            interactive={true}
          />
        </div>
      </div>
    </div>
  );
};

export default SecurityDashboard;
