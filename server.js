const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
require('dotenv').config();
const sportsDataService = require('./services/sportsDataService');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

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

app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 라우터 설정
const matchesRouter = require('./routes/matches');
const chatRouter = require('./routes/chat');
const { router: authRouter } = require('./routes/auth');

app.use('/api/matches', matchesRouter);
app.use('/api/chat', chatRouter);
app.use('/api/auth', authRouter);

// 헬스 체크
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
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

  // 채팅 메시지
  socket.on('chat-message', async (data) => {
    const { matchId, message } = data;
    const user = connectedUsers.get(socket.id);
    
    if (!user || !message.trim()) return;

    const messageData = {
      id: Date.now(),
      username: user.username,
      message: message.trim(),
      timestamp: new Date().toISOString(),
      userId: user.userId
    };

    // 모든 클라이언트에게 메시지 전송
    io.to(`match-${matchId}`).emit('new-message', messageData);
    
    console.log(`💬 채팅 메시지: ${user.username} -> ${message}`);
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

  // 실시간 경기 더미 데이터 응답
  socket.on('get_live_matches', async () => {
    try {
      console.log('실제 스포츠 API에서 실시간 경기 데이터 요청...');
      const liveMatches = await sportsDataService.getLiveMatches();
      
      if (liveMatches.length > 0) {
        console.log(`실제 API에서 ${liveMatches.length}개 실시간 경기 데이터 로드 완료`);
        socket.emit('live_matches_update', liveMatches);
      } else {
        console.log('실제 API에서 실시간 경기 데이터가 없어서 더미 데이터 사용');
        // 실제 데이터가 없을 때만 더미 데이터 사용
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
        socket.emit('live_matches_update', dummyMatches);
      }
    } catch (error) {
      console.error('실시간 경기 데이터 로드 실패:', error.message);
      // 에러 시 더미 데이터 사용
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
      socket.emit('live_matches_update', dummyMatches);
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

server.listen(PORT, () => {
  console.log(`🚀 서버가 포트 ${PORT}에서 실행 중입니다.`);
  console.log(`📊 환경: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 CORS Origin: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM 신호를 받았습니다. 서버를 종료합니다...');
  server.close(() => {
    console.log('✅ 서버가 정상적으로 종료되었습니다.');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT 신호를 받았습니다. 서버를 종료합니다...');
  server.close(() => {
    console.log('✅ 서버가 정상적으로 종료되었습니다.');
    process.exit(0);
  });
}); 