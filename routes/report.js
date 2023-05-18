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

// 클라이언트가 '신고' 버튼을 눌렀을 때 실행되는 핸들러
router.post('/', authenticateToken, (req, res) => {
    const { postingid, declarationreason } = req.body;
    const userid = req.user;

    // 해당 사용자와 게시글에 대한 신고가 이미 존재하는지 확인합니다.
    const checkSql = 'SELECT * FROM declaration WHERE userid = ? AND postingid = ? LIMIT 1;';
    db.get().query(checkSql, [userid, postingid], (err, rows) => {
        if (err) {
            console.error(err);
            const error = { "errorCode": "U017", "message": "신고를 확인하는 동안 오류가 발생했습니다." };
            return res.status(500).json(error);
        }

        if (rows.length > 0) {
            // 이미 신고가 존재하는 경우
            const error = { "errorCode": "U018", "message": "이미 신고한 게시글입니다." };
            return res.status(400).json(error);
        } else {
            // 신고를 추가합니다.
            const insertSql = 'INSERT INTO declaration (userid, postingid, declarationreason) VALUES (?, ?, ?);';
            db.get().query(insertSql, [userid, postingid, declarationreason], (err) => {
                if (err) {
                    console.error(err);
                    const error = { "errorCode": "U019", "message": "신고를 등록하는 동안 오류가 발생했습니다." };
                    return res.status(500).json(error);
                }

                // 게시글의 신고 수를 확인합니다.
                const countSql = 'SELECT COUNT(*) AS count FROM declaration WHERE postingid = ?;';
                db.get().query(countSql, postingid, (err, result) => {
                    if (err) {
                        console.error(err);
                        const error = { "errorCode": "U020", "message": "신고 수를 가져오는 동안 오류가 발생했습니다." };
                        return res.status(500).json(error);
                    }

                    const count = result[0].count;

                    // 일정 이상의 신고 수를 확인하고, 비공개로 전환합니다.
                    const threshold = 3; // 일정 이상의 신고 수
                    if (count >= threshold) {
                        const updateSql = 'UPDATE posting SET declaration = ? WHERE postingid = ?;';
                        db.get().query(updateSql, [1, postingid], (err) => {
                            if (err) {
                                console.error(err);
                                const error = { "errorCode": "U021", "message": "게시글을 비공개로 전환하는 동안 오류가 발생했습니다." };
                                return res.status(500).json(error);
                            }
                            res.json({ "message": "게시글이 비공개로 전환되었습니다." });
                        });
                    } else {
                        res.json({ "message": "신고가 접수되었습니다." });
                    }
                });
            });
        }
    });
});

module.exports = router;