const rateLimit = require('express-rate-limit');

// Scoped to login: limits brute-force/credential-stuffing attempts per IP
// without affecting normal browsing of the public floor-availability API.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many login attempts. Please try again in a few minutes.' },
});

module.exports = { loginLimiter };
