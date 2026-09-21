// routes/profile.routes.js — GET /api/profile, PUT /api/profile
const router = require('express').Router();
const ctrl   = require('../controllers/profile.controller');

router.get('/',  ctrl.getProfile);
router.put('/',  ctrl.updateProfile);

module.exports = router;
