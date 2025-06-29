import axios from 'axios'

// API 설정
const API_KEY = process.env.API_FOOTBALL_KEY
const BASE_URL = 'https://api-football-v1.p.rapidapi.com/v3'

// 목업 데이터 (실제 API 키가 없을 때 사용)
const mockLiveMatches = [
  {
    id: 1,
    homeTeam: "맨체스터 유나이티드",
    awayTeam: "리버풀",
    homeScore: 2,
    awayScore: 1,
    status: "live",
    time: "15:30",
    league: "프리미어 리그",
    date: "2024-01-15",
    minute: 67,
    events: [
      { id: 1, type: "goal", minute: 23, player: "라시포드", team: "home" },
      { id: 2, type: "goal", minute: 45, player: "살라", team: "away" },
      { id: 3, type: "goal", minute: 58, player: "브루노", team: "home" }
    ]
  },
  {
    id: 2,
    homeTeam: "바르셀로나",
    awayTeam: "레알 마드리드",
    homeScore: 0,
    awayScore: 0,
    status: "live",
    time: "16:00",
    league: "라 리가",
    date: "2024-01-15",
    minute: 34,
    events: []
  },
  {
    id: 3,
    homeTeam: "바이에른 뮌헨",
    awayTeam: "도르트문트",
    homeScore: 3,
    awayScore: 2,
    status: "live",
    time: "14:30",
    league: "분데스리가",
    date: "2024-01-15",
    minute: 89,
    events: [
      { id: 4, type: "goal", minute: 12, player: "케인", team: "home" },
      { id: 5, type: "goal", minute: 28, player: "레반도프스키", team: "away" },
      { id: 6, type: "goal", minute: 45, player: "무시알라", team: "home" },
      { id: 7, type: "goal", minute: 67, player: "브란트", team: "away" },
      { id: 8, type: "goal", minute: 82, player: "케인", team: "home" }
    ]
  }
]

const mockScheduledMatches = [
  {
    id: 4,
    homeTeam: "첼시",
    awayTeam: "아스널",
    homeScore: 0,
    awayScore: 0,
    status: "scheduled",
    time: "20:00",
    league: "프리미어 리그",
    date: "2024-01-15"
  },
  {
    id: 5,
    homeTeam: "파리 생제르맹",
    awayTeam: "마르세유",
    homeScore: 0,
    awayScore: 0,
    status: "scheduled",
    time: "21:00",
    league: "리그 1",
    date: "2024-01-15"
  }
]

// 실제 API 호출 함수
async function fetchFromAPI(endpoint) {
  if (!API_KEY) {
    throw new Error('API key not configured')
  }

  try {
    const response = await axios.get(`${BASE_URL}${endpoint}`, {
      headers: {
        'x-rapidapi-key': API_KEY,
        'x-rapidapi-host': 'api-football-v1.p.rapidapi.com'
      }
    })
    return response.data
  } catch (error) {
    console.error('API Error:', error.message)
    throw error
  }
}

// 실시간 경기 데이터 가져오기
export async function getLiveMatches() {
  try {
    if (API_KEY) {
      const data = await fetchFromAPI('/fixtures?live=all')
      return transformApiData(data.response || [])
    } else {
      // 목업 데이터 반환
      console.log('Using mock data - API key not configured')
      return mockLiveMatches
    }
  } catch (error) {
    console.error('Error fetching live matches:', error)
    // API 실패 시 목업 데이터 반환
    return mockLiveMatches
  }
}

// 예정된 경기 데이터 가져오기
export async function getScheduledMatches() {
  try {
    if (API_KEY) {
      const today = new Date().toISOString().split('T')[0]
      const data = await fetchFromAPI(`/fixtures?date=${today}`)
      return transformApiData(data.response || [])
    } else {
      console.log('Using mock data - API key not configured')
      return mockScheduledMatches
    }
  } catch (error) {
    console.error('Error fetching scheduled matches:', error)
    return mockScheduledMatches
  }
}

// API 데이터를 우리 형식으로 변환
function transformApiData(apiMatches) {
  return apiMatches.map(match => ({
    id: match.fixture.id,
    homeTeam: match.teams.home.name,
    awayTeam: match.teams.away.name,
    homeScore: match.goals.home || 0,
    awayScore: match.goals.away || 0,
    status: match.fixture.status.short === 'LIVE' ? 'live' : 
            match.fixture.status.short === 'FT' ? 'finished' : 'scheduled',
    time: new Date(match.fixture.date).toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit'
    }),
    league: match.league.name,
    date: new Date(match.fixture.date).toISOString().split('T')[0],
    minute: match.fixture.status.elapsed || 0,
    events: [] // 이벤트 데이터는 별도 API 호출 필요
  }))
}

// 특정 경기 상세 정보 가져오기
export async function getMatchDetails(matchId) {
  try {
    if (API_KEY) {
      const data = await fetchFromAPI(`/fixtures?id=${matchId}`)
      return data.response?.[0] || null
    } else {
      // 목업 상세 데이터
      const allMatches = [...mockLiveMatches, ...mockScheduledMatches]
      return allMatches.find(match => match.id === parseInt(matchId)) || null
    }
  } catch (error) {
    console.error('Error fetching match details:', error)
    return null
  }
} 