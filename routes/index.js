// routes/index.js — Aggregates all route modules and mounts them under /api.
//
// Auth routes are public. Everything below requireAuth is scoped to req.userId,
// which is what makes the per-user data model actually enforce itself.

const router = require('express').Router();
const requireAuth = require('../middleware/requireAuth');

// ── Public ────────────────────────────────────────────────────────────────────
router.use('/auth', require('./auth.routes'));

// ── Everything past this line requires a valid bearer token ──────────────────
router.use(requireAuth);

router.use('/chat',            require('./chat.routes'));
router.use('/dashboard',       require('./dashboard.routes'));
router.use('/assessment',      require('./assessment.routes'));
router.use('/modules',         require('./learning.routes'));
router.use('/onboarding',      require('./onboarding.routes'));
router.use('/kb',              require('./kb.routes'));
router.use('/notifications',   require('./notifications.routes'));
router.use('/explorer',        require('./projectExplorer.routes'));
router.use('/team',            require('./team.routes'));
router.use('/profile',         require('./profile.routes'));
router.use('/github-activity', require('./github.routes'));
// Gamification exposes /leaderboard and /badges at the /api root.
router.use('/',                require('./gamification.routes'));

module.exports = router;
