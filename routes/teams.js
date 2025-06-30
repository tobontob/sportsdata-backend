const express = require('express');
const router = express.Router();
const db = require('../config/database');

// 전체 팀 목록 조회
router.get('/', async (req, res) => {
  try {
    const result = await db.query('SELECT id, name, logo_url FROM teams ORDER BY name ASC');
    res.json(result.rows);
  } catch (error) {
    console.error('팀 목록 조회 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

module.exports = router; 