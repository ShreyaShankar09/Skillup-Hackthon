// routes/assessment.routes.js — GET /api/assessment/questions, POST /api/assessment/submit
const router = require('express').Router();
const ctrl   = require('../controllers/assessment.controller');

router.get('/questions', ctrl.getQuestions);
router.post('/submit',   ctrl.submitAssessment);

module.exports = router;
