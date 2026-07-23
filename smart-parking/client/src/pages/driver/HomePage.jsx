import { useFloors } from '../../hooks/useFloors';
import FloorCard from '../../components/driver/FloorCard';
import './HomePage.css';

const HomePage = () => {
  const { floors, loading, error, refetch } = useFloors();

  if (loading) {
    return (
      <div className="page-loading">
        <div className="spinner" />
        <p>Loading parking availability...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-state">
        <p>⚠️ {error}</p>
        <button onClick={refetch} className="btn btn--primary">
          Try Again
        </button>
      </div>
    );
  }

  const totalAvailable = floors.reduce((sum, f) => sum + f.availableCount, 0);
  const totalSlots = floors.reduce((sum, f) => sum + f.totalSlots, 0);

  return (
    <div className="home-page">
      <div className="container">
        {/* Hero Section */}
        <div className="home-hero fade-in">
          <div className="home-hero__text">
            <h1 className="home-hero__title">
              Find Your<br />
              <span className="home-hero__title-accent">Parking Spot</span>
            </h1>
            <p className="home-hero__subtitle">
              Real-time slot availability across all parking floors.
              Updated instantly as vehicles park or leave.
            </p>
          </div>

          <div className="home-hero__stats">
            <div className="home-hero__stat">
              <span className="home-hero__stat-number">{totalAvailable}</span>
              <span className="home-hero__stat-label">Spots Available</span>
            </div>
            <div className="home-hero__stat-divider" />
            <div className="home-hero__stat">
              <span className="home-hero__stat-number">{floors.length}</span>
              <span className="home-hero__stat-label">Floors</span>
            </div>
            <div className="home-hero__stat-divider" />
            <div className="home-hero__stat">
              <span className="home-hero__stat-number">{totalSlots}</span>
              <span className="home-hero__stat-label">Total Capacity</span>
            </div>
          </div>
        </div>

        {/* Live Indicator */}
        <div className="home-live-bar">
          <span className="home-live-dot" />
          <span>Live — updates automatically</span>
        </div>

        {/* Floor Cards */}
        <div className="home-floors">
          <h2 className="home-floors__heading">Parking Floors</h2>
          <p className="home-floors__sub">Select a floor to view the slot layout</p>

          <div className="home-floors__grid">
            {floors.map((floor) => (
              <FloorCard key={floor._id} floor={floor} />
            ))}
          </div>

          {floors.length === 0 && (
            <div className="error-state">
              <p>No parking floors are available at this time.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HomePage;
