// routes/dashboard.routes.js — GET /api/dashboard
const router = require('express').Router();
const ctrl   = require('../controllers/dashboard.controller');

router.get('/', ctrl.getDashboard);

module.exports = router;
