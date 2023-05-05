const express = require('express');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const db = require("./db"); // 데이터베이스
const secretKey = 'my_secret_key';

const https = require('https');
const fs = require('fs');

const app = express();
const options = {
    key: fs.readFileSync("./config/cert.key"),
    cert: fs.readFileSync("./config/cert.crt")
  };

app.use(bodyParser.json());

// 토큰 배열
const tokens = [];

// 서버 시작
https.createServer(options, app).listen(3001, () => {
    console.log('Start HTTPS Server : localhost:3001');
});

// 데이터 베이스 연결
db.connect(function(err) {
    if(err) {
        console.log('Unable to connect to MySQL');
        process.exit(1);
    }
})

// 로그인
app.post('/api/login', (req, res) => {
    const { userid, password } = req.body;

    if(userid && password) { // 정보가 모두 입력되었는지 확인
        // 데이터 베이스 조회
        sql = "select * from pinover.user where userid = ? and password = ? limit 1;";
        db.get().query(sql, [userid, password], function (err,  rows) {
            if (err) throw err;
            if(rows.length > 0) {
                const token = jwt.sign(userid, secretKey); // 토큰 생성
                tokens.push(token); // 토큰 배열에 추가
                res.json({ token });
            } else {
                const error = { "errorCode" : "U006", "message" : "아이디 또는 비밀번호가 일치하지 않습니다."};
                res.status(401).json(error);
            }
        });
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
    }

    jwt.verify(token, secretKey, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
}

app.get('/api/protected', authenticateToken, (req, res) => {
    res.send('인증된 사용자만 접근할 수 있습니다.');
});

// 로그아웃
app.post('/api/logout', authenticateToken, (req, res) => {
    const token = req.headers.authorization;
    if (!token) {
        const error = { "errorCode" : "U006", "message" : "로그인이 되어 있지 않습니다."};
        res.status(401).json(error);
        return;
    }

    // 로그인 토큰 삭제
    const index = tokens.indexOf(token);
    if (index !== -1) tokens.splice(index, 1);

    res.send('로그아웃 되었습니다.');
});

// 회원가입
app.post('/api/signup', (req, res) => {
    const { userid, password, name, address, hp } = req.body;
    sql = "select * from pinover.user where userid = ? limit 1;";

    if(userid && password && name && address & hp) { // 정보가 모두 입력되었는지 확인
        // 데이터 베이스 조회
        db.get().query(sql, userid, function (err,  rows) {
            if (err) throw err;
            if(rows.length > 0) {
                const error = { "errorCode" : "U006", "message" : "이미 등록된 아이디입니다."};
                res.status(409).json(error);
            } else {
                // 데이터 베이스에 추가
                sql = "insert into user (userid, password, name, address, hp) values (?, ?, ?, ?, ?);";
                db.get().query(sql, [userid, password, name, address, hp], function (err,  data) {
                    if (err) throw err;
                    else {
                        res.send('회원가입이 완료되었습니다.');
                    }
                });
            }
        });
    }
});

// users/이름으로 검색
// TO DO : 데이터 베이스로 전환
app.get('/api/users/:userid', async (req, res) => {
    let userid = req.params;
    let data = users.find((u) => {
        return u.id === userid;
    });
    if(data) {
        res.json(data);
    } else {
        res.send('no person.');
    }
});

// UPDATE문
app.put('/api/users', authenticateToken, (req, res) => {
    const userid = req.user.userid;
    const { password, name, address, hp } = req.body;

    if(password && name && address && hp) { // 정보가 모두 입력되었는지 확인
        sql = "select * from pinover.user where userid = ? limit 1;";
        db.get().query(sql, userid, function (err,  rows) {
            if (err) throw err;
            if(rows.length > 0) {
                // 데이터 베이스 수정
                sql = "update user set password = ?, name = ?, address = ?, hp = ? where userid=?;";
                db.get().query(sql, [password, name, address, hp, userid], function (err,  data) {
                    if (err) throw err;
                    else {
                        res.send('회원 정보 수정이 완료되었습니다.');
                    }
                });
            } else {
                const error = { "errorCode" : "U006", "message" : "유저를 찾을 수 없습니다."};
                res.status(401).json(error);
            }
        });
    }
});

// DELETE문
// TO DO : 데이터 베이스로 전환
app.delete('/api/users', authenticateToken, (req, res) => {
    const userid = req.user.userid;
    const { password, name, address, hp } = req.body;

    if(password){
        // 데이터 베이스 조회
        sql = "select * from pinover.user where userid = ? limit 1;";
        db.get().query(sql, userid, function (err,  rows) {
            if (err) throw err;
            if(rows.length > 0) {
                // 데이터 베이스에서 삭제
                sql = "delete from user where userid=?";
                db.get().query(sql, userid, function (err,  rows) {
                    if (err) throw err;
                    else {
                        // 토큰 삭제
                        const authHeader = req.headers['authorization'];
                        const token = authHeader && authHeader.split(' ')[1];
                        const index = tokens.indexOf(token);
                        if (index !== -1) {
                            tokens.splice(index, 1);
                            res.send('회원 탈퇴가 완료되었습니다.');
                        }
                        else
                            res.sendStatus(401);
                    }
                });
            } else {
                const error = { "errorCode" : "U006", "message" : "유저를 찾을 수 없습니다."};
                res.status(401).json(error);
            }
        });
    }
});