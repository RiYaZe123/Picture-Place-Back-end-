const express = require('express');
const db = require("../db"); // 데이터베이스
const authenticateToken = require("../authenticateToken"); // 인증
const router = express.Router();
const picture_url = 'https://www.picplace.kro.kr/posting/picture/';

// 데이터 베이스 연결
db.connect(function(err) {
    if(err) {
        console.log('Unable to connect to MySQL');
        process.exit(1);
    }
});

// 장소 등록
router.post('/', authenticateToken, (req, res) => {
    const { locationid, locationname, locationaddress, latitude, longitude, locationhp } = req.body;

    const insertLocationSql = 'INSERT INTO location (locationid, locationname, locationaddress, latitude, longitude, locationhp) VALUES (?, ?, ?, ?, ?)';

    db.get().getConnection((err, connection) => {
        if (err) {
            console.error(err);
            return res.status(500).json({"errorCode": "U022", "message": '장소 삽입 접속 관련 서버 오류' });
        }

        connection.query(insertLocationSql, [locationid, locationname, locationaddress, latitude, longitude, locationhp], (err, result) => {
            connection.release(); // 커넥션 반환

            if (err) {
                console.error(err);
                return res.status(500).json({"errorCode": "U023", "message": '장소 SQL 쿼리 사용 관련 오류' });
            }

            return res.status(200).json({ message: '장소가 등록되었습니다.' });
        });
    });
});

// 영역 안의 드는 장소 찾기
// minLatitude, maxLatitude, minLongitude, maxLongitude은 검색하려는 영역의 경계 좌표를 나타냄
router.get('/within-area', (req, res) => {
    const { minLatitude, maxLatitude, minLongitude, maxLongitude } = req.query;

    const searchLocationSql = 'SELECT * FROM location WHERE latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ?';

    db.get().getConnection((err, connection) => {
        if (err) {
            console.error(err);
            return res.status(500).json({"errorCode": "U022", "message": '장소 삽입 접속 관련 서버 오류' });
        }

        connection.query(searchLocationSql, [minLatitude, maxLatitude, minLongitude, maxLongitude], (err, result) => {
            connection.release(); // 커넥션 반환
            if (err) {
                console.error(err);
                return res.status(500).json({"errorCode": "U023", "message": '장소 SQL 쿼리 사용 관련 오류' });
            }
            return res.status(200).json(result);
        });
    });
});

// 검색한 장소에서 가장 가까운 장소 찾기
// 검색하려는 중심 위치의 좌표를 나타낸다. 이를 기준으로 가장 가까운 장소를 찾는다.
/*
router.get('/nearest', (req, res) => {
    const { locationid } = req.query;

    // locationid로 posting 받아오기

    const searchLocationSql = 'SELECT *, SQRT(POW(latitude - ?, 2) + POW(longitude - ?, 2)) AS distance FROM location ORDER BY distance ASC LIMIT 1';

    db.get().getConnection((err, connection) => {
        if (err) {
            console.error(err);
            return res.status(500).json({"errorCode": "U022", "message": '장소 삽입 접속 관련 서버 오류' });
        }

        connection.query(searchLocationSql, [latitude, longitude], (err, result) => {
            connection.release(); // 커넥션 반환
            if (err) {
                console.error(err);
                return res.status(500).json({"errorCode": "U023", "message": '장소 SQL 쿼리 사용 관련 오류' });
            }
            return res.status(200).json(result);
        });
    });
});
*/
router.get('/nearest', (req, res) => {
    const { centerLatitude, centerLongitude } = req.query;
    let zoom = req.query.zoom;
    if (zoom < 10) {
        zoom = 10;
    } else if (zoom > 15) {
        zoom = 15;
    }
    let radius = (2**(15-zoom))*1000;

    const searchLocationSql = `
    SELECT posting.*, location.locationname
    FROM location
    INNER JOIN posting ON posting.locationid = location.locationid
    WHERE ST_Distance_Sphere(
        point(longitude, latitude),
        point(?, ?)
    ) <= ?;
    `;

    db.get().getConnection((err, connection) => {
        if (err) {
            console.error(err);
            return res.status(500).json({"errorCode": "U022", "message": '장소 삽입 접속 관련 서버 오류' });
        }

        connection.query(searchLocationSql, [centerLongitude, centerLatitude, radius], (err, results) => {
            connection.release(); // 커넥션 반환
            if (err) {
                console.error(err);
                return res.status(500).json({"errorCode": "U023", "message": '장소 SQL 쿼리 사용 관련 오류' });
            }
            return res.status(200).json(results);
        });
    });
});

