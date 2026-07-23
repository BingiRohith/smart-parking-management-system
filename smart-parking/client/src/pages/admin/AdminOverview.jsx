import { useState, useEffect } from 'react';
import api from '../../services/api';
import './AdminOverview.css';

const StatCard = ({ label, value, sub, accent }) => (
  <div className={`admin-stat-card ${accent ? `admin-stat-card--${accent}` : ''}`}>
    <div className="admin-stat-card__value">{value}</div>
    <div className="admin-stat-card__label">{label}</div>
    {sub && <div className="admin-stat-card__sub">{sub}</div>}
  </div>
);

const AdminOverview = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/stats');
      setStats(data.stats);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load statistics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    // Refresh stats every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="page-loading">
        <div className="spinner" />
        <p>Loading statistics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-state">
        <p>⚠️ {error}</p>
        <button onClick={fetchStats} className="btn btn--primary">Retry</button>
      </div>
    );
  }

  return (
    <div className="admin-overview fade-in">
      <div className="admin-page-header">
        <h1 className="admin-page-title">Overview</h1>
        <p className="admin-page-sub">Parking system at a glance</p>
      </div>

      {/* Top stats */}
      <div className="admin-overview__top-stats">
        <StatCard label="Total Slots" value={stats.totalSlots} />
        <StatCard label="Available" value={stats.totalAvailable} accent="available" />
        <StatCard label="Occupied" value={stats.totalOccupied} accent="occupied" />
        <StatCard label="Occupancy Rate" value={`${stats.overallOccupancyRate}%`} />
        <StatCard label="Active Floors" value={stats.totalFloors} />
        <StatCard label="Security Staff" value={stats.totalStaff} />
      </div>

      {/* Per-floor table */}
      <div className="admin-overview__floors card">
        <h2 className="admin-section-title">Floor Breakdown</h2>
        <div className="admin-floor-table">
          <div className="admin-floor-table__header">
            <span>Floor</span>
            <span>Available</span>
            <span>Occupied</span>
            <span>Total</span>
            <span>Occupancy</span>
          </div>

          {stats.floorStats.map((floor) => (
            <div key={floor._id} className="admin-floor-table__row">
              <span className="admin-floor-table__name">{floor.name}</span>
              <span className="admin-floor-table__available">{floor.availableCount}</span>
              <span className="admin-floor-table__occupied">{floor.occupiedCount}</span>
              <span>{floor.totalSlots}</span>
              <span className="admin-floor-table__bar-cell">
                <div className="admin-floor-table__bar-wrap">
                  <div
                    className="admin-floor-table__bar-fill"
                    style={{ width: `${floor.occupancyRate}%` }}
                  />
                </div>
                <span className="admin-floor-table__pct">{floor.occupancyRate}%</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminOverview;
