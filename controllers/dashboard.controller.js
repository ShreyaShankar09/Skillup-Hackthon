// controllers/dashboard.controller.js — User stats, streak, and heatmap data.
// Everything here is DERIVED at read time, so the numbers can never disagree
// with the underlying progress tables.

const { db } = require('../config/db');
const progress = require('../services/progress');

exports.getDashboard = (req, res) => {
  try {
    const prof = db.prepare('SELECT points, dayStreak FROM user_profile WHERE user_id = ?').get(req.userId);
    if (!prof) return res.status(404).json({ success: false, error: 'Profile not found.' });

    const { heatData, heatDays } = progress.heatmap(req.userId);
    const data = {
      heatData, heatDays,
      points:           prof.points,
      modulesCompleted: progress.modulesCompleted(req.userId),
      onboardingDone:   progress.onboardingDone(req.userId),
      dayStreak:        progress.recomputeStreak(req.userId),
      badgesEarned:     progress.badgesEarned(req.userId),
    };
    console.log(`[dashboard] user=${req.userId} points=${data.points} streak=${data.dayStreak} badges=${data.badgesEarned}`);
    res.json({ success: true, data });
  } catch (err) {
    console.error('[dashboard] getDashboard error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};
