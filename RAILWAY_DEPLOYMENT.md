# Railway 배포 가이드

## 1. Railway 계정 설정

1. [Railway](https://railway.app)에 가입
2. GitHub 계정으로 로그인
3. 새 프로젝트 생성

## 2. Redis 서비스 추가

### 방법 1: Railway Redis 플러그인 사용
1. 프로젝트 대시보드에서 "New" 클릭
2. "Database" → "Redis" 선택
3. 플랜 선택 (무료 플랜: 512MB RAM, 1GB 저장공간)
4. 생성 후 `REDIS_URL` 환경변수 확인

### 방법 2: Upstash Redis 사용 (추천)
1. [Upstash](https://upstash.com)에서 Redis 인스턴스 생성
2. 무료 플랜: 10,000 요청/일, 256MB 저장공간
3. 연결 정보 복사

## 3. 백엔드 배포

### GitHub 연동
1. GitHub 저장소 연결
2. 브랜치 선택 (main 또는 master)
3. 자동 배포 활성화

### 환경변수 설정
Railway 대시보드에서 다음 환경변수 설정:

```env
NODE_ENV=production
PORT=5000
REDIS_URL=redis://your-redis-url
CORS_ORIGIN=https://your-frontend-domain.com
JWT_SECRET=your-secret-key
API_FOOTBALL_KEY=your-api-key
```

### 배포 설정
- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Health Check Path**: `/api/health`

## 4. 프론트엔드 배포 (Vercel)

### Vercel 설정
1. [Vercel](https://vercel.com)에서 프로젝트 생성
2. GitHub 저장소 연결
3. 환경변수 설정:

```env
NEXT_PUBLIC_API_URL=https://your-railway-backend-url
NEXT_PUBLIC_SOCKET_URL=https://your-railway-backend-url
```

## 5. 도메인 설정

### 커스텀 도메인 (선택사항)
1. Railway에서 커스텀 도메인 설정
2. DNS 레코드 추가
3. SSL 인증서 자동 발급

## 6. 모니터링 및 로그

### Railway 대시보드
- 실시간 로그 확인
- 리소스 사용량 모니터링
- 배포 상태 확인

### Redis 모니터링
- `/api/redis/status` - Redis 연결 상태
- `/api/redis/test` - Redis 기능 테스트

## 7. 스케일링

### 수평 확장
1. Railway에서 인스턴스 수 증가
2. Redis 어댑터로 Socket.IO 동기화
3. 로드 밸런서 자동 설정

### 리소스 업그레이드
- CPU/RAM 증가
- Redis 플랜 업그레이드

## 8. 트러블슈팅

### 일반적인 문제
1. **Redis 연결 실패**
   - 환경변수 `REDIS_URL` 확인
   - Redis 서비스 상태 확인

2. **CORS 오류**
   - `CORS_ORIGIN` 환경변수 확인
   - 프론트엔드 도메인 추가

3. **메모리 부족**
   - Redis 플랜 업그레이드
   - 백엔드 리소스 증가

### 로그 확인
```bash
# Railway CLI 사용
railway logs
railway status
```

## 9. 비용 최적화

### 무료 플랜 한계
- Railway: 월 500시간
- Upstash Redis: 10,000 요청/일
- Vercel: 월 100GB 대역폭

### 유료 플랜 업그레이드
- 사용량에 따른 과금
- 예측 가능한 월 비용

## 10. 보안 고려사항

### 환경변수 보안
- 민감한 정보는 환경변수로 관리
- `.env` 파일은 Git에 커밋하지 않음

### API 키 관리
- Railway 환경변수로 관리
- 정기적인 키 로테이션

### CORS 설정
- 허용된 도메인만 설정
- 프로덕션 환경에서 엄격한 설정 