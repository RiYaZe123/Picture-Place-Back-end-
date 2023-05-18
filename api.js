const express = require('express');
const bodyParser = require('body-parser');
const cookie = require("cookie-parser");
const userRouter = require('./routes/user');
const postRouter = require('./routes/posting');
const reportRouter = require('./routes/report');
const recommendRouter = require('./routes/recommend');

//https 모듈
const https = require('https');
const fs = require('fs');

const app = express();
const options = {
    key: fs.readFileSync("./config/www.picplace.kro.kr-key.pem"),
    cert: fs.readFileSync("./config/www.picplace.kro.kr-chain.pem")
};

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));
app.use(cookie());

// 라우터 설정
app.use('/user', userRouter);
app.use('/posting', postRouter);
app.use('/report', reportRouter);
app.use('/recommend', recommendRouter);

// 실제 서버 구동 여부 true: 서버, false: 로컬
const prod = false;
let server_url;
let picture_url;
if(prod) {
    server_url = 'www.picplace.kro.kr';
    picture_url = 'https://www.picplace.kro.kr/posting/picture/';
} else {
    server_url = 'localhost';
    picture_url = 'https://localhost/posting/picture/';
}

// 서버 시작
https.createServer(options, app).listen(443, () => {
    console.log('Start HTTPS Server : ' + server_url);
});

/*
// 장소 등록
app.post('/api/location', (req, res) => {
    const { roadname, roadnumber, latitude, longitude, locationhp } = req.body;

    const insertLocationSql = 'INSERT INTO location (roadname, roadnumber, latitude, longitude, locationhp) VALUES (?, ?, ?, ?, ?)';

    db.get().getConnection((err, connection) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ message: '내부 서버 오류' });
        }

        connection.query(insertLocationSql, [roadname, roadnumber, latitude, longitude, locationhp], (err, result) => {
            connection.release(); // 커넥션 반환

            if (err) {
                console.error(err);
                return res.status(500).json({ message: '내부 서버 오류' });
            }

            return res.status(200).json({ message: '장소가 등록되었습니다.' });
        });
    });
});

// 장소 검색
app.get('/api/location', (req, res) => {
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
            return res.status(500).json({ message: '내부 서버 오류' });
        }

        connection.query(searchLocationSql, queryParams, (err, result) => {
            connection.release(); // 커넥션 반환
            if (err) {
                console.error(err);
                return res.status(500).json({ message: '내부 서버 오류' });
            }
            return res.status(200).json(result);
        });
    });
});
*/




