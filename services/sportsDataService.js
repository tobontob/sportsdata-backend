const theSportsDB = require('./thesportsdb');
const apiFootball = require('./apifootball');

class SportsDataService {
  constructor() {
    this.useTheSportsDB = true; // TheSportsDB 사용 여부
    this.useAPIFootball = process.env.API_FOOTBALL_KEY ? true : false; // API-FOOTBALL 키가 있으면 사용
  }

  // 실시간 경기 목록 가져오기 (두 API 조합)
  async getLiveMatches() {
    let matches = [];

    // TheSportsDB에서 실시간 경기 가져오기
    if (this.useTheSportsDB) {
      try {
        const theSportsDBMatches = await theSportsDB.getLiveMatches();
        matches = matches.concat(theSportsDBMatches);
        console.log(`TheSportsDB에서 ${theSportsDBMatches.length}개 실시간 경기 로드`);
      } catch (error) {
        console.error('TheSportsDB 실시간 경기 로드 실패:', error.message);
      }
    }

    // API-FOOTBALL에서 실시간 경기 가져오기
    if (this.useAPIFootball) {
      try {
        const apiFootballMatches = await apiFootball.getLiveMatches();
        matches = matches.concat(apiFootballMatches);
        console.log(`API-FOOTBALL에서 ${apiFootballMatches.length}개 실시간 경기 로드`);
      } catch (error) {
        console.error('API-FOOTBALL 실시간 경기 로드 실패:', error.message);
      }
    }

    // 중복 제거 (ID 기준)
    const uniqueMatches = this.removeDuplicates(matches);
    console.log(`총 ${uniqueMatches.length}개 실시간 경기 데이터 준비 완료`);

    return uniqueMatches;
  }

  // 리그 목록 가져오기
  async getLeagues() {
    let leagues = [];

    // TheSportsDB에서 리그 목록 가져오기
    if (this.useTheSportsDB) {
      try {
        const theSportsDBLeagues = await theSportsDB.getLeagues();
        leagues = leagues.concat(theSportsDBLeagues);
        console.log(`TheSportsDB에서 ${theSportsDBLeagues.length}개 리그 로드`);
      } catch (error) {
        console.error('TheSportsDB 리그 로드 실패:', error.message);
      }
    }

    // API-FOOTBALL에서 리그 목록 가져오기
    if (this.useAPIFootball) {
      try {
        const apiFootballLeagues = await apiFootball.getLeagues();
        leagues = leagues.concat(apiFootballLeagues);
        console.log(`API-FOOTBALL에서 ${apiFootballLeagues.length}개 리그 로드`);
      } catch (error) {
        console.error('API-FOOTBALL 리그 로드 실패:', error.message);
      }
    }

    // 중복 제거 (이름 기준)
    const uniqueLeagues = this.removeDuplicateLeagues(leagues);
    console.log(`총 ${uniqueLeagues.length}개 리그 데이터 준비 완료`);

    return uniqueLeagues;
  }

  // 특정 리그의 경기 목록
  async getMatchesByLeague(leagueId, source = 'both') {
    let matches = [];

    if (source === 'thesportsdb' || source === 'both') {
      try {
        const theSportsDBMatches = await theSportsDB.getMatchesByLeague(leagueId);
        matches = matches.concat(theSportsDBMatches);
      } catch (error) {
        console.error('TheSportsDB 리그 경기 로드 실패:', error.message);
      }
    }

    if (source === 'apifootball' || source === 'both') {
      try {
        const apiFootballMatches = await apiFootball.getMatchesByLeague(leagueId);
        matches = matches.concat(apiFootballMatches);
      } catch (error) {
        console.error('API-FOOTBALL 리그 경기 로드 실패:', error.message);
      }
    }

    return this.removeDuplicates(matches);
  }

  // 팀 정보 가져오기
  async getTeamInfo(teamId, source = 'thesportsdb') {
    try {
      if (source === 'thesportsdb') {
        return await theSportsDB.getTeamInfo(teamId);
      } else if (source === 'apifootball' && this.useAPIFootball) {
        return await apiFootball.getTeamInfo(teamId);
      }
    } catch (error) {
      console.error('팀 정보 로드 실패:', error.message);
      return null;
    }
  }

