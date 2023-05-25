const express = require('express');
const db = require("../db"); // 데이터베이스
const authenticateToken = require("../authenticateToken"); // 인증
const router = express.Router();

// 데이터 베이스 연결
db.connect(function(err) {
    if(err) {
        console.log('Unable to connect to MySQL');
        process.exit(1);
    }
});

// 클라이언트가 '추천' 버튼을 눌렀을 때 실행되는 핸들러
router.post('/', authenticateToken, (req, res) => {
    const { postingid } = req.body;
    const userid = req.user;
    const currentDate = new Date();

    const checkSql = 'SELECT * FROM recommand WHERE userid = ? AND postingid = ? LIMIT 1;';
    db.get().query(checkSql, [userid, postingid], (err, rows) => {
        if (err) {
            console.error(err);
            const error = { "errorCode": "U012", "message": "추천을 확인하는 동안 오류가 발생했습니다." };
            return res.status(500).json(error);
        }

        if (rows.length > 0) {
            // 추천 취소를 요청한 경우
            const deleteSql = 'DELETE FROM recommand WHERE userid = ? AND postingid = ?;';
            db.get().query(deleteSql, [userid, postingid], (err) => {
                if (err) {
                    console.error(err);
                    const error = { "errorCode": "U016", "message": "추천을 취소하는 동안 오류가 발생했습니다." };
                    return res.status(500).json(error);
                }
    
                // 현재 게시글의 추천 수를 가져옵니다.
                const countSql = 'SELECT COUNT(*) AS count FROM recommand WHERE postingid = ?;';
                db.get().query(countSql, postingid, (err, result) => {
                    if (err) {
                        console.error(err);
                        const error = { "errorCode": "U015", "message": "추천 수를 가져오는 동안 오류가 발생했습니다." };
                        return res.status(500).json(error);
                    }
                    const count = result[0].count;
                    res.json({ "count": count });
                });
            });
        } else {
            // 추천을 추가합니다.
            const insertSql = 'INSERT INTO recommand (userid, postingid, date) VALUES (?, ?, ?);';
            db.get().query(insertSql, [userid, postingid, currentDate], (err) => {
                if (err) {
                    console.error(err);
                    const error = { "errorCode": "U014", "message": "추천을 등록하는 동안 오류가 발생했습니다." };
                    return res.status(500).json(error);
                }
                // 현재 게시글의 추천 수를 가져옵니다.
                const countSql = 'SELECT COUNT(*) AS count FROM recommand WHERE postingid = ?;';
                db.get().query(countSql, postingid, (err, result) => {
                    if (err) {
                        console.error(err);
                        const error = { "errorCode": "U015", "message": "추천 수를 가져오는 동안 오류가 발생했습니다." };
                        return res.status(500).json(error);
                    }
                    const count = result[0].count;
                    res.json({ "count": count });
                });
            });
        }
    });
});

module.exports = router;
