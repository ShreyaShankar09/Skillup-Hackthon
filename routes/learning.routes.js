// routes/learning.routes.js — GET /api/modules, PATCH /api/modules/:id/complete
const router = require('express').Router();
const ctrl   = require('../controllers/learning.controller');

router.get('/',                  ctrl.getModules);
router.patch('/:id/complete',    ctrl.completeModule);

module.exports = router;
