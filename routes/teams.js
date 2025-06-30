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

// 팀별 주요 통계 (더미 데이터)
router.get('/stats', (req, res) => {
  const stats = [
    {
      teamId: 1,
      teamName: '맨체스터 유나이티드',
      avgGoals: 2.1,
      avgConceded: 0.8,
      possession: 58.5,
      passSuccess: 87.2
    },
    {
      teamId: 2,
      teamName: '리버풀',
      avgGoals: 2.3,
      avgConceded: 1.0,
      possession: 61.2,
      passSuccess: 85.9
    },
    {
      teamId: 3,
      teamName: '바이에른 뮌헨',
      avgGoals: 2.7,
      avgConceded: 0.7,
      possession: 64.1,
      passSuccess: 89.5
    }
    // ... 기타 팀 ...
  ];
  res.json(stats);
});

// 선수별 주요 통계 (득점, 도움, 클린시트 등, 더미 데이터)
router.get('/players-stats', (req, res) => {
  const stats = {
    goals: [
      { rank: 1, player: '해리 케인', team: '바이에른 뮌헨', goals: 18 },
      { rank: 2, player: '에를링 홀란드', team: '맨체스터 시티', goals: 16 },
      { rank: 3, player: '킬리안 음바페', team: '파리 생제르맹', goals: 15 }
    ],
    assists: [
      { rank: 1, player: '케빈 더 브라위너', team: '맨체스터 시티', assists: 12 },
      { rank: 2, player: '브루노 페르난데스', team: '맨체스터 유나이티드', assists: 10 },
      { rank: 3, player: '모하메드 살라', team: '리버풀', assists: 9 }
    ],
    cleanSheets: [
      { rank: 1, player: '알리송', team: '리버풀', cleanSheets: 8 },
      { rank: 2, player: '에데르송', team: '맨체스터 시티', cleanSheets: 7 },
      { rank: 3, player: '데 헤아', team: '맨체스터 유나이티드', cleanSheets: 6 }
    ]
  };
  res.json(stats);
});

module.exports = router; 