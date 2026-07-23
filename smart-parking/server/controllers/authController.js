const jwt = require('jsonwebtoken');
const User = require('../models/User');

const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

const sendTokenResponse = (user, statusCode, res) => {
  const token = signToken(user._id);

  const cookieOptions = {
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  };

  res.cookie('token', token, cookieOptions);

  // Remove password from output
  user.password = undefined;

  res.status(statusCode).json({
    message: 'Login successful',
    user,
    token, // Also send token in body for mobile clients
  });
};

exports.login = async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required.' });
  }

  const user = await User.findOne({ username, isActive: true }).select('+password').populate('assignedFloor', 'name level');

  if (!user || !(await user.comparePassword(password))) {
    return res.status(401).json({ message: 'Invalid username or password.' });
  }

  sendTokenResponse(user, 200, res);
};

exports.logout = (req, res) => {
  res.cookie('token', '', {
    expires: new Date(0),
    httpOnly: true,
  });
  res.status(200).json({ message: 'Logged out successfully.' });
};

exports.getMe = async (req, res) => {
  const user = await User.findById(req.user._id).populate('assignedFloor', 'name level');
  res.status(200).json({ user });
};
