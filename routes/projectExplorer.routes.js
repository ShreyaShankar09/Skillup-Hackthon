// routes/projectExplorer.routes.js — GET /api/explorer
const router = require('express').Router();
const ctrl   = require('../controllers/projectExplorer.controller');

router.get('/', ctrl.getExplorer);
router.get('/repo', ctrl.getRepoTree);
router.post('/explain', ctrl.explainFile);

module.exports = router;
