const express = require('express');
const router = express.Router();
const { getAllStaff, getStaffById, createStaff, updateStaff, deleteStaff } = require('../controllers/staffController');
const { protect, restrictTo } = require('../middleware/auth');

router.use(protect, restrictTo('admin'));

router.route('/').get(getAllStaff).post(createStaff);
router.route('/:id').get(getStaffById).put(updateStaff).delete(deleteStaff);

module.exports = router;
