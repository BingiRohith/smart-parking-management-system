const User = require('../models/User');

// GET /api/staff — get all security staff
exports.getAllStaff = async (req, res) => {
  const staff = await User.find({ role: 'security' })
    .populate('assignedFloor', 'name level')
    .select('-password')
    .sort({ createdAt: -1 });

  res.status(200).json({ staff });
};

// GET /api/staff/:id
exports.getStaffById = async (req, res) => {
  const staff = await User.findOne({ _id: req.params.id, role: 'security' })
    .populate('assignedFloor', 'name level')
    .select('-password');

  if (!staff) return res.status(404).json({ message: 'Staff member not found.' });

  res.status(200).json({ staff });
};

// POST /api/staff — create security staff
exports.createStaff = async (req, res) => {
  const { name, username, password, assignedFloor } = req.body;

  if (!name || !username || !password) {
    return res.status(400).json({ message: 'name, username, and password are required.' });
  }

  const existingUser = await User.findOne({ username });
  if (existingUser) {
    return res.status(400).json({ message: 'Username already taken.' });
  }

  const staff = await User.create({
    name,
    username,
    password,
    role: 'security',
    assignedFloor: assignedFloor || null,
  });

  const populated = await User.findById(staff._id).populate('assignedFloor', 'name level').select('-password');

  res.status(201).json({ message: 'Staff member created.', staff: populated });
};

// PUT /api/staff/:id — update staff info
exports.updateStaff = async (req, res) => {
  const { name, username, assignedFloor, isActive, password } = req.body;

  const staff = await User.findOne({ _id: req.params.id, role: 'security' });
  if (!staff) return res.status(404).json({ message: 'Staff member not found.' });

  if (name) staff.name = name;
  if (username) staff.username = username;
  if (assignedFloor !== undefined) staff.assignedFloor = assignedFloor || null;
  if (isActive !== undefined) staff.isActive = isActive;
  if (password) staff.password = password; // will be hashed by pre-save hook

  await staff.save();

  const populated = await User.findById(staff._id).populate('assignedFloor', 'name level').select('-password');

  res.status(200).json({ message: 'Staff updated.', staff: populated });
};

// DELETE /api/staff/:id — soft delete (set isActive = false). Named
// deactivateStaff rather than deleteStaff since it never removes the
// document -- only the HTTP verb/route stay DELETE for convention.
exports.deactivateStaff = async (req, res) => {
  const staff = await User.findOneAndUpdate(
    { _id: req.params.id, role: 'security' },
    { isActive: false },
    { new: true }
  );

  if (!staff) return res.status(404).json({ message: 'Staff member not found.' });

  res.status(200).json({ message: 'Staff member deactivated.' });
};
