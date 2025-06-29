const axios = require('axios');

class TheSportsDBService {
  constructor() {
    this.baseURL = 'https://www.thesportsdb.com/api/v1/json';
    this.apiKey = process.env.THESPORTSDB_API_KEY || '1'; // 무료 플랜은 API 키가 1
  }

  // 실시간 경기 목록 가져오기
  async getLiveMatches() {
    try {
      const response = await axios.get(`${this.baseURL}/${this.apiKey}/livescore.php`);
      
      if (response.data && response.data.events) {
        return response.data.events.map(event => ({
          id: event.idEvent,
          homeTeam: event.strHomeTeam,
          awayTeam: event.strAwayTeam,
          homeScore: parseInt(event.intHomeScore) || 0,
          awayScore: parseInt(event.intAwayScore) || 0,
          status: event.strStatus,
          minute: this.extractMinute(event.strTime),
          league: event.strLeague,
          time: event.strTime,
          date: event.dateEvent,
          venue: event.strVenue
        }));
      }
      
      return [];
    } catch (error) {
      console.error('TheSportsDB API 에러:', error.message);
      return [];
    }
  }

  // 특정 리그의 경기 목록
  async getMatchesByLeague(leagueId) {
    try {
      const response = await axios.get(`${this.baseURL}/${this.apiKey}/eventsnextleague.php?id=${leagueId}`);
      
      if (response.data && response.data.events) {
        return response.data.events.map(event => ({
          id: event.idEvent,
          homeTeam: event.strHomeTeam,
          awayTeam: event.strAwayTeam,
          homeScore: parseInt(event.intHomeScore) || 0,
          awayScore: parseInt(event.intAwayScore) || 0,
          status: event.strStatus,
          minute: this.extractMinute(event.strTime),
          league: event.strLeague,
          time: event.strTime,
          date: event.dateEvent,
          venue: event.strVenue
        }));
      }
      
      return [];
    } catch (error) {
      console.error('TheSportsDB 리그 경기 API 에러:', error.message);
      return [];
    }
  }

  // 리그 목록 가져오기
  async getLeagues() {
    try {
      const response = await axios.get(`${this.baseURL}/${this.apiKey}/all_leagues.php`);
      
      if (response.data && response.data.leagues) {
        return response.data.leagues.map(league => ({
          id: league.idLeague,
          name: league.strLeague,
          sport: league.strSport,
          country: league.strCountry,
          badge: league.strBadge
        }));
      }
      
      return [];
    } catch (error) {
      console.error('TheSportsDB 리그 API 에러:', error.message);
      return [];
    }
  }

  // 팀 정보 가져오기
  async getTeamInfo(teamId) {
    try {
      const response = await axios.get(`${this.baseURL}/${this.apiKey}/lookupteam.php?id=${teamId}`);
      
      if (response.data && response.data.teams && response.data.teams[0]) {
        const team = response.data.teams[0];
        return {
          id: team.idTeam,
          name: team.strTeam,
          country: team.strCountry,
          league: team.strLeague,
          badge: team.strTeamBadge,
          stadium: team.strStadium,
          description: team.strDescriptionEN
        };
      }
      
      return null;
    } catch (error) {
      console.error('TheSportsDB 팀 API 에러:', error.message);
      return null;
    }
  }

  // 경기 상세 정보
  async getMatchDetails(matchId) {
    try {
      const response = await axios.get(`${this.baseURL}/${this.apiKey}/lookupevent.php?id=${matchId}`);
      
      if (response.data && response.data.events && response.data.events[0]) {
        const event = response.data.events[0];
        return {
          id: event.idEvent,
          homeTeam: event.strHomeTeam,
          awayTeam: event.strAwayTeam,
          homeScore: parseInt(event.intHomeScore) || 0,
          awayScore: parseInt(event.intAwayScore) || 0,
          status: event.strStatus,
          minute: this.extractMinute(event.strTime),
          league: event.strLeague,
          time: event.strTime,
          date: event.dateEvent,
          venue: event.strVenue,
          description: event.strDescriptionEN,
          highlights: event.strHighlights,
          homeFormation: event.strHomeFormation,
          awayFormation: event.strAwayFormation
        };
      }
      
      return null;
    } catch (error) {
      console.error('TheSportsDB 경기 상세 API 에러:', error.message);
      return null;
    }
  }

  // 시간에서 분 추출 (예: "67'" -> 67)
  extractMinute(timeStr) {
    if (!timeStr) return 0;
    const match = timeStr.match(/(\d+)'/);
    return match ? parseInt(match[1]) : 0;
  }
}

module.exports = new TheSportsDBService(); 