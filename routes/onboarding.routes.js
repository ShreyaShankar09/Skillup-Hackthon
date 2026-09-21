// routes/onboarding.routes.js — GET /api/onboarding, PATCH /api/onboarding/:id/toggle
const router = require('express').Router();
const ctrl   = require('../controllers/onboarding.controller');

router.get('/',              ctrl.getItems);
router.patch('/:id/toggle',  ctrl.toggleItem);

module.exports = router;
