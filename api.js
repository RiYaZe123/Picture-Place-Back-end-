const express = require('express');
const crypto = require('crypto');
const bodyParser = require('body-parser');
const cookie = require("cookie-parser");
const jwt = require('jsonwebtoken');
const multer = require('multer');
const db = require("./db"); // 데이터베이스
const userRouter = require('./routes/user');
const postRouter = require('./routes/posting');
const reportRouter = require('./routes/report');
const recommendRouter = require('./routes/recommend');
const secretKey = 'my_secret_key';
const refreshKey = 'my_refresh_key';

//https 모듈
const https = require('https');
const fs = require('fs');

//업로드 미들웨어
const upload = multer({dest: 'pictures/'});

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
    picture_url = 'https://www.picplace.kro.kr/api/picture/';
} else {
    server_url = 'localhost';
    picture_url = 'https://localhost/api/picture/';
}

// 토큰 배열
const tokens = [];

// 서버 시작
https.createServer(options, app).listen(443, () => {
    console.log('Start HTTPS Server : ' + server_url);
});

// 데이터 베이스 연결
db.connect(function(err) {
    if(err) {
        console.log('Unable to connect to MySQL');
        process.exit(1);
    }
});


//인증이 필요한 요청에 대해 미들웨어 함수
// 401 Unauthorized 응답은 클라이언트의 요청에 대해 인증 정보가 필요한데, 해당 정보가 없거나 잘못된 경우를 나타냅니다.
// 403 Forbidden 응답은 클라이언트가 인증되었으나 요청한 자원에 접근할 권한이 없는 경우를 나타냅니다.
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) return res.sendStatus(401);

    // tokens 배열에서 현재 요청에 대한 인증 토큰이 있는지 확인
    if (!tokens.includes(token)) {
        return res.sendStatus(403);
    } else {
        jwt.verify(token, secretKey, (err, user) => {
            if (err) return res.sendStatus(403);
            req.user = user;
            next();
        });
    }
}

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




