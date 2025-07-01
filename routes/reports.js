const express = require('express');
const router = express.Router();
const db = require('../config/database');
const jwt = require('jsonwebtoken');

// 인증 미들웨어 (auth.js에서 복사)
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: '인증 토큰이 필요합니다.' });
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: '유효하지 않은 토큰입니다.' });
    req.user = user;
    next();
  });
}

// 관리자 권한 체크 미들웨어 (userId=1만 관리자 예시)
function requireAdmin(req, res, next) {
  if (req.user && req.user.userId === 1) {
    return next();
  }
  return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
}

// GET /api/admin/reports - 전체 신고 내역 조회
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM reports ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: '신고 내역 조회 실패' });
  }
});

// PATCH /api/admin/reports/:id - 신고 처리/삭제
router.patch('/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { action } = req.body;
  const { id } = req.params;
  if (!['resolved', 'deleted'].includes(action)) {
    return res.status(400).json({ error: '유효하지 않은 action' });
  }
  try {
    await db.query('UPDATE reports SET status = $1 WHERE id = $2', [action, id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: '신고 처리 실패' });
  }
});

// POST /api/reports - 신고 등록
router.post('/', authenticateToken, async (req, res) => {
  const { target_type, target_id, reason } = req.body;
  if (!target_type || !target_id || !reason) {
    return res.status(400).json({ error: '필수 항목 누락' });
  }
  try {
    await db.query(
      'INSERT INTO reports (target_type, target_id, reason, user_id) VALUES ($1, $2, $3, $4)',
      [target_type, target_id, reason, req.user.userId]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: '신고 등록 실패' });
  }
});

module.exports = router; 