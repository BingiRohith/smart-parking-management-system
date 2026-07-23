import './SlotGrid.css';

const SlotGrid = ({ slots, onSlotClick, interactive = false }) => {
  // Group slots by row
  const rows = slots.reduce((acc, slot) => {
    if (!acc[slot.row]) acc[slot.row] = [];
    acc[slot.row].push(slot);
    return acc;
  }, {});

  // Sort rows alphabetically, slots by position within each row
  const sortedRows = Object.keys(rows).sort();

  return (
    <div className="slot-grid">
      {sortedRows.map((rowLabel) => (
        <div key={rowLabel} className="slot-grid__row">
          <div className="slot-grid__row-label">{rowLabel}</div>

          <div className="slot-grid__row-slots">
            {rows[rowLabel]
              .sort((a, b) => a.position - b.position)
              .map((slot) => (
                <button
                  key={slot._id}
                  className={`slot slot--${slot.status} ${interactive ? 'slot--interactive' : ''}`}
                  onClick={() => interactive && onSlotClick && onSlotClick(slot)}
                  disabled={!interactive}
                  title={`Slot ${slot.slotNumber} — ${slot.status}`}
                  aria-label={`Slot ${slot.slotNumber}, ${slot.status}`}
                >
                  <span className="slot__number">{slot.slotNumber}</span>
                  {interactive && (
                    <span className="slot__action">
                      {slot.status === 'available' ? '→ Mark Occupied' : '→ Mark Available'}
                    </span>
                  )}
                </button>
              ))}
          </div>
        </div>
      ))}

      <div className="slot-grid__legend">
        <span className="slot-grid__legend-item">
          <span className="slot-grid__legend-dot slot-grid__legend-dot--available" />
          Available
        </span>
        <span className="slot-grid__legend-item">
          <span className="slot-grid__legend-dot slot-grid__legend-dot--occupied" />
          Occupied
        </span>
      </div>
    </div>
  );
};

export default SlotGrid;
