const Floor = require('../models/Floor');
const User = require('../models/User');
const { slotCountProjection } = require('../utils/slots');

// GET /api/stats — overall parking statistics
exports.getStats = async (req, res) => {
  // Counts are computed inside MongoDB (see slotCountProjection) rather
  // than loading every floor's full embedded slots array into Node just
  // to sum/filter it in JS.
  const floors = await Floor.aggregate([
    { $match: { isActive: true } },
    { $project: { name: 1, level: 1, ...slotCountProjection } },
  ]);

  let totalSlots = 0;
  let totalAvailable = 0;
  let totalOccupied = 0;

  const floorStats = floors.map((floor) => {
    totalSlots += floor.totalSlots;
    totalAvailable += floor.availableCount;
    totalOccupied += floor.occupiedCount;

    return {
      _id: floor._id,
      name: floor.name,
      level: floor.level,
      totalSlots: floor.totalSlots,
      availableCount: floor.availableCount,
      occupiedCount: floor.occupiedCount,
      occupancyRate: floor.totalSlots > 0 ? Math.round((floor.occupiedCount / floor.totalSlots) * 100) : 0,
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
