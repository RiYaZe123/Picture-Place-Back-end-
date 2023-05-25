// suggest2.js

const express = require('express');
const router = express.Router();
const db = require('./db');

router.get('/', (req, res) => {
    const sql = `
      SELECT p.postingid, p.disclosure, p.content, p.roadname, p.userid, p.postdate,
             GROUP_CONCAT(DISTINCT CONCAT('${picture_url}', pi.pictureid)) AS pictures,
             GROUP_CONCAT(DISTINCT t.tag) AS tags,
             COUNT(r.postingid) AS recommendCount
      FROM posting p
      LEFT JOIN picture pi ON p.postingid = pi.postingid
      LEFT JOIN tags t ON p.postingid = t.postingid
      LEFT JOIN recommand r ON p.postingid = r.postingid
      WHERE t.tag = (
        SELECT tag
        FROM tags
        ORDER BY RAND()
        LIMIT 1
      ) AND p.disclosure != '비공개'
      GROUP BY p.postingid;
    `;
  
    db.get().query(sql, (err, results) => {
      if (err) {
        console.error(err);
        const error = { "errorCode": "U009", "message": "데이터베이스에 접속하지 못했습니다." };
        res.status(500).json(error);
      } else {
        const response = results.map(result => {
          const posting = {
            postingid: result.postingid,
            disclosure: result.disclosure,
            content: result.content,
            roadname: result.roadname,
            userid: result.userid,
            postdate: result.postdate,
            pictures: result.pictures ? result.pictures.split(',') : [],
            tags: result.tags ? result.tags.split(',') : [],
            recommendCount: result.recommendCount || 0
          };
          return posting;
        });
  
        res.json(response);
      }
    });
});

router.get('/popular', (req, res) => {
  const sql = `
    SELECT p.*, COUNT(r.postingid) AS recommendCount
    FROM posting p
    LEFT JOIN recommand r ON p.postingid = r.postingid
    WHERE p.roadname = (
      SELECT roadname
      FROM posting
      GROUP BY roadname
      ORDER BY COUNT(*) DESC
      LIMIT 1
    )
    GROUP BY p.postingid;
  `;

  db.get().query(sql, (err, results) => {
    if (err) {
      console.error(err);
      const error = { "errorCode": "U009", "message": "데이터베이스에 접속하지 못했습니다." };
      return res.status(500).json(error);
    }

    res.json(results);
  });
});

module.exports = router;
