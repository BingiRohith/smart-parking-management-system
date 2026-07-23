const express = require('express');
const router = express.Router();
const {
  getAllFloors,
  getFloorById,
  updateSlotStatus,
  createFloor,
  updateFloor,
  deactivateFloor,
  getAllFloorsAdmin,
} = require('../controllers/floorController');
const { protect, restrictTo } = require('../middleware/auth');

// Public routes (drivers)
router.get('/', getAllFloors);
router.get('/:id', getFloorById);

// Security + Admin: update a slot
router.patch('/:floorId/slots/:slotId', protect, restrictTo('admin', 'security'), updateSlotStatus);

// Admin only
router.get('/admin/all', protect, restrictTo('admin'), getAllFloorsAdmin);
router.post('/', protect, restrictTo('admin'), createFloor);
router.put('/:id', protect, restrictTo('admin'), updateFloor);
router.delete('/:id', protect, restrictTo('admin'), deactivateFloor);

module.exports = router;