// 검색한 장소의 반경 안에서 장소 찾기
// centerLatitude, centerLongitude는 검색하려는 중심 위치의 좌표를 나타내며, radius는 반경을 나타낸다.
// 1번은 이거 하나만 수정
router.get('/within-radius', (req, res) => {
    const { centerLatitude, centerLongitude } = req.query;
    let zoom = req.query.zoom;
    if (zoom < 10) {
        zoom = 10;
    } else if (zoom > 15) {
        zoom = 15;
    }

    const radius = Math.pow(2, (15 - zoom))*1000; // 반경 계산

    const searchLocationSql = `
        SELECT latitude, longitude, locationid
        FROM location
        WHERE ST_Distance_Sphere(
            point(longitude, latitude),
            point(?, ?)
        ) <= ?;
    `;

    db.get().getConnection((err, connection) => {
        if (err) {
            console.error(err);
            return res.status(500).json({"errorCode": "U022", "message": '장소 삽입 접속 관련 서버 오류' });
        }

        connection.query(searchLocationSql, [centerLongitude, centerLatitude, radius], (err, result) => {
            connection.release(); // 커넥션 반환
            if (err) {
                console.error(err);
                return res.status(500).json({"errorCode": "U023", "message": '장소 SQL 쿼리 사용 관련 오류' });
            }
            return res.status(200).json(result);
        });
    });
});


// locationid로 장소 가져오기
router.get('/', (req, res) => {
    const { locationid } = req.query;

    const sql = 'SELECT posting.*, location.locationname FROM posting INNER JOIN location ON posting.locationid = location.locationid WHERE posting.locationid = ?';
    db.get().query(sql, [locationid], (err, postingresults) => {
        if (err) {
            console.error(err);
            const error = { "errorCode": "U009", "message": "데이터베이스에 접속하지 못했습니다." };
            res.status(500).json(error);
        } else if (postingresults.length > 0) {
            const postingIds = postingresults.map(postingresult => postingresult.postingid);
            const sql = 'SELECT * FROM picture WHERE postingid IN ?';
            const sqlParams = [postingIds];

            db.get().query(sql, [sqlParams], (err, pictureresults) => {
                if (err) {
                    console.error(err);
                    const error = { "errorCode": "U009", "message": "데이터베이스에 접속하지 못했습니다." };
                    res.status(500).json(error);
                } else if (pictureresults.length > 0) {
                    for (let i = 0; i < postingresults.length; i++) {
                        let picarr = new Array();
                        pictureresults.forEach(function (picture) {
                            if (postingresults[i].postingid == picture.postingid) {
                                picarr.push(picture_url + picture.pictureid);
                            }
                        });
                        postingresults[i].pictures = picarr;
                    }

                    // 태그 가져오기
                    const tagSql = 'SELECT * FROM tags WHERE postingid IN ?';
                    db.get().query(tagSql, [sqlParams], (err, tagResults) => {
                        if (err) {
                            console.error(err);
                            const error = { "errorCode": "U009", "message": "데이터베이스에 접속하지 못했습니다." };
                            res.status(500).json(error);
                        } else {
                            const tagMap = tagResults.reduce((acc, row) => {
                                if (!acc[row.postingid]) {
                                    acc[row.postingid] = [];
                                }
                                acc[row.postingid].push(row.tag);
                                return acc;
                            }, {});

                            postingresults.forEach(posting => {
                                posting.tags = tagMap[posting.postingid] || [];
                            });

                            // 현재 게시글의 추천 수를 가져옵니다.
                            const countSql = 'SELECT postingid, COUNT(*) AS count FROM recommand WHERE postingid IN ? GROUP BY postingid;';
                            const countParams = [postingIds];
                            db.get().query(countSql, [countParams], (err, result) => {
                                if (err) {
                                    console.error(err);
                                    const error = { "errorCode": "U015", "message": "추천 수를 가져오는 동안 오류가 발생했습니다." };
                                    return res.status(500).json(error);
                                }

                                const counts = result.reduce((acc, row) => {
                                    acc[row.postingid] = row.count;
                                    return acc;
                                }, {});

                                postingresults.forEach(posting => {
                                    posting.recommendCount = counts[posting.postingid] || 0;
                                });
                                console.log("마이핀 조회 성공");
                                res.json(postingresults);
                            });
                        }
                    });
                } else {
                    for (let i = 0; i < postingresults.length; i++) {
                        postingresults[i].pictures = "";
                    }
                    res.json(postingresults);
                }
            });
        } else {
            const error = { "errorCode": "U010", "message": "DB 검색 결과가 없습니다." };
            res.status(404).json(error);
        }
    });
});

module.exports = router;

  
