const express = require('express');
const crypto = require('crypto');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const db = require("./db"); // 데이터베이스
const secretKey = 'my_secret_key';

//https 모듈
const https = require('https');
const fs = require('fs');

//업로드 미들웨어
const upload = multer({dest: 'pictures/'});

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
});

// 로그인
app.post('/api/login', (req, res) => {
    const { userid, password } = req.body;

    if(userid && password) { // 정보가 모두 입력되었는지 확인
        // 데이터 베이스 조회
        sql = "select * from pinover.user where userid = ? limit 1;";
        db.get().query(sql, userid, function (err,  rows) {
            if (err) throw err;
            if(rows.length > 0) {
                let user = rows[0];
                crypto.pbkdf2(password, user.salt, 100000, 64, 'sha512', function(err, derivedKey){ // 패스워드 sha512 암호화, salt 사용
                    if(err) throw err;
                    if(derivedKey.toString('base64') === user.password){ // 암호화된 패스워드가 일치하는지 확인
                        const token = jwt.sign(userid, secretKey); // 토큰 생성
                        tokens.push(token); // 토큰 배열에 추가
                        res.json({ token });
                    } else {
                        const error = { "errorCode" : "U007", "message" : "비밀번호가 일치하지 않습니다."};
                        res.status(401).json(error);
                    }
                });
            } else {
                const error = { "errorCode" : "U006", "message" : "아이디가 존재하지 않습니다."};
                res.status(401).json(error);
            }
        });
    } else {
        const error = { "errorCode" : "U008", "message" : "입력되지 않은 정보가 있습니다."};
        res.status(401).json(error);
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

    if(userid && password && name && address && hp) { // 정보가 모두 입력되었는지 확인
        // 데이터 베이스 조회
        db.get().query(sql, userid, function (err,  rows) {
            if (err) throw err;
            if(rows.length > 0) {
                const error = { "errorCode" : "U006", "message" : "이미 등록된 아이디입니다."};
                res.status(409).json(error);
            } else {
                // 데이터 베이스에 추가
                crypto.randomBytes(64, (err, buf) => { // salt 생성
                    if (err) throw err;
                    let salt = buf.toString('base64');
                    crypto.pbkdf2(password, salt, 100000, 64, 'sha512', (err, derivedKey) => { // 패스워드 sha512 암호화, salt 사용
                        if (err) throw err;
                        let pw = derivedKey.toString('base64');
                        sql = "insert into user (userid, password, name, address, hp, salt) values (?, ?, ?, ?, ?, ?);";
                        db.get().query(sql, [userid, pw, name, address, hp, salt], function (err,  data) {
                            if (err) throw err;
                            else {
                                res.send('회원가입이 완료되었습니다.');
                            }
                        });
                    });
                });
            }
        });
    } else {
        const error = { "errorCode" : "U008", "message" : "입력되지 않은 정보가 있습니다."};
        res.status(401).json(error);
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
    const userid = req.user;
    const { password, updatepassword, name, address, hp } = req.body;

    if(password && updatepassword && name && address && hp) { // 정보가 모두 입력되었는지 확인
        sql = "select * from pinover.user where userid = ? limit 1;";
        db.get().query(sql, userid, function (err,  rows) {
            if (err) throw err;
            if(rows.length > 0) {
                let user = rows[0];
                crypto.pbkdf2(password, user.salt, 100000, 64, 'sha512', function(err, derivedKey){ // 패스워드 sha512 암호화, salt 사용
                    if(err) throw err;
                    if(derivedKey.toString('base64') === user.password){ // 암호화된 패스워드가 일치하는지 확인
                        // 데이터 베이스 수정
                        crypto.randomBytes(64, (err, buf) => {
                            if (err) throw err;
                            let salt = buf.toString('base64');
                            crypto.pbkdf2(updatepassword, salt, 100000, 64, 'sha512', (err, derivedKey) => {
                                if (err) throw err;
                                let pw = derivedKey.toString('base64');
                                sql = "update user set password = ?, name = ?, address = ?, hp = ?, salt=? where userid=?;";
                                db.get().query(sql, [pw, name, address, hp, salt, userid], function (err,  data) {
                                    if (err) throw err;
                                    else {
                                        res.send('회원 정보 수정이 완료되었습니다.');
                                    }
                                });
                            });
                        });
                    } else {
                        const error = { "errorCode" : "U007", "message" : "비밀번호가 일치하지 않습니다."};
                        res.status(401).json(error);
                    }
                });
            } else {
                const error = { "errorCode" : "U006", "message" : "유저를 찾을 수 없습니다."};
                res.status(401).json(error);
            }
        });
    } else {
        const error = { "errorCode" : "U008", "message" : "입력되지 않은 정보가 있습니다."};
        res.status(401).json(error);
    }
});

// DELETE문
app.delete('/api/users', authenticateToken, (req, res) => {
    const userid = req.user;
    const { password } = req.body;

    if(password){
        // 데이터 베이스 조회
        let sql = "select * from pinover.user where userid = ? limit 1;";
        db.get().query(sql, userid, function (err,  rows) {
            if (err) throw err;
            if(rows.length > 0) {
                let user = rows[0];
                crypto.pbkdf2(password, user.salt, 100000, 64, 'sha512', function(err, derivedKey){ // 패스워드 sha512 암호화, salt 사용
                    if(err) throw err;
                    if(derivedKey.toString('base64') === user.password){ // 암호화된 패스워드가 일치하는지 확인
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
                        const error = { "errorCode" : "U007", "message" : "비밀번호가 일치하지 않습니다."};
                        res.status(401).json(error);
                    }
                });
            } else {
                const error = { "errorCode" : "U006", "message" : "유저를 찾을 수 없습니다."};
                res.status(401).json(error);
            }
        });
    } else {
        const error = { "errorCode" : "U008", "message" : "입력되지 않은 정보가 있습니다."};
        res.status(401).json(error);
    }
});

app.post('/api/upload', authenticateToken, upload.array('photo', 5), (req, res) => {
    const files = req.files;
    //originalname : 업로드된 파일 원본 이름
    //path : 서버에 저장된 파일의 경로
    //const {originalname, path} = file;
    const userid = req.user;
    const uploaddate = new Date();
    let postingid = 0;
    const { roadname, content, disclosure } = req.body;

    
    // 글 작성
    let sql = 'INSERT INTO posting (disclosure, content, roadname, userid, postdate) VALUES (?, ?, ?, ?, ?);';
    db.get().query(sql, [disclosure, content, roadname, userid, uploaddate], (err, result) => {
        if(err) {
            console.error(err);
            res.status(500).send('Internal Server Error');
        } else {
            postingid = result.insertId;
            files.forEach(function(file) { // 여러 개 이미지 업로드
                const {originalname, path} = file;
                const pictureid = path.split('\\');
                const extension = originalname.split('.');
                const picturesql = 'INSERT INTO picture (userid, pictureid, name, date, extension, postingid) VALUES (?, ?, ?, ?, ?, ?)';
                    db.get().query(picturesql, [userid, pictureid[pictureid.length - 1], originalname, uploaddate, extension[extension.length - 1], postingid], (err, result) => {
                        if (err) {
                            console.error(err);
                            res.status(500).send('Internal Server Error');
                        } else if (path==files[files.length-1].path) {
                            res.send('File uploaded and saved to database');
                        }
                    });
            });
        }
    });
});

app.get('/api/mypin', authenticateToken, (req, res) => {
    const userid = req.user;
    const sql = 'SELECT * FROM posting WHERE userid = ?';
    db.get().query(sql, [userid], (err, results) => {
        if(err) {
            console.error(err);
            res.status(500).send('Internal Server Error');
        } else {
            res.json(results);
        }
    });
});

app.get('/api/search', (req, res) => {
    const searchTerm = req.query.q; // 쿼리 파라미터로 전달된 검색어

    const sql = 'SELECT * FROM posting WHERE roadname LIKE ? AND disclosure != "비공개"';
    db.get().query(sql, [`%${searchTerm}%`], (err, results) => {
    if (err) {
      console.error(err);
      res.status(500).send('Internal Server Error');
    } else {
      res.json(results);
    }
  });
});