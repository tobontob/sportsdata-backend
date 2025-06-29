const axios = require('axios');

class APIFootballService {
  constructor() {
    this.baseURL = 'https://v3.football.api-sports.io';
    this.apiKey = process.env.API_FOOTBALL_KEY;
    this.host = 'v3.football.api-sports.io';
  }

  // API 요청 헤더 설정
  getHeaders() {
    return {
      'x-rapidapi-key': this.apiKey,
      'x-rapidapi-host': this.host
    };
  }

  // 실시간 경기 목록 가져오기
  async getLiveMatches() {
    try {
      const response = await axios.get(`${this.baseURL}/fixtures`, {
        headers: this.getHeaders(),
        params: {
          live: 'all'
        }
      });

      if (response.data && response.data.response) {
        return response.data.response.map(fixture => ({
          id: fixture.fixture.id,
          homeTeam: fixture.teams.home.name,
          awayTeam: fixture.teams.away.name,
          homeScore: fixture.goals.home || 0,
          awayScore: fixture.goals.away || 0,
          status: fixture.fixture.status.short,
          minute: fixture.fixture.status.elapsed || 0,
          league: fixture.league.name,
          time: `${fixture.fixture.status.elapsed || 0}분`,
          date: fixture.fixture.date,
          venue: fixture.fixture.venue?.name || 'Unknown',
          homeLogo: fixture.teams.home.logo,
          awayLogo: fixture.teams.away.logo,
          leagueLogo: fixture.league.logo
        }));
      }

      return [];
    } catch (error) {
      console.error('API-FOOTBALL 실시간 경기 API 에러:', error.message);
      return [];
    }
  }

  // 특정 리그의 경기 목록
  async getMatchesByLeague(leagueId, season = 2024) {
    try {
      const response = await axios.get(`${this.baseURL}/fixtures`, {
        headers: this.getHeaders(),
        params: {
          league: leagueId,
          season: season
        }
      });

      if (response.data && response.data.response) {
        return response.data.response.map(fixture => ({
          id: fixture.fixture.id,
          homeTeam: fixture.teams.home.name,
          awayTeam: fixture.teams.away.name,
          homeScore: fixture.goals.home || 0,
          awayScore: fixture.goals.away || 0,
          status: fixture.fixture.status.short,
          minute: fixture.fixture.status.elapsed || 0,
          league: fixture.league.name,
          time: fixture.fixture.status.short,
          date: fixture.fixture.date,
          venue: fixture.fixture.venue?.name || 'Unknown',
          homeLogo: fixture.teams.home.logo,
          awayLogo: fixture.teams.away.logo,
          leagueLogo: fixture.league.logo
        }));
      }

      return [];
    } catch (error) {
      console.error('API-FOOTBALL 리그 경기 API 에러:', error.message);
      return [];
    }
  }

  // 리그 목록 가져오기
  async getLeagues() {
    try {
      const response = await axios.get(`${this.baseURL}/leagues`, {
        headers: this.getHeaders()
      });

      if (response.data && response.data.response) {
        return response.data.response.map(league => ({
          id: league.league.id,
          name: league.league.name,
          sport: 'Football',
          country: league.country.name,
          badge: league.league.logo,
          flag: league.country.flag
        }));
      }

      return [];
    } catch (error) {
      console.error('API-FOOTBALL 리그 API 에러:', error.message);
      return [];
    }
  }

  // 팀 정보 가져오기
  async getTeamInfo(teamId) {
    try {
      const response = await axios.get(`${this.baseURL}/teams`, {
        headers: this.getHeaders(),
        params: {
          id: teamId
        }
      });

      if (response.data && response.data.response && response.data.response[0]) {
        const team = response.data.response[0];
        return {
          id: team.team.id,
          name: team.team.name,
          country: team.team.country,
          league: team.league?.name || 'Unknown',
          badge: team.team.logo,
          stadium: team.venue?.name || 'Unknown',
          description: `${team.team.name} - ${team.team.country}`
        };
      }

      return null;
    } catch (error) {
      console.error('API-FOOTBALL 팀 API 에러:', error.message);
      return null;
    }
  }

  // 경기 상세 정보
  async getMatchDetails(matchId) {
    try {
      const response = await axios.get(`${this.baseURL}/fixtures`, {
        headers: this.getHeaders(),
        params: {
          id: matchId
        }
      });

      if (response.data && response.data.response && response.data.response[0]) {
        const fixture = response.data.response[0];
        return {
          id: fixture.fixture.id,
          homeTeam: fixture.teams.home.name,
          awayTeam: fixture.teams.away.name,
          homeScore: fixture.goals.home || 0,
          awayScore: fixture.goals.away || 0,
          status: fixture.fixture.status.short,
          minute: fixture.fixture.status.elapsed || 0,
          league: fixture.league.name,
          time: fixture.fixture.status.short,
          date: fixture.fixture.date,
          venue: fixture.fixture.venue?.name || 'Unknown',
          description: `${fixture.teams.home.name} vs ${fixture.teams.away.name}`,
          homeLogo: fixture.teams.home.logo,
          awayLogo: fixture.teams.away.logo,
          leagueLogo: fixture.league.logo
        };
      }

      return null;
    } catch (error) {
      console.error('API-FOOTBALL 경기 상세 API 에러:', error.message);
      return null;
    }
  }

  // 선수 정보 가져오기
  async getPlayerInfo(playerId) {
    try {
      const response = await axios.get(`${this.baseURL}/players`, {
        headers: this.getHeaders(),
        params: {
          id: playerId
        }
      });

      if (response.data && response.data.response && response.data.response[0]) {
        const player = response.data.response[0];
        return {
          id: player.player.id,
          name: player.player.name,
          age: player.player.age,
          nationality: player.player.nationality,
          height: player.player.height,
          weight: player.player.weight,
          photo: player.player.photo,
          team: player.statistics[0]?.team?.name || 'Unknown'
        };
      }

      return null;
    } catch (error) {
      console.error('API-FOOTBALL 선수 API 에러:', error.message);
      return null;
    }
  }
}

module.exports = new APIFootballService(); 