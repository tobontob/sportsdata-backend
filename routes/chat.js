const express = require('express');
const router = express.Router();
const db = require('../config/database');

// 특정 경기의 채팅 메시지 조회
router.get('/:matchId', async (req, res) => {
  try {
    const { matchId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    const query = `
      SELECT 
        cm.id,
        cm.message,
        cm.message_type,
        cm.created_at,
        u.username,
        u.avatar_url
      FROM chat_messages cm
      LEFT JOIN users u ON cm.user_id = u.id
      WHERE cm.match_id = $1
      ORDER BY cm.created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await db.query(query, [matchId, limit, offset]);
    res.json(result.rows.reverse()); // 최신 메시지가 아래에 오도록
  } catch (error) {
    console.error('채팅 메시지 조회 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 채팅 메시지 저장
router.post('/:matchId', async (req, res) => {
  try {
    const { matchId } = req.params;
    const { message, username, userId } = req.body;

    if (!message || !username) {
      return res.status(400).json({ error: '메시지와 사용자명이 필요합니다.' });
    }

    const query = `
      INSERT INTO chat_messages (match_id, user_id, username, message)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;

    const result = await db.query(query, [matchId, userId || null, username, message]);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('채팅 메시지 저장 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 시스템 메시지 추가 (경기 이벤트 등)
router.post('/:matchId/system', async (req, res) => {
  try {
    const { matchId } = req.params;
    const { message, event_type = 'system' } = req.body;

    const query = `
      INSERT INTO chat_messages (match_id, username, message, message_type)
      VALUES ($1, 'System', $2, $3)
      RETURNING *
    `;

    const result = await db.query(query, [matchId, message, event_type]);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('시스템 메시지 저장 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 채팅방 목록 조회 (최근 메시지가 있는 경기들)
router.get('/', async (req, res) => {
  try {
    const query = `
      SELECT DISTINCT
        m.id as match_id,
        m.home_score,
        m.away_score,
        m.status,
        m.minute,
        ht.name as home_team,
        ht.logo_url as home_team_logo,
        at.name as away_team,
        at.logo_url as away_team_logo,
        l.name as league,
        (
          SELECT cm.message 
          FROM chat_messages cm 
          WHERE cm.match_id = m.id 
          ORDER BY cm.created_at DESC 
          LIMIT 1
        ) as last_message,
        (
          SELECT cm.created_at 
          FROM chat_messages cm 
          WHERE cm.match_id = m.id 
          ORDER BY cm.created_at DESC 
          LIMIT 1
        ) as last_message_time,
        (
          SELECT COUNT(*) 
          FROM chat_messages cm 
          WHERE cm.match_id = m.id
        ) as message_count
      FROM matches m
      JOIN teams ht ON m.home_team_id = ht.id
      JOIN teams at ON m.away_team_id = at.id
      JOIN leagues l ON m.league_id = l.id
      WHERE EXISTS (
        SELECT 1 FROM chat_messages cm WHERE cm.match_id = m.id
      )
      ORDER BY last_message_time DESC
    `;

    const result = await db.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('채팅방 목록 조회 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

module.exports = router; 