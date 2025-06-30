require('dotenv').config();
const axios = require('axios');
const { Pool } = require('pg');

console.log('DB 연결 준비...');
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false }
});

const API_KEY = process.env.API_FOOTBALL_KEY;
const SEASON = 2023; // 원하는 시즌으로 변경 가능

async function importMatches() {
  try {
    // leagues 테이블에서 리그ID 읽기
    const leaguesRes = await pool.query('SELECT id FROM leagues');
    const leagues = leaguesRes.rows;
    console.log(`리그 개수: ${leagues.length}`);

    for (const league of leagues) {
      const leagueId = league.id;
      console.log(`리그 ${leagueId}의 경기 데이터 요청...`);
      try {
        const response = await axios.get(`https://v3.football.api-sports.io/fixtures`, {
          headers: { 'x-apisports-key': API_KEY },
          params: { league: leagueId, season: SEASON }
        });
        const matches = response.data.response;
        console.log(`리그 ${leagueId} 경기 개수: ${matches.length}`);
        for (const matchObj of matches) {
          const fixture = matchObj.fixture;
          const league = matchObj.league;
          const teams = matchObj.teams;
          const goals = matchObj.goals;

          // DB에 저장할 값 추출
          const id = fixture.id;
          const match_date = fixture.date;
          const status = fixture.status.short; // 'NS', '1H', '2H', 'FT' 등
          const home_score = goals.home;
          const away_score = goals.away;
          const minute = fixture.status.elapsed;
          const venue = fixture.venue?.name || null;
          const home_team_id = teams.home.id;
          const away_team_id = teams.away.id;
          const league_id = league.id;

          await pool.query(
            `INSERT INTO matches (id, match_date, status, home_score, away_score, minute, venue, home_team_id, away_team_id, league_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             ON CONFLICT (id) DO UPDATE SET
               match_date = EXCLUDED.match_date,
               status = EXCLUDED.status,
               home_score = EXCLUDED.home_score,
               away_score = EXCLUDED.away_score,
               minute = EXCLUDED.minute,
               venue = EXCLUDED.venue,
               home_team_id = EXCLUDED.home_team_id,
               away_team_id = EXCLUDED.away_team_id,
               league_id = EXCLUDED.league_id,
               updated_at = NOW()`,
            [id, match_date, status, home_score, away_score, minute, venue, home_team_id, away_team_id, league_id]
          );
        }
      } catch (err) {
        console.error(`리그 ${leagueId} 경기 데이터 적재 오류:`, err.response?.data || err.message);
      }
    }
    console.log('경기 데이터 적재 완료!');
  } catch (error) {
    console.error('경기 데이터 적재 오류:', error.response?.data || error.message);
  } finally {
    await pool.end();
    console.log('DB 연결 종료');
  }
}

importMatches(); 