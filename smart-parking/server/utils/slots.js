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

module.exports = { generateSlots };