  // 경기 상세 정보
  async getMatchDetails(matchId, source = 'thesportsdb') {
    try {
      if (source === 'thesportsdb') {
        return await theSportsDB.getMatchDetails(matchId);
      } else if (source === 'apifootball' && this.useAPIFootball) {
        return await apiFootball.getMatchDetails(matchId);
      }
    } catch (error) {
      console.error('경기 상세 정보 로드 실패:', error.message);
      return null;
    }
  }

  // 선수 정보 가져오기 (API-FOOTBALL만 지원)
  async getPlayerInfo(playerId) {
    if (this.useAPIFootball) {
      try {
        return await apiFootball.getPlayerInfo(playerId);
      } catch (error) {
        console.error('선수 정보 로드 실패:', error.message);
        return null;
      }
    }
    return null;
  }

  // 중복 제거 (ID 기준)
  removeDuplicates(matches) {
    const seen = new Set();
    return matches.filter(match => {
      const duplicate = seen.has(match.id);
      seen.add(match.id);
      return !duplicate;
    });
  }

  // 리그 중복 제거 (이름 기준)
  removeDuplicateLeagues(leagues) {
    const seen = new Set();
    return leagues.filter(league => {
      const duplicate = seen.has(league.name);
      seen.add(league.name);
      return !duplicate;
    });
  }

  // API 상태 확인
  getAPIStatus() {
    return {
      theSportsDB: this.useTheSportsDB,
      apiFootball: this.useAPIFootball,
      totalAPIs: (this.useTheSportsDB ? 1 : 0) + (this.useAPIFootball ? 1 : 0)
    };
  }

  // 오늘 날짜의 예정 경기 가져오기 (실시간 경기 없을 때)
  async getUpcomingMatches() {
    let matches = [];
    const today = new Date().toISOString().slice(0, 10);

    // TheSportsDB에서 예정 경기 가져오기
    if (this.useTheSportsDB) {
      try {
        const theSportsDBMatches = await theSportsDB.getMatchesByDate(today);
        matches = matches.concat(theSportsDBMatches);
        console.log(`TheSportsDB에서 ${theSportsDBMatches.length}개 예정 경기 로드`);
      } catch (error) {
        console.error('TheSportsDB 예정 경기 로드 실패:', error.message);
      }
    }

    // API-FOOTBALL에서 예정 경기 가져오기
    if (this.useAPIFootball) {
      try {
        const apiFootballMatches = await apiFootball.getMatchesByDate(today);
        matches = matches.concat(apiFootballMatches);
        console.log(`API-FOOTBALL에서 ${apiFootballMatches.length}개 예정 경기 로드`);
      } catch (error) {
        console.error('API-FOOTBALL 예정 경기 로드 실패:', error.message);
      }
    }

    // 중복 제거 (ID 기준)
    const uniqueMatches = this.removeDuplicates(matches);
    console.log(`총 ${uniqueMatches.length}개 예정 경기 데이터 준비 완료`);
    return uniqueMatches;
  }

  // 어제 날짜의 완료된 경기 가져오기
  async getRecentMatches() {
    let matches = [];
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

    // TheSportsDB에서 완료 경기
    if (this.useTheSportsDB && theSportsDB.getMatchesByDate) {
      try {
        const theSportsDBMatches = await theSportsDB.getMatchesByDate(yesterday);
        matches = matches.concat(theSportsDBMatches.filter(m => m.status === 'FT'));
        console.log(`TheSportsDB에서 ${theSportsDBMatches.length}개 완료 경기 로드`);
      } catch (error) {
        console.error('TheSportsDB 완료 경기 로드 실패:', error.message);
      }
    }

    // API-FOOTBALL에서 완료 경기
    if (this.useAPIFootball) {
      try {
        const apiFootballMatches = await apiFootball.getMatchesByDate(yesterday);
        matches = matches.concat(apiFootballMatches.filter(m => m.status === 'FT'));
        console.log(`API-FOOTBALL에서 ${apiFootballMatches.length}개 완료 경기 로드`);
      } catch (error) {
        console.error('API-FOOTBALL 완료 경기 로드 실패:', error.message);
      }
    }

    // 중복 제거
    const uniqueMatches = this.removeDuplicates(matches);
    console.log(`총 ${uniqueMatches.length}개 완료 경기 데이터 준비 완료`);
    return uniqueMatches;
  }
}

module.exports = new SportsDataService(); 