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
    const { latitude, longitude } = req.query;

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
    let radius = (2**(16-zoom))/2*1000;

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
router.get('/within-radius', (req, res) => {
    const { centerLatitude, centerLongitude, radius } = req.query;

    const searchLocationSql = 'SELECT *, SQRT(POW(latitude - ?, 2) + POW(longitude - ?, 2)) AS distance FROM location WHERE SQRT(POW(latitude - ?, 2) + POW(longitude - ?, 2)) <= ?';

    db.get().getConnection((err, connection) => {
        if (err) {
            console.error(err);
            return res.status(500).json({"errorCode": "U022", "message": '장소 삽입 접속 관련 서버 오류' });
        }

        connection.query(searchLocationSql, [centerLatitude, centerLongitude, centerLatitude, centerLongitude, radius], (err, result) => {
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

    const searchLocationSql = 'SELECT * FROM location WHERE locationid = ?';

    db.get().query(searchLocationSql, locationid, (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({"errorCode": "U023", "message": "장소 SQL 쿼리 사용 관련 오류" });
        }
        else if (result.length > 0) {
            return res.status(200).json(result);
        }
        else {
            return res.status(200).json({"locationid": "0"});
        }
    });
});

module.exports = router;

  
