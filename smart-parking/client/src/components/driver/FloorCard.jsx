import { useNavigate } from 'react-router-dom';
import './FloorCard.css';

const FloorCard = ({ floor }) => {
  const navigate = useNavigate();
  const occupancyPct = floor.totalSlots > 0
    ? Math.round((floor.occupiedCount / floor.totalSlots) * 100)
    : 0;

  return (
    <div
      className="floor-card fade-in"
      onClick={() => navigate(`/floor/${floor._id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && navigate(`/floor/${floor._id}`)}
    >
      <div className="floor-card__header">
        <h3 className="floor-card__name">{floor.name}</h3>
        <span className="floor-card__level">Level {floor.level}</span>
      </div>

      <div className="floor-card__stats">
        <div className="floor-card__stat floor-card__stat--available">
          <span className="floor-card__stat-dot floor-card__stat-dot--green" />
          <div>
            <div className="floor-card__stat-number">{floor.availableCount}</div>
            <div className="floor-card__stat-label">Available</div>
          </div>
        </div>

        <div className="floor-card__divider" />

        <div className="floor-card__stat floor-card__stat--occupied">
          <span className="floor-card__stat-dot floor-card__stat-dot--red" />
          <div>
            <div className="floor-card__stat-number">{floor.occupiedCount}</div>
            <div className="floor-card__stat-label">Occupied</div>
          </div>
        </div>
      </div>

      <div className="floor-card__bar-container">
        <div
          className="floor-card__bar"
          style={{ width: `${occupancyPct}%` }}
          title={`${occupancyPct}% occupied`}
        />
      </div>

      <div className="floor-card__footer">
        <span className="floor-card__total">{floor.totalSlots} total slots</span>
        <span className="floor-card__cta">View layout →</span>
      </div>
    </div>
  );
};

export default FloorCard;
