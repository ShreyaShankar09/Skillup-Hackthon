const router = require('express').Router();
const ctrl = require('../controllers/kb.controller');

router.get('/',          ctrl.getArticles);
router.get('/search',    ctrl.searchArticles);
router.post('/ask',      ctrl.askQuestion);
router.post('/:id/view', ctrl.viewArticle);
router.post('/:id/vote', ctrl.voteArticle);

module.exports = router;
