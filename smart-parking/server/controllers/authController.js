const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

// sameSite:'strict' only works when frontend/backend share a registrable
// domain (true on localhost, false for e.g. a Vercel + Render split-host
// production deploy, where the cookie would never be sent at all). Using
// 'none' in production requires secure:true and pairs with the CSRF
// double-submit cookie below, since 'none' alone would otherwise be
// vulnerable to cross-site request forgery on state-changing routes.
const isProduction = () => process.env.NODE_ENV === 'production';
const cookieSameSite = () => (isProduction() ? 'none' : 'lax');

const sendTokenResponse = (user, statusCode, res) => {
  const token = signToken(user._id);
  const csrfToken = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  res.cookie('token', token, {
    expires,
    httpOnly: true,
    secure: isProduction(),
    sameSite: cookieSameSite(),
  });

  // Not httpOnly: the client must be able to read this and echo it back
  // as the X-CSRF-Token header on state-changing requests (double-submit
  // cookie pattern). It carries no authority on its own -- only proves
  // the request originated from JS that can read this site's cookies.
  res.cookie('csrfToken', csrfToken, {
    expires,
    httpOnly: false,
    secure: isProduction(),
    sameSite: cookieSameSite(),
  });

  // Remove password from output
  user.password = undefined;

  res.status(statusCode).json({
    message: 'Login successful',
    user,
  });
};

exports.login = async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required.' });
  }

  const normalizedUsername = username.trim().toLowerCase();
  const user = await User.findOne({ username: normalizedUsername, isActive: true }).select('+password').populate('assignedFloor', 'name level');

  if (!user || !(await user.comparePassword(password))) {
    return res.status(401).json({ message: 'Invalid username or password.' });
  }

  sendTokenResponse(user, 200, res);
};

exports.logout = (req, res) => {
  res.cookie('token', '', { expires: new Date(0), httpOnly: true });
  res.cookie('csrfToken', '', { expires: new Date(0), httpOnly: false });
  res.status(200).json({ message: 'Logged out successfully.' });
};

exports.getMe = async (req, res) => {
  // req.user is already loaded by the protect middleware -- just populate
  // the field this endpoint additionally needs instead of re-querying it.
  await req.user.populate('assignedFloor', 'name level');
  res.status(200).json({ user: req.user });
};
