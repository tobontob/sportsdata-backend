const express = require('express');
const router = express.Router();
const db = require('../config/database');

// 게시글 목록 조회
router.get('/:sport', async (req, res) => {
  const { sport } = req.params;
  try {
    const result = await db.query(
      'SELECT id, title, author, created_at, (SELECT COUNT(*) FROM board_comments WHERE post_id = b.id) AS comment_count FROM board_posts b WHERE sport = $1 ORDER BY created_at DESC',
      [sport]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'DB 조회 오류' });
  }
});

// 게시글 작성
router.post('/:sport', async (req, res) => {
  const { sport } = req.params;
  const { title, content } = req.body;
  // 실제로는 req.user에서 author를 가져와야 함
  const author = '익명';
  if (!title || !content) {
    return res.status(400).json({ error: '제목과 내용을 입력하세요.' });
  }
  try {
    const result = await db.query(
      'INSERT INTO board_posts (sport, title, content, author, created_at) VALUES ($1, $2, $3, $4, NOW()) RETURNING id',
      [sport, title, content, author]
    );
    res.status(201).json({ id: result.rows[0].id });
  } catch (err) {
    res.status(500).json({ error: 'DB 저장 오류' });
  }
});

// 게시글 상세 조회 + 댓글
router.get('/:sport/:postId', async (req, res) => {
  const { sport, postId } = req.params;
  try {
    const postResult = await db.query(
      'SELECT id, title, content, author, created_at FROM board_posts WHERE sport = $1 AND id = $2',
      [sport, postId]
    );
    if (postResult.rows.length === 0) {
      return res.status(404).json({ error: '게시글을 찾을 수 없습니다.' });
    }
    const commentsResult = await db.query(
      'SELECT id, user AS "user", content, created_at FROM board_comments WHERE post_id = $1 ORDER BY created_at ASC',
      [postId]
    );
    res.json({ post: postResult.rows[0], comments: commentsResult.rows });
  } catch (err) {
    res.status(500).json({ error: 'DB 조회 오류' });
  }
});

// 댓글 작성
router.post('/:sport/:postId/comments', async (req, res) => {
  const { postId } = req.params;
  const { content } = req.body;
  // 실제로는 req.user에서 user를 가져와야 함
  const user = '익명';
  if (!content) {
    return res.status(400).json({ error: '댓글 내용을 입력하세요.' });
  }
  try {
    await db.query(
      'INSERT INTO board_comments (post_id, user, content, created_at) VALUES ($1, $2, $3, NOW())',
      [postId, user, content]
    );
    res.status(201).json({ message: '댓글 작성 완료' });
  } catch (err) {
    res.status(500).json({ error: 'DB 저장 오류' });
  }
});

module.exports = router; 