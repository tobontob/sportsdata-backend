const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const { createAdapter } = require('@socket.io/redis-adapter');
require('dotenv').config();
const sportsDataService = require('./services/sportsDataService');
const redisManager = require('./src/redis');
const fs = require('fs');

const app = express();

// CORS 미들웨어를 가장 먼저 적용
const allowedOrigins = [
  "http://localhost:3000",
  "https://web-production-190c.up.railway.app",
  "https://sportsdata-frontend.vercel.app"
];
const corsOptions = {
  origin: allowedOrigins,
  credentials: true
};
console.log('CORS 옵션:', corsOptions);
app.use(cors(corsOptions));

const server = http.createServer(app);
const io = socketIo(server, {
  cors: corsOptions
});

// Redis 연결 및 Socket.IO 어댑터 설정
async function initializeRedis() {
  try {
    const { pubClient, subClient } = await redisManager.connect();
    io.adapter(createAdapter(pubClient, subClient));
    console.log('✅ Socket.IO Redis 어댑터 설정 완료');
    return true;
  } catch (error) {
    console.error('❌ Redis 연결 실패:', error.message);
    console.log('⚠️ Redis 없이 서버 실행 중...');
    return false;
  }
}

// 실제 적용되는 origin과 환경변수 값 로그 출력
console.log('실제 적용되는 allowedOrigins:', allowedOrigins);
console.log('환경변수 FRONTEND_URL:', process.env.FRONTEND_URL);
console.log('실제 REDIS_URL:', process.env.REDIS_URL);

// 미들웨어 설정
app.use(helmet()); // 보안 헤더
app.use(compression()); // 응답 압축
app.use(morgan('combined')); // 로깅

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15분
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // 최대 100 요청
  message: '너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요.'
});
app.use('/api/', limiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 라우터 설정
const matchesRouter = require('./routes/matches');
const chatRouter = require('./routes/chat');
const { router: authRouter } = require('./routes/auth');
const leaguesRouter = require('./routes/leagues');
const teamsRouter = require('./routes/teams');
const reportsRouter = require('./routes/reports');
const boardRouter = require('./routes/board');
const communityRouter = require('./routes/community');

app.use('/api/matches', matchesRouter);
app.use('/api/chat', chatRouter);
app.use('/api/auth', authRouter);
app.use('/api/leagues', leaguesRouter);
app.use('/api/teams', teamsRouter);
app.use('/api/admin/reports', reportsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/board', boardRouter);
app.use('/api/community', communityRouter);

// 헬스 체크
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    redis: redisManager.getStatus()
  });
});

// Redis 상태 확인
app.get('/api/redis/status', (req, res) => {
  res.json({
    status: redisManager.getStatus(),
    timestamp: new Date().toISOString()
  });
});

