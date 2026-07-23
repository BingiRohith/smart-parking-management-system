const ROW_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

// Generates a rows x slotsPerRow grid of slot subdocuments, e.g.
// generateSlots(2, 3) -> A1, A2, A3, B1, B2, B3, all "available".
// Shared by the seed script and createFloor so the two can't drift.
const generateSlots = (rows, slotsPerRow) => {
  const slots = [];
  for (let r = 0; r < rows; r++) {
    const rowLabel = ROW_LETTERS[r] || `R${r + 1}`;
    for (let p = 1; p <= slotsPerRow; p++) {
      slots.push({
        slotNumber: `${rowLabel}${p}`,
        row: rowLabel,
        position: p,
        status: 'available',
      });
    }
  }
  return slots;
};

// Reusable aggregation $project stage: counts slots by status inside
// MongoDB instead of transferring the full embedded slots array to Node
// just to filter/count it in JS -- matters once floors have
// hundreds/thousands of slots rather than the current demo scale.
const slotCountProjection = {
  totalSlots: { $size: '$slots' },
  availableCount: {
    $size: { $filter: { input: '$slots', as: 's', cond: { $eq: ['$$s.status', 'available'] } } },
  },
  occupiedCount: {
    $size: { $filter: { input: '$slots', as: 's', cond: { $eq: ['$$s.status', 'occupied'] } } },
  },
};

module.exports = { generateSlots, slotCountProjection };
