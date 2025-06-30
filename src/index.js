import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import { getLiveMatches, getScheduledMatches } from './services/footballApi.js'

const app = express()
const server = createServer(app)
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
})

// 미들웨어
app.use(cors())
app.use(express.json())

// 정적 파일 제공
app.use(express.static('public'))

// 기본 라우트
app.get('/', (req, res) => {
  res.json({ 
    message: 'LiveScore API Server',
    version: '1.0.0',
    status: 'running'
  })
})

// API 라우트
app.get('/api/matches/live', async (req, res) => {
  try {
    const matches = await getLiveMatches()
    res.json(matches)
  } catch (error) {
    console.error('Error fetching live matches:', error)
    res.status(500).json({ error: 'Failed to fetch live matches' })
  }
})

app.get('/api/matches/scheduled', async (req, res) => {
  try {
    const matches = await getScheduledMatches()
    res.json(matches)
  } catch (error) {
    console.error('Error fetching scheduled matches:', error)
    res.status(500).json({ error: 'Failed to fetch scheduled matches' })
  }
})

// 특정 경기 정보
app.get('/api/matches/:id', async (req, res) => {
  try {
    const matchId = parseInt(req.params.id)
    const matches = await getLiveMatches()
    const match = matches.find(m => m.id === matchId)
    
    if (!match) {
      return res.status(404).json({ error: '경기를 찾을 수 없습니다.' })
    }
    
    res.json(match)
  } catch (error) {
    console.error('Error fetching match:', error)
    res.status(500).json({ error: 'Failed to fetch match' })
  }
})

// 배팅 배당률 정보
app.get('/api/betting/odds/:matchId', (req, res) => {
  const matchId = parseInt(req.params.matchId)
  
  // 목업 배팅 데이터
  const bettingData = {
    matchId,
    bookmakers: ['Bet365', 'William Hill', 'Ladbrokes', 'Paddy Power'],
    lastUpdate: new Date(),
    markets: [
      {
        id: '1',
        name: 'Match Result',
        key: 'match_winner',
        outcomes: [
          { name: '홈팀 승리', price: 2.10 },
          { name: '무승부', price: 3.40 },
          { name: '원정팀 승리', price: 3.60 }
        ]
      },
      {
        id: '2',
        name: 'Over/Under 2.5 Goals',
        key: 'over_under',
        outcomes: [
          { name: 'Over 2.5', price: 1.85 },
          { name: 'Under 2.5', price: 1.95 }
        ]
      },
      {
        id: '3',
        name: 'Both Teams to Score',
        key: 'btts',
        outcomes: [
          { name: 'Yes', price: 1.75 },
          { name: 'No', price: 2.05 }
        ]
      }
    ]
  }
  
  res.json(bettingData)
})

// 경기 분석 정보
app.get('/api/betting/analysis/:matchId', (req, res) => {
  const matchId = parseInt(req.params.matchId)
  
  // 목업 분석 데이터
  const analysisData = {
    matchId,
    homeForm: 'WWDLL',
    awayForm: 'LWDWW',
    headToHead: '홈팀 2승 1무승부 2패 원정팀',
    prediction: '홈팀 승리',
    confidence: 75,
    stats: {
      homeAvgGoals: 1.8,
      awayAvgGoals: 1.2,
      homeAvgConceded: 1.1,
      awayAvgConceded: 1.5
    }
  }
  
  res.json(analysisData)
})

// 배팅 가능한 경기 목록
app.get('/api/betting/matches', (req, res) => {
  const { league } = req.query
  
  let matches = [
    {
      id: 1,
      homeTeam: '맨체스터 유나이티드',
      awayTeam: '리버풀',
      league: '프리미어 리그',
      time: '오늘 21:00',
      status: '예정'
    },
    {
      id: 2,
      homeTeam: '바르셀로나',
      awayTeam: '레알 마드리드',
      league: '라 리가',
      time: '오늘 23:00',
      status: '예정'
    },
    {
      id: 3,
      homeTeam: '파리 생제르맹',
      awayTeam: '바이에른 뮌헨',
      league: '챔피언스 리그',
      time: '내일 03:00',
      status: '예정'
    },
    {
      id: 4,
      homeTeam: '첼시',
      awayTeam: '아스널',
      league: '프리미어 리그',
      time: '진행중',
      status: 'live',
      homeScore: 1,
      awayScore: 0
    },
    {
      id: 5,
      homeTeam: '인터 밀란',
      awayTeam: 'AC 밀란',
      league: '세리에 A',
      time: '내일 21:00',
      status: '예정'
    }
  ]
  
  if (league && league !== 'all') {
    matches = matches.filter(match => match.league === league)
  }
  
  res.json(matches)
})

// 채팅 메시지 히스토리
app.get('/api/chat/:matchId', (req, res) => {
  const matchId = parseInt(req.params.matchId)
  const messages = chatMessages.get(matchId) || []
  res.json(messages)
})

// 채팅 메시지 저장소 (메모리 기반, 실제로는 DB 사용)
const chatMessages = new Map()

// Socket.IO 연결 처리
io.on('connection', (socket) => {
  console.log('User connected:', socket.id)

  // 실시간 경기 요청
  socket.on('get_live_matches', async () => {
    try {
      const matches = await getLiveMatches()
      socket.emit('live_matches_update', matches)
    } catch (error) {
      console.error('Error fetching live matches for socket:', error)
      socket.emit('live_matches_update', [])
    }
  })

  // 특정 경기 구독
  socket.on('subscribe_match', (matchId) => {
    socket.join(`match_${matchId}`)
    console.log('join room:', `match_${matchId}`, socket.id, Array.from(socket.rooms))
    // 기존 메시지 전송
    const messages = chatMessages.get(matchId) || []
    socket.emit('chat_history', messages)
  })

  // 경기 구독 해제
  socket.on('unsubscribe_match', (matchId) => {
    socket.leave(`match_${matchId}`)
    console.log('leave room:', `match_${matchId}`, socket.id, Array.from(socket.rooms))
  })

  // 채팅 메시지 처리
  socket.on('chat_message', (message) => {
    console.log('Chat message received:', message)
    const matchId = message.matchId
    if (!chatMessages.has(matchId)) {
      chatMessages.set(matchId, [])
    }
    const messages = chatMessages.get(matchId)
    messages.push(message)
    // 최근 100개 메시지만 유지
    if (messages.length > 100) {
      messages.splice(0, messages.length - 100)
    }
    // 디버깅: 현재 socket.rooms 확인
    console.log('현재 socket.rooms:', Array.from(socket.rooms))
    // 디버깅: 브로드캐스트 직전 로그
    console.log(`io.to(match_${matchId}).emit('new_message', ...) 실행!`)
    // 해당 경기 채팅방에 메시지 브로드캐스트 (본인 포함)
    io.to(`match_${matchId}`).emit('new_message', message)
  })

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id)
  })
})

// 실시간 데이터 업데이트 (1분마다)
setInterval(async () => {
  try {
    const matches = await getLiveMatches()
    io.emit('live_matches_update', matches)
  } catch (error) {
    console.error('Error in scheduled update:', error)
  }
}, 60000) // 1분

const PORT = process.env.PORT || 3001

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
  console.log(`Socket.IO server ready`)
  console.log(`CORS origin: ${process.env.CORS_ORIGIN || 'http://localhost:3000'}`)
}) 