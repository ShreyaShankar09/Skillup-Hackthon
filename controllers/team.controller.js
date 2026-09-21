// controllers/team.controller.js — Team roster.

const { db } = require('../config/db');

exports.getTeam = (req, res) => {
  try {
    res.json({ success: true, data: db.prepare('SELECT * FROM team_members ORDER BY id').all() });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
