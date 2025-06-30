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

async function importTeams() {
  try {
    // leagues 테이블에서 리그ID, 시즌 읽기
    const leaguesRes = await pool.query('SELECT id FROM leagues');
    const leagues = leaguesRes.rows;
    console.log(`리그 개수: ${leagues.length}`);

    for (const league of leagues) {
      const leagueId = league.id;
      console.log(`리그 ${leagueId}의 팀 데이터 요청...`);
      try {
        const response = await axios.get(`https://v3.football.api-sports.io/teams`, {
          headers: { 'x-apisports-key': API_KEY },
          params: { league: leagueId, season: SEASON }
        });
        const teams = response.data.response;
        console.log(`리그 ${leagueId} 팀 개수: ${teams.length}`);
        for (const teamObj of teams) {
          const { id, name, logo } = teamObj.team;
          await pool.query(
            `INSERT INTO teams (id, name, logo_url)
             VALUES ($1, $2, $3)
             ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, logo_url = EXCLUDED.logo_url`,
            [id, name, logo]
          );
        }
      } catch (err) {
        console.error(`리그 ${leagueId} 팀 데이터 적재 오류:`, err.response?.data || err.message);
      }
    }
    console.log('팀 데이터 적재 완료!');
  } catch (error) {
    console.error('팀 데이터 적재 오류:', error.response?.data || error.message);
  } finally {
    await pool.end();
    console.log('DB 연결 종료');
  }
}

importTeams(); 