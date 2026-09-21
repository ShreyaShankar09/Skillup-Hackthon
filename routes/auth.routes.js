const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const ctrl = require('../controllers/auth.controller');
const requireAuth = require('../middleware/requireAuth');

// Brute-force protection on credential endpoints.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many attempts. Try again in 15 minutes.' },
});

router.post('/signup', authLimiter, ctrl.signup);
router.post('/login',  authLimiter, ctrl.login);
router.get('/me',      requireAuth, ctrl.me);

module.exports = router;
