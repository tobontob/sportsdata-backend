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
    // 신고 정보 조회
    const reportRes = await db.query('SELECT * FROM reports WHERE id = $1', [id]);
    if (reportRes.rows.length === 0) {
      return res.status(404).json({ error: '신고 내역 없음' });
    }
    const report = reportRes.rows[0];
    // 실제 삭제/숨김 처리 (예시)
    if (action === 'deleted') {
      let targetUserId = null;
      if (report.target_type === 'post') {
        await db.query('UPDATE posts SET deleted = TRUE WHERE id = $1', [report.target_id]);
        const postRes = await db.query('SELECT user_id FROM posts WHERE id = $1', [report.target_id]);
        if (postRes.rows.length > 0) targetUserId = postRes.rows[0].user_id;
      } else if (report.target_type === 'comment') {
        await db.query('UPDATE comments SET deleted = TRUE WHERE id = $1', [report.target_id]);
        const commentRes = await db.query('SELECT user_id FROM comments WHERE id = $1', [report.target_id]);
        if (commentRes.rows.length > 0) targetUserId = commentRes.rows[0].user_id;
      } else if (report.target_type === 'chat') {
        await db.query('UPDATE chat_messages SET deleted = TRUE WHERE id = $1', [report.target_id]);
        const chatRes = await db.query('SELECT user_id FROM chat_messages WHERE id = $1', [report.target_id]);
        if (chatRes.rows.length > 0) targetUserId = chatRes.rows[0].user_id;
      } else if (report.target_type === 'betting') {
        // betting 항목은 별도 처리 필요(예: 신고만 기록)
      }
      // 피신고자 경고 횟수 증가
      if (targetUserId) {
        await db.query('UPDATE users SET warning_count = COALESCE(warning_count,0) + 1 WHERE id = $1', [targetUserId]);
      }
    }
    await db.query('UPDATE reports SET status = $1 WHERE id = $2', [action, id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: '신고 처리 실패' });
  }
});

// POST /api/reports - 신고 등록 (중복 방지)
router.post('/', authenticateToken, async (req, res) => {
  const { target_type, target_id, reason, message } = req.body;
  if (!target_type || !target_id || !reason) {
    return res.status(400).json({ error: '필수 항목 누락' });
  }
  try {
    // 중복 신고 체크
    const dup = await db.query(
      'SELECT id FROM reports WHERE target_type = $1 AND target_id = $2 AND user_id = $3',
      [target_type, target_id, req.user.userId]
    );
    if (dup.rows.length > 0) {
      return res.status(409).json({ error: '이미 신고하셨습니다.' });
    }
    if (target_type === 'chat') {
      await db.query(
        'INSERT INTO reports (target_type, target_id, reason, user_id, message) VALUES ($1, $2, $3, $4, $5)',
        [target_type, target_id, reason, req.user.userId, message || '']
      );
    } else {
      await db.query(
        'INSERT INTO reports (target_type, target_id, reason, user_id) VALUES ($1, $2, $3, $4)',
        [target_type, target_id, reason, req.user.userId]
      );
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: '신고 등록 실패' });
  }
});

module.exports = router; 