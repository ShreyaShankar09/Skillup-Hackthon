// controllers/notifications.controller.js — Per-user notification feed.

const { db } = require('../config/db');

exports.getNotifications = (req, res) => {
  try {
    const rows = db.prepare(
      'SELECT id, title, msg, type, read, time FROM notifications WHERE user_id = ? ORDER BY id DESC'
    ).all(req.userId).map(r => ({ ...r, read: !!r.read }));
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[notifications] getNotifications error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.markRead = (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ success: false, error: 'Notification id must be a positive integer.' });
  }
  try {
    // The user_id filter is what stops one account marking another's rows read.
    const info = db.prepare('UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?')
      .run(id, req.userId);
    if (!info.changes) return res.status(404).json({ success: false, error: 'Notification not found' });
    res.json({ success: true, data: { ok: true } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.markAllRead = (req, res) => {
  try {
    const info = db.prepare('UPDATE notifications SET read = 1 WHERE user_id = ?').run(req.userId);
    res.json({ success: true, data: { ok: true, updated: info.changes } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
