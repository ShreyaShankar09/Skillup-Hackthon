// routes/github.routes.js — GET /api/github-activity
// NOTE: The HTML client fetches /api/github-activity (no sub-path), so the
// root of this router must respond. We also alias /activities for clarity.
const router = require('express').Router();
const ctrl   = require('../controllers/github.controller');

router.get('/',            ctrl.getActivities);
router.get('/activities',  ctrl.getActivities);

module.exports = router;
