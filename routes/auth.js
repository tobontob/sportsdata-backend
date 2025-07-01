const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const KakaoStrategy = require('passport-kakao').Strategy;
const NaverStrategy = require('passport-naver').Strategy;

// 회원가입
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, nickname } = req.body;

    // 필수 필드 검증
    if (!username || !email || !password) {
      return res.status(400).json({ error: '모든 필드를 입력해주세요.' });
    }

    // 이메일 형식 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: '올바른 이메일 형식을 입력해주세요.' });
    }

    // 비밀번호 길이 검증
    if (password.length < 6) {
      return res.status(400).json({ error: '비밀번호는 최소 6자 이상이어야 합니다.' });
    }

    // 중복 사용자 확인
    const existingUser = await db.query(
      'SELECT id FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: '이미 존재하는 사용자명 또는 이메일입니다.' });
    }

    // 비밀번호 해시화
    const hashedPassword = await bcrypt.hash(password, 12);

    // 사용자 생성
    const result = await db.query(
      'INSERT INTO users (username, email, password, nickname, created_at) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP) RETURNING id, username, email, nickname, created_at',
      [username, email, hashedPassword, nickname || username]
    );

    const user = result.rows[0];

    // JWT 토큰 생성
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: '회원가입이 완료되었습니다.',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        nickname: user.nickname
      },
      token
    });
  } catch (error) {
    console.error('회원가입 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 로그인
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // 필수 필드 검증
    if (!username || !password) {
      return res.status(400).json({ error: '사용자명과 비밀번호를 입력해주세요.' });
    }

    // 사용자 조회
    const result = await db.query(
      'SELECT * FROM users WHERE username = $1 OR email = $1',
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: '사용자명 또는 비밀번호가 올바르지 않습니다.' });
    }

    const user = result.rows[0];

    // 비밀번호 검증
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: '사용자명 또는 비밀번호가 올바르지 않습니다.' });
    }

    // JWT 토큰 생성
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // 마지막 로그인 시간 업데이트
    await db.query(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id]
    );

    res.json({
      message: '로그인이 완료되었습니다.',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        nickname: user.nickname,
        created_at: user.created_at
      },
      token
    });
  } catch (error) {
    console.error('로그인 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 토큰 검증 미들웨어
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: '인증 토큰이 필요합니다.' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: '유효하지 않은 토큰입니다.' });
    }
    req.user = user;
    next();
  });
};

// 경고 3회 이상 차단 미들웨어
const requireNotBlocked = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const result = await db.query('SELECT warning_count FROM users WHERE id = $1', [userId]);
    if (result.rows.length > 0 && result.rows[0].warning_count >= 3) {
      return res.status(403).json({ error: '경고 누적으로 차단된 계정입니다.' });
    }
    next();
  } catch (err) {
    return res.status(500).json({ error: '차단 여부 확인 실패' });
  }
};

