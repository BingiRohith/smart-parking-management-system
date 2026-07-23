const Floor = require('../models/Floor');

// ─── PUBLIC ROUTES (no auth) ──────────────────────────────────────────────────

// GET /api/floors — summary of all active floors
exports.getAllFloors = async (req, res) => {
  // totalSlots is a virtual derived from slots, so slots must stay selected
  // even though only the count is returned in the summary below.
  const floors = await Floor.find({ isActive: true })
    .select('name level slots displayOrder')
    .sort({ displayOrder: 1, level: -1 });

  const summary = floors.map((floor) => ({
    _id: floor._id,
    name: floor.name,
    level: floor.level,
    totalSlots: floor.totalSlots,
    availableCount: floor.availableCount,
    occupiedCount: floor.occupiedCount,
    displayOrder: floor.displayOrder,
  }));

  res.status(200).json({ floors: summary });
};

// GET /api/floors/:id — detailed layout with slots
// Public/unauthenticated route: deliberately does NOT populate
// slots.lastUpdatedBy (staff name) since that would expose employee
// names/assignment info to anonymous drivers for no product need --
// the client never displays it.
exports.getFloorById = async (req, res) => {
  const floor = await Floor.findById(req.params.id);

  if (!floor || !floor.isActive) {
    return res.status(404).json({ message: 'Floor not found.' });
  }

  res.status(200).json({ floor });
};

// ─── SECURITY STAFF ROUTES ────────────────────────────────────────────────────

// PATCH /api/floors/:floorId/slots/:slotId — toggle slot status
exports.updateSlotStatus = async (req, res) => {
  const { floorId, slotId } = req.params;
  const { status } = req.body;

  if (!['available', 'occupied'].includes(status)) {
    return res.status(400).json({ message: 'Status must be "available" or "occupied".' });
  }

  // Security staff can only update their assigned floor
  if (req.user.role === 'security') {
    if (!req.user.assignedFloor || req.user.assignedFloor.toString() !== floorId) {
      return res.status(403).json({ message: 'You are not assigned to this floor.' });
    }
  }

  const floorExists = await Floor.exists({ _id: floorId });
  if (!floorExists) return res.status(404).json({ message: 'Floor not found.' });

  // Atomic positional update: avoids the load-mutate-save race where two
  // concurrent requests editing different slots on the same floor could
  // otherwise overwrite each other's changes.
  const lastUpdated = new Date();
  const floor = await Floor.findOneAndUpdate(
    { _id: floorId, 'slots._id': slotId },
    {
      $set: {
        'slots.$.status': status,
        'slots.$.lastUpdated': lastUpdated,
        'slots.$.lastUpdatedBy': req.user._id,
      },
    },
    { new: true, runValidators: true }
  );

  if (!floor) return res.status(404).json({ message: 'Slot not found.' });

  const slot = floor.slots.id(slotId);

  // Emit socket event to all connected clients
  const io = req.app.get('io');
  if (io) {
    io.to(`floor_${floorId}`).emit('slot_updated', {
      floorId,
      slotId,
      status,
      updatedAt: lastUpdated,
    });

    // Also emit summary update to homepage listeners
    io.emit('floor_summary_updated', {
      floorId,
      availableCount: floor.availableCount,
      occupiedCount: floor.occupiedCount,
    });
  }

  res.status(200).json({
    message: 'Slot status updated.',
    slot,
    floorSummary: {
      availableCount: floor.availableCount,
      occupiedCount: floor.occupiedCount,
    },
  });
};

// ─── ADMIN ROUTES ─────────────────────────────────────────────────────────────

// POST /api/floors — create a new floor
const MAX_ROWS = 26; // A-Z row labels
const MAX_SLOTS_PER_ROW = 50;

exports.createFloor = async (req, res) => {
  const { name, level, rows, slotsPerRow, displayOrder } = req.body;

  if (!name || level === undefined || !rows || !slotsPerRow) {
    return res.status(400).json({ message: 'name, level, rows, and slotsPerRow are required.' });
  }

  if (!Number.isInteger(rows) || rows < 1 || rows > MAX_ROWS) {
    return res.status(400).json({ message: `rows must be a whole number between 1 and ${MAX_ROWS}.` });
  }
  if (!Number.isInteger(slotsPerRow) || slotsPerRow < 1 || slotsPerRow > MAX_SLOTS_PER_ROW) {
    return res.status(400).json({ message: `slotsPerRow must be a whole number between 1 and ${MAX_SLOTS_PER_ROW}.` });
  }

  // Generate slots automatically
  const slots = [];
  const rowLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  for (let r = 0; r < rows; r++) {
    const rowLabel = rowLetters[r] || `R${r + 1}`;
    for (let p = 1; p <= slotsPerRow; p++) {
      slots.push({
        slotNumber: `${rowLabel}${p}`,
        row: rowLabel,
        position: p,
        status: 'available',
      });
    }
  }

  const floor = await Floor.create({
    name,
    level,
    slots,
    displayOrder: displayOrder ?? 0,
  });

  res.status(201).json({ message: 'Floor created successfully.', floor });
};

// PUT /api/floors/:id — update floor metadata
exports.updateFloor = async (req, res) => {
  const { name, level, displayOrder, isActive } = req.body;

  const floor = await Floor.findByIdAndUpdate(
    req.params.id,
    { name, level, displayOrder, isActive },
    { new: true, runValidators: true }
  );

  if (!floor) return res.status(404).json({ message: 'Floor not found.' });

  res.status(200).json({ message: 'Floor updated.', floor });
};

// DELETE /api/floors/:id — soft delete (set isActive = false)
exports.deleteFloor = async (req, res) => {
  const floor = await Floor.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });

  if (!floor) return res.status(404).json({ message: 'Floor not found.' });

  res.status(200).json({ message: 'Floor deactivated.' });
};

// GET /api/floors/admin/all — admin gets all floors including inactive
exports.getAllFloorsAdmin = async (req, res) => {
  const floors = await Floor.find().sort({ displayOrder: 1, level: -1 });
  res.status(200).json({ floors });
};
