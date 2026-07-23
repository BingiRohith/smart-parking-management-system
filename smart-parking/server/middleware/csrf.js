// Double-submit cookie CSRF protection. Pairs with the sameSite:'none'
// cookie policy needed for cross-domain production deploys (see
// authController.js) -- sameSite alone isn't defense-in-depth once it's
// relaxed from 'strict', so state-changing requests must also prove they
// can read this site's cookies (which a cross-site attacker's browser
// request cannot) by echoing the csrfToken cookie back as a header.
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Login has no session yet to forge, so there's no CSRF token to check --
// excluding it is standard practice for this pattern.
const EXEMPT_PATHS = new Set(['/api/auth/login']);

const csrfProtection = (req, res, next) => {
  if (SAFE_METHODS.has(req.method) || EXEMPT_PATHS.has(req.path)) {
    return next();
  }

  const cookieToken = req.cookies?.csrfToken;
  const headerToken = req.headers['x-csrf-token'];

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({ message: 'Invalid or missing CSRF token.' });
  }

  next();
};

module.exports = csrfProtection;