// 사용자 프로필 조회
router.get('/profile', authenticateToken, requireNotBlocked, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, username, email, nickname, created_at, last_login FROM users WHERE id = $1',
      [req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('프로필 조회 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 프로필 업데이트
router.put('/profile', authenticateToken, requireNotBlocked, async (req, res) => {
  try {
    const { nickname, email } = req.body;

    const result = await db.query(
      'UPDATE users SET nickname = $1, email = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING id, username, email, nickname, created_at',
      [nickname, email, req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    }

    res.json({
      message: '프로필이 업데이트되었습니다.',
      user: result.rows[0]
    });
  } catch (error) {
    console.error('프로필 업데이트 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 비밀번호 변경
router.put('/password', authenticateToken, requireNotBlocked, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: '현재 비밀번호와 새 비밀번호를 입력해주세요.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: '새 비밀번호는 최소 6자 이상이어야 합니다.' });
    }

    // 현재 비밀번호 확인
    const userResult = await db.query(
      'SELECT password FROM users WHERE id = $1',
      [req.user.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    }

    const isValidPassword = await bcrypt.compare(currentPassword, userResult.rows[0].password);
    if (!isValidPassword) {
      return res.status(400).json({ error: '현재 비밀번호가 올바르지 않습니다.' });
    }

    // 새 비밀번호 해시화 및 업데이트
    const hashedNewPassword = await bcrypt.hash(newPassword, 12);
    await db.query(
      'UPDATE users SET password = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [hashedNewPassword, req.user.userId]
    );

    res.json({ message: '비밀번호가 변경되었습니다.' });
  } catch (error) {
    console.error('비밀번호 변경 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 소셜 로그인 전략 등록 (clientID, secret, callbackURL은 실제 환경변수로 대체 필요)
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
    const username = `google_${profile.id}`;
    const nickname = profile.displayName || username;
    let user;
    // DB에서 사용자 조회
    const result = await db.query('SELECT * FROM users WHERE username = $1 OR email = $2', [username, email]);
    if (result.rows.length > 0) {
      user = result.rows[0];
    } else {
      // 사용자 생성
      const insert = await db.query(
        'INSERT INTO users (username, email, nickname, created_at) VALUES ($1, $2, $3, CURRENT_TIMESTAMP) RETURNING *',
        [username, email, nickname]
      );
      user = insert.rows[0];
    }
    done(null, user);
  } catch (err) {
    done(err);
  }
}));

passport.use(new KakaoStrategy({
  clientID: process.env.KAKAO_CLIENT_ID,
  clientSecret: process.env.KAKAO_CLIENT_SECRET,
  callbackURL: process.env.KAKAO_CALLBACK_URL
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const kakaoAccount = profile._json && profile._json.kakao_account ? profile._json.kakao_account : {};
    const email = kakaoAccount.email || null;
    const username = `kakao_${profile.id}`;
    const nickname = (kakaoAccount.profile && kakaoAccount.profile.nickname) || username;
    let user;
    const result = await db.query('SELECT * FROM users WHERE username = $1 OR email = $2', [username, email]);
    if (result.rows.length > 0) {
      user = result.rows[0];
    } else {
      const insert = await db.query(
        'INSERT INTO users (username, email, nickname, created_at) VALUES ($1, $2, $3, CURRENT_TIMESTAMP) RETURNING *',
        [username, email, nickname]
      );
      user = insert.rows[0];
    }
    done(null, user);
  } catch (err) {
    done(err);
  }
}));

passport.use(new NaverStrategy({
  clientID: process.env.NAVER_CLIENT_ID,
  clientSecret: process.env.NAVER_CLIENT_SECRET,
  callbackURL: process.env.NAVER_CALLBACK_URL
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const naverProfile = profile._json && profile._json.response ? profile._json.response : {};
    const email = naverProfile.email || null;
    const username = `naver_${profile.id}`;
    const nickname = naverProfile.nickname || username;
    let user;
    const result = await db.query('SELECT * FROM users WHERE username = $1 OR email = $2', [username, email]);
    if (result.rows.length > 0) {
      user = result.rows[0];
    } else {
      const insert = await db.query(
        'INSERT INTO users (username, email, nickname, created_at) VALUES ($1, $2, $3, CURRENT_TIMESTAMP) RETURNING *',
        [username, email, nickname]
      );
      user = insert.rows[0];
    }
    done(null, user);
  } catch (err) {
    done(err);
  }
}));

// 소셜 로그인 라우트
router.get('/social/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/social/google/callback', passport.authenticate('google', { session: false }), (req, res) => {
  // JWT 발급 및 프론트엔드로 반환
  const user = req.user;
  const token = jwt.sign(
    { userId: user.id, username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
  res.json({ user, token });
});

router.get('/social/kakao', passport.authenticate('kakao'));
router.get('/social/kakao/callback', passport.authenticate('kakao', { session: false }), (req, res) => {
  const user = req.user;
  const token = jwt.sign(
    { userId: user.id, username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
  res.json({ user, token });
});

router.get('/social/naver', passport.authenticate('naver'));
router.get('/social/naver/callback', passport.authenticate('naver', { session: false }), (req, res) => {
  const user = req.user;
  const token = jwt.sign(
    { userId: user.id, username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
  res.json({ user, token });
});

// 관리자용 회원 목록/상세/경고/차단/해제 API
router.get('/admin/users', authenticateToken, requireAdmin, async (req, res) => {
  const { q } = req.query;
  let query = 'SELECT id, username, email, nickname, created_at, warning_count FROM users';
  let params = [];
  if (q) {
    query += ' WHERE username ILIKE $1 OR email ILIKE $1 OR nickname ILIKE $1';
    params.push(`%${q}%`);
  }
  query += ' ORDER BY id DESC';
  const result = await db.query(query, params);
  res.json(result.rows);
});

router.get('/admin/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const result = await db.query('SELECT id, username, email, nickname, created_at, warning_count FROM users WHERE id = $1', [id]);
  if (result.rows.length === 0) return res.status(404).json({ error: '사용자 없음' });
  res.json(result.rows[0]);
});

// 경고/차단/해제 (PATCH)
router.patch('/admin/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { action } = req.body;
  if (!['warn', 'block', 'unblock'].includes(action)) {
    return res.status(400).json({ error: '유효하지 않은 action' });
  }
  let query, params;
  if (action === 'warn') {
    query = 'UPDATE users SET warning_count = COALESCE(warning_count,0) + 1 WHERE id = $1 RETURNING *';
    params = [id];
  } else if (action === 'block') {
    query = 'UPDATE users SET warning_count = 99 WHERE id = $1 RETURNING *';
    params = [id];
  } else if (action === 'unblock') {
    query = 'UPDATE users SET warning_count = 0 WHERE id = $1 RETURNING *';
    params = [id];
  }
  const result = await db.query(query, params);
  if (result.rows.length === 0) return res.status(404).json({ error: '사용자 없음' });
  res.json(result.rows[0]);
});

module.exports = { router, authenticateToken, requireNotBlocked }; 