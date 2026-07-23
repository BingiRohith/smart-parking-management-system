const Floor = require('../models/Floor');
const User = require('../models/User');

// GET /api/stats — overall parking statistics
exports.getStats = async (req, res) => {
  const floors = await Floor.find({ isActive: true });

  let totalSlots = 0;
  let totalAvailable = 0;
  let totalOccupied = 0;

  const floorStats = floors.map((floor) => {
    const available = floor.availableCount;
    const occupied = floor.occupiedCount;
    totalSlots += floor.totalSlots;
    totalAvailable += available;
    totalOccupied += occupied;

    return {
      _id: floor._id,
      name: floor.name,
      level: floor.level,
      totalSlots: floor.totalSlots,
      availableCount: available,
      occupiedCount: occupied,
      occupancyRate: floor.totalSlots > 0 ? Math.round((occupied / floor.totalSlots) * 100) : 0,
    };
  });

  const totalStaff = await User.countDocuments({ role: 'security', isActive: true });

  res.status(200).json({
    stats: {
      totalFloors: floors.length,
      totalSlots,
      totalAvailable,
      totalOccupied,
      overallOccupancyRate: totalSlots > 0 ? Math.round((totalOccupied / totalSlots) * 100) : 0,
      totalStaff,
      floorStats,
    },
  });
};
