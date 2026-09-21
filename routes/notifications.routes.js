// routes/notifications.routes.js — GET /api/notifications, PATCH read, PATCH read-all
const router = require('express').Router();
const ctrl   = require('../controllers/notifications.controller');

// NOTE: /read-all must be registered BEFORE /:id/read to avoid the literal
// string "read-all" being captured as the :id parameter.
router.get('/',             ctrl.getNotifications);
router.patch('/read-all',   ctrl.markAllRead);
router.patch('/:id/read',   ctrl.markRead);

module.exports = router;
