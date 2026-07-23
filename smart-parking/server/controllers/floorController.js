const Floor = require('../models/Floor');

// ─── PUBLIC ROUTES (no auth) ──────────────────────────────────────────────────

// GET /api/floors — summary of all active floors
exports.getAllFloors = async (req, res) => {
  const floors = await Floor.find({ isActive: true })
    .select('name level totalSlots slots displayOrder')
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
exports.getFloorById = async (req, res) => {
  const floor = await Floor.findById(req.params.id).populate('slots.lastUpdatedBy', 'name');

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

  const floor = await Floor.findById(floorId);
  if (!floor) return res.status(404).json({ message: 'Floor not found.' });

  // Security staff can only update their assigned floor
  if (req.user.role === 'security') {
    if (!req.user.assignedFloor || req.user.assignedFloor.toString() !== floorId) {
      return res.status(403).json({ message: 'You are not assigned to this floor.' });
    }
  }

  const slot = floor.slots.id(slotId);
  if (!slot) return res.status(404).json({ message: 'Slot not found.' });

  slot.status = status;
  slot.lastUpdated = new Date();
  slot.lastUpdatedBy = req.user._id;

  await floor.save();

  // Emit socket event to all connected clients
  const io = req.app.get('io');
  if (io) {
    io.to(`floor_${floorId}`).emit('slot_updated', {
      floorId,
      slotId,
      status,
      updatedAt: slot.lastUpdated,
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
exports.createFloor = async (req, res) => {
  const { name, level, rows, slotsPerRow, displayOrder } = req.body;

  if (!name || level === undefined || !rows || !slotsPerRow) {
    return res.status(400).json({ message: 'name, level, rows, and slotsPerRow are required.' });
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
