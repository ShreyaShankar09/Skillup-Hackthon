// routes/team.routes.js — GET /api/team
const router = require('express').Router();
const ctrl   = require('../controllers/team.controller');

router.get('/', ctrl.getTeam);

module.exports = router;
