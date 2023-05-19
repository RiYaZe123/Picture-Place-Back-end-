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
router.post('/', (req, res) => {
    const { roadname, roadnumber, latitude, longitude, locationhp } = req.body;

    const insertLocationSql = 'INSERT INTO location (roadname, roadnumber, latitude, longitude, locationhp) VALUES (?, ?, ?, ?, ?)';

    db.get().getConnection((err, connection) => {
        if (err) {
            console.error(err);
            return res.status(500).json({"errorCode": "U022", "message": '장소 삽입 접속 관련 서버 오류' });
        }

        connection.query(insertLocationSql, [roadname, roadnumber, latitude, longitude, locationhp], (err, result) => {
            connection.release(); // 커넥션 반환

            if (err) {
                console.error(err);
                return res.status(500).json({"errorCode": "U023", "message": '장소 SQL 쿼리 사용 관련 오류' });
            }

            return res.status(200).json({ message: '장소가 등록되었습니다.' });
        });
    });
});

// 장소 검색
router.get('/', (req, res) => {
    const { roadname, roadnumber } = req.query;

    let searchLocationSql = 'SELECT * FROM location WHERE 1=1';

    const queryParams = [];

    if (roadname) {
        searchLocationSql += ' AND roadname LIKE ?';
        queryParams.push(`%${roadname}%`);
    }

    if (roadnumber) {
        searchLocationSql += ' AND roadnumber LIKE ?';
        queryParams.push(`%${roadnumber}%`);
    }

    db.get().getConnection((err, connection) => {
        if (err) {
            console.error(err);
            return res.status(500).json({"errorCode": "U022", "message": '장소 삽입 접속 관련 서버 오류' });
        }

        connection.query(searchLocationSql, queryParams, (err, result) => {
            connection.release(); // 커넥션 반환
            if (err) {
                console.error(err);
                return res.status(500).json({"errorCode": "U023", "message": '장소 SQL 쿼리 사용 관련 오류' });
            }
            return res.status(200).json(result);
        });
    });
});

// 장소 수정
router.put('/:locationId', (req, res) => {
    const locationId = req.params.locationId;
    const { roadname, roadnumber, latitude, longitude, locationhp } = req.body;
  
    const updateLocationSql = 'UPDATE location SET roadname = ?, roadnumber = ?, latitude = ?, longitude = ?, locationhp = ? WHERE locationid = ?';
  
    db.get().getConnection((err, connection) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ "errorCode": "U022", "message": '장소 수정 접속 관련 서버 오류' });
      }
  
      connection.query(updateLocationSql, [roadname, roadnumber, latitude, longitude, locationhp, locationId], (err, result) => {
        connection.release(); // 커넥션 반환
  
        if (err) {
          console.error(err);
          return res.status(500).json({ "errorCode": "U023", "message": '장소 SQL 쿼리 사용 관련 오류' });
        }
  
        if (result.affectedRows === 0) {
          return res.status(404).json({ "errorCode": "U024", "message": '수정할 장소가 없습니다.' });
        }
  
        return res.status(200).json({ message: '장소가 수정되었습니다.' });
      });
    });
  });
  
  module.exports = router;
  
