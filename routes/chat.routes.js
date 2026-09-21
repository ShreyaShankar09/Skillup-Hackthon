const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const ctrl = require('../controllers/chat.controller');

// Caps how fast one user can burn the Groq quota.
// Keyed strictly on req.userId — this route is mounted after requireAuth (see
// routes/index.js), so it's always set. Keying on req.ip as a fallback is what
// triggered express-rate-limit's IPv6 validator, since raw req.ip needs their
// ipKeyGenerator helper to be safe; simplest fix is to just not need it here.
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    if (!req.userId) throw new Error('chatLimiter used before requireAuth — check route order.');
    return String(req.userId);
  },
  message: { success: false, error: 'Slow down — max 15 messages per minute.' },
});

router.get('/history',    ctrl.getHistory);
router.delete('/history', ctrl.clearHistory);
router.post('/',          chatLimiter, ctrl.sendMessage);

module.exports = router;
