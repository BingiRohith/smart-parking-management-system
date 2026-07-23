const express = require('express');
const router = express.Router();
const { getStats } = require('../controllers/statsController');
const { protect, restrictTo } = require('../middleware/auth');

router.get('/', protect, restrictTo('admin'), getStats);

module.exports = router;
