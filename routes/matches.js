const express = require('express');
const router = express.Router();
const db = require('../config/database');
const axios = require('axios');
const { authenticateToken, requireNotBlocked } = require('./auth');

// 모든 경기 조회
router.get('/', async (req, res) => {
  try {
    const { status, league_id, date } = req.query;
    let query = `
      SELECT 
        m.id,
        m.match_date,
        m.status,
        m.home_score,
        m.away_score,
        m.minute,
        m.venue,
        ht.name as home_team,
        ht.logo_url as home_team_logo,
        at.name as away_team,
        at.logo_url as away_team_logo,
        l.name as league,
        l.logo_url as league_logo
      FROM matches m
      JOIN teams ht ON m.home_team_id = ht.id
      JOIN teams at ON m.away_team_id = at.id
      JOIN leagues l ON m.league_id = l.id
      WHERE 1=1
    `;
    
    const params = [];
    let paramIndex = 1;

    if (status) {
      query += ` AND m.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (league_id) {
      query += ` AND m.league_id = $${paramIndex}`;
      params.push(league_id);
      paramIndex++;
    }

    if (date) {
      query += ` AND DATE(m.match_date) = $${paramIndex}`;
      params.push(date);
      paramIndex++;
    }

    query += ` ORDER BY m.match_date DESC`;

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('경기 조회 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 실시간 경기 조회
router.get('/live', async (req, res) => {
  try {
    const query = `
      SELECT 
        m.id,
        m.match_date,
        m.status,
        m.home_score,
        m.away_score,
        m.minute,
        m.venue,
        ht.name as home_team,
        ht.logo_url as home_team_logo,
        at.name as away_team,
        at.logo_url as away_team_logo,
        l.name as league,
        l.logo_url as league_logo
      FROM matches m
      JOIN teams ht ON m.home_team_id = ht.id
      JOIN teams at ON m.away_team_id = at.id
      JOIN leagues l ON m.league_id = l.id
      WHERE m.status = 'live'
      ORDER BY m.match_date DESC
    `;

    const result = await db.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('실시간 경기 조회 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 특정 경기 상세 정보
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 경기 기본 정보
    const matchQuery = `
      SELECT 
        m.*,
        ht.name as home_team,
        ht.logo_url as home_team_logo,
        ht.short_name as home_team_short,
        at.name as away_team,
        at.logo_url as away_team_logo,
        at.short_name as away_team_short,
        l.name as league,
        l.logo_url as league_logo
      FROM matches m
      JOIN teams ht ON m.home_team_id = ht.id
      JOIN teams at ON m.away_team_id = at.id
      JOIN leagues l ON m.league_id = l.id
      WHERE m.id = $1
    `;

    const matchResult = await db.query(matchQuery, [id]);
    
    if (matchResult.rows.length === 0) {
      return res.status(404).json({ error: '경기를 찾을 수 없습니다.' });
    }

    const match = matchResult.rows[0];

    // 경기 이벤트 조회
    const eventsQuery = `
      SELECT * FROM match_events 
      WHERE match_id = $1 
      ORDER BY minute ASC
    `;
    const eventsResult = await db.query(eventsQuery, [id]);

    // 배팅 배당률 조회
    const oddsQuery = `
      SELECT * FROM betting_odds 
      WHERE match_id = $1 
      ORDER BY last_update DESC
    `;
    const oddsResult = await db.query(oddsQuery, [id]);

    res.json({
      ...match,
      events: eventsResult.rows,
      odds: oddsResult.rows
    });
  } catch (error) {
    console.error('경기 상세 조회 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 경기 스코어 업데이트 (관리자용)
router.patch('/:id/score', async (req, res) => {
  try {
    const { id } = req.params;
    const { home_score, away_score, minute, status } = req.body;

    const query = `
      UPDATE matches 
      SET home_score = $1, away_score = $2, minute = $3, status = $4, updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
      RETURNING *
    `;

    const result = await db.query(query, [home_score, away_score, minute, status, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: '경기를 찾을 수 없습니다.' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('스코어 업데이트 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 경기 이벤트 추가
router.post('/:id/events', authenticateToken, requireNotBlocked, async (req, res) => {
  try {
    const { id } = req.params;
    const { event_type, minute, player_name, team_id, description } = req.body;

    const query = `
      INSERT INTO match_events (match_id, event_type, minute, player_name, team_id, description)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const result = await db.query(query, [id, event_type, minute, player_name, team_id, description]);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('이벤트 추가 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 경기별 배당률 조회 (외부 API 연동 예시)
router.get('/:id/odds', async (req, res) => {
  try {
    const matchId = req.params.id;
    // DB에서 경기 정보 조회 (리그, 팀 등 필요)
    const matchResult = await db.query('SELECT * FROM matches WHERE id = $1', [matchId]);
    if (matchResult.rows.length === 0) {
      return res.status(404).json({ error: '경기를 찾을 수 없습니다.' });
    }
    const match = matchResult.rows[0];

    // API-Football 예시 (실제 API 키와 엔드포인트로 교체 필요)
    const apiKey = process.env.API_FOOTBALL_KEY;
    const apiUrl = `https://v3.football.api-sports.io/odds?fixture=${matchId}`;
    const response = await axios.get(apiUrl, {
      headers: { 'x-apisports-key': apiKey }
    });
    const oddsData = response.data;

    res.json(oddsData);
  } catch (error) {
    console.error('배당률 조회 오류:', error.response?.data || error.message);
    res.status(500).json({ error: '배당률 정보를 가져오지 못했습니다.' });
  }
});

module.exports = router; 