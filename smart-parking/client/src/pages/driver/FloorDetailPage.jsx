import { useParams, Link } from 'react-router-dom';
import { useFloor } from '../../hooks/useFloor';
import SlotGrid from '../../components/driver/SlotGrid';
import './FloorDetailPage.css';

const FloorDetailPage = () => {
  const { id } = useParams();
  const { floor, loading, error, refetch } = useFloor(id);

  if (loading) {
    return (
      <div className="page-loading">
        <div className="spinner" />
        <p>Loading floor layout...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-state">
        <p>⚠️ {error}</p>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={refetch} className="btn btn--primary">Retry</button>
          <Link to="/" className="btn btn--secondary">Back to All Floors</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="floor-detail-page fade-in">
      <div className="container">
        {/* Breadcrumb */}
        <div className="floor-detail__breadcrumb">
          <Link to="/">All Floors</Link>
          <span>›</span>
          <span>{floor.name}</span>
        </div>

        {/* Header */}
        <div className="floor-detail__header">
          <div>
            <h1 className="floor-detail__title">{floor.name}</h1>
            <div className="floor-detail__live">
              <span className="floor-detail__live-dot" />
              Live — updates automatically
            </div>
          </div>

          <div className="floor-detail__summary">
            <div className="floor-detail__stat floor-detail__stat--available">
              <span className="floor-detail__stat-num">{floor.availableCount}</span>
              <span className="floor-detail__stat-lbl">Available</span>
            </div>
            <div className="floor-detail__stat floor-detail__stat--occupied">
              <span className="floor-detail__stat-num">{floor.occupiedCount}</span>
              <span className="floor-detail__stat-lbl">Occupied</span>
            </div>
            <div className="floor-detail__stat">
              <span className="floor-detail__stat-num">{floor.totalSlots}</span>
              <span className="floor-detail__stat-lbl">Total</span>
            </div>
          </div>
        </div>

        {/* Slot Grid */}
        <div className="floor-detail__grid-wrapper card">
          <SlotGrid slots={floor.slots} interactive={false} />
        </div>

        <Link to="/" className="btn btn--secondary" style={{ marginTop: '24px', display: 'inline-flex' }}>
          ← Back to All Floors
        </Link>
      </div>
    </div>
  );
};

export default FloorDetailPage;