// Redis 테스트
app.get('/api/redis/test', async (req, res) => {
  try {
    const testKey = 'test:connection';
    const testValue = { message: 'Redis 연결 테스트', timestamp: new Date().toISOString() };
    
    await redisManager.set(testKey, testValue, 60);
    const retrievedValue = await redisManager.get(testKey);
    await redisManager.del(testKey);
    
    res.json({
      success: true,
      message: 'Redis 연결 및 작업 테스트 성공',
      testValue: retrievedValue,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Redis 테스트 실패',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Socket.IO 연결 관리
const connectedUsers = new Map();
const matchRooms = new Map();

io.on('connection', (socket) => {
  console.log(`🔌 사용자 연결: ${socket.id}`);

  // 모든 이벤트 catch
  socket.onAny((event, ...args) => {
    console.log('수신 이벤트:', event, args);
  });

  // 사용자 인증
  socket.on('authenticate', (data) => {
    const { username, userId } = data;
    connectedUsers.set(socket.id, { username, userId });
    console.log(`👤 사용자 인증: ${username}`);
  });

  // 경기방 입장
  socket.on('join-match', (matchId) => {
    socket.join(`match-${matchId}`);
    matchRooms.set(socket.id, matchId);
    console.log(`🏟️ 경기방 입장: ${socket.id} -> 경기 ${matchId}`);
    
    // 입장 메시지 브로드캐스트
    const user = connectedUsers.get(socket.id);
    if (user) {
      io.to(`match-${matchId}`).emit('user-joined', {
        username: user.username,
        timestamp: new Date().toISOString()
      });
    }
  });

  // 경기방 퇴장
  socket.on('leave-match', (matchId) => {
    socket.leave(`match-${matchId}`);
    matchRooms.delete(socket.id);
    console.log(`🚪 경기방 퇴장: ${socket.id} -> 경기 ${matchId}`);
  });

  // === 프론트엔드 호환: subscribe_match, unsubscribe_match, chat_message ===
  socket.on('subscribe_match', (matchId) => {
    socket.join(`match_${matchId}`);
    console.log('join room:', `match_${matchId}`, socket.id, Array.from(socket.rooms));
    // 기존 메시지 전송(옵션)
    // socket.emit('chat_history', ...);
  });

  socket.on('unsubscribe_match', (matchId) => {
    socket.leave(`match_${matchId}`);
    console.log('leave room:', `match_${matchId}`, socket.id, Array.from(socket.rooms));
  });

  socket.on('chat_message', (message) => {
    console.log('Chat message received:', message);
    const matchId = message.matchId;
    // 디버깅: 현재 socket.rooms 확인
    console.log('현재 socket.rooms:', Array.from(socket.rooms));
    // 디버깅: 브로드캐스트 직전 로그
    console.log(`io.to(match_${matchId}).emit('new_message', ...) 실행!`);
    io.to(`match_${matchId}`).emit('new_message', message);
  });

  // 경기 스코어 업데이트
  socket.on('score-update', (data) => {
    const { matchId, homeScore, awayScore, minute, status } = data;
    
    const scoreData = {
      matchId,
      homeScore,
      awayScore,
      minute,
      status,
      timestamp: new Date().toISOString()
    };

    // 모든 클라이언트에게 스코어 업데이트 전송
    io.to(`match-${matchId}`).emit('score-updated', scoreData);
    console.log(`⚽ 스코어 업데이트: 경기 ${matchId} - ${homeScore}:${awayScore}`);
  });

  // 실시간, 예정, 완료, 더미 데이터 순서로 응답
  socket.on('get_live_matches', async () => {
    try {
      const liveMatches = await sportsDataService.getLiveMatches();
      if (liveMatches.length > 0) {
        socket.emit('live_matches_update', liveMatches);
        return;
      }
      const upcomingMatches = await sportsDataService.getUpcomingMatches();
      if (upcomingMatches.length > 0) {
        socket.emit('upcoming_matches_update', upcomingMatches);
        return;
      }
      const recentMatches = await sportsDataService.getRecentMatches();
      if (recentMatches.length > 0) {
        socket.emit('recent_matches_update', recentMatches);
        return;
      }
      // 마지막으로 더미 데이터 반환
      const dummyMatches = [
        {
          id: 1,
          homeTeam: '맨체스터 유나이티드',
          awayTeam: '리버풀',
          homeScore: 2,
          awayScore: 1,
          status: 'live',
          minute: 67,
          league: '프리미어 리그',
          time: '67분'
        },
        {
          id: 2,
          homeTeam: '바르셀로나',
          awayTeam: '레알 마드리드',
          homeScore: 1,
          awayScore: 1,
          status: 'live',
          minute: 54,
          league: '라 리가',
          time: '54분'
        }
      ];
      socket.emit('dummy_matches_update', dummyMatches);
    } catch (error) {
      // 에러 시에도 더미 데이터 반환
      const dummyMatches = [
        {
          id: 1,
          homeTeam: '맨체스터 유나이티드',
          awayTeam: '리버풀',
          homeScore: 2,
          awayScore: 1,
          status: 'live',
          minute: 67,
          league: '프리미어 리그',
          time: '67분'
        },
        {
          id: 2,
          homeTeam: '바르셀로나',
          awayTeam: '레알 마드리드',
          homeScore: 1,
          awayScore: 1,
          status: 'live',
          minute: 54,
          league: '라 리가',
          time: '54분'
        }
      ];
      socket.emit('dummy_matches_update', dummyMatches);
    }
  });

  // 연결 해제
  socket.on('disconnect', () => {
    const user = connectedUsers.get(socket.id);
    const matchId = matchRooms.get(socket.id);
    
    if (user && matchId) {
      io.to(`match-${matchId}`).emit('user-left', {
        username: user.username,
        timestamp: new Date().toISOString()
      });
    }
    
    connectedUsers.delete(socket.id);
    matchRooms.delete(socket.id);
    console.log(`🔌 사용자 연결 해제: ${socket.id}`);
  });
});

// 에러 핸들링
app.use((err, req, res, next) => {
  console.error('서버 오류:', err.stack);
  res.status(500).json({ 
    error: '서버 내부 오류가 발생했습니다.',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 핸들링
app.use('*', (req, res) => {
  res.status(404).json({ error: '요청한 리소스를 찾을 수 없습니다.' });
});

const PORT = process.env.PORT || 5000;

// Redis 초기화 후 서버 시작
async function startServer() {
  console.log('서버 시작!');
  console.log('현재 작업 디렉토리:', process.cwd());
  console.log('.env 파일 존재 여부:', fs.existsSync('.env'));
  if (fs.existsSync('.env')) {
    console.log('.env 파일 내용:', fs.readFileSync('.env', 'utf-8'));
  }

  // Redis 초기화
  const redisConnected = await initializeRedis();
  
  // 서버 시작
  server.listen(PORT, () => {
    console.log(`🚀 서버가 포트 ${PORT}에서 실행 중입니다.`);
    console.log(`📊 환경: ${process.env.NODE_ENV || 'development'}`);
    console.log('🚀 서버가 정상적으로 실행 중입니다.');
  });
}

startServer();