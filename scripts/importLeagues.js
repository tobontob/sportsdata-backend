const axios = require('axios');
const { Pool } = require('pg');

// Railway 환경변수 사용
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false }
});

const API_KEY = process.env.API_FOOTBALL_KEY;

async function importLeagues() {
  try {
    const response = await axios.get('https://v3.football.api-sports.io/leagues', {
      headers: { 'x-apisports-key': API_KEY }
    });

    const leagues = response.data.response;

    for (const leagueObj of leagues) {
      const { id, name, logo } = leagueObj.league;
      // DB에 upsert(중복시 갱신) 방식으로 저장
      await pool.query(
        `INSERT INTO leagues (id, name, logo_url)
         VALUES ($1, $2, $3)
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, logo_url = EXCLUDED.logo_url`,
        [id, name, logo]
      );
    }

    console.log('리그 데이터 적재 완료!');
  } catch (error) {
    console.error('리그 데이터 적재 오류:', error.response?.data || error.message);
  } finally {
    await pool.end();
  }
}

importLeagues(); 