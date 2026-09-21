// routes/gamification.routes.js — GET /api/leaderboard, GET /api/badges
const router = require('express').Router();
const ctrl   = require('../controllers/gamification.controller');

router.get('/leaderboard', ctrl.getLeaderboard);
router.get('/badges',      ctrl.getBadges);

module.exports = router;
