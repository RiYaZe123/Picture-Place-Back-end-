const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const db = require("../db"); // 데이터베이스
const authenticateToken = require("../authenticateToken"); // 인증
const router = express.Router();
const secretKey = 'my_secret_key';
const refreshKey = 'my_refresh_key';

// 데이터 베이스 연결
db.connect(function(err) {
    if(err) {
        console.log('Unable to connect to MySQL');
        process.exit(1);
    }
});

// 로그인
router.post('/login', (req, res) => {
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
                        const accessToken = jwt.sign(userid, secretKey); // 토큰 생성
                        const refreshToken = jwt.sign(userid, refreshKey); // 토큰 생성
                        //tokens.push(token); // 토큰 배열에 추가
                        res.cookie("refresh", refreshToken, { maxAge: 24 * 60 * 60 * 1000 });
                        res.json({ accessToken });
                    } else {
                        const error = { "errorCode" : "U007", "message" : "비밀번호가 일치하지 않습니다."};
                        res.status(400).json(error);
                    }
                });
            } else {
                const error = { "errorCode" : "U006", "message" : "아이디가 존재하지 않습니다."};
                res.status(400).json(error);
            }
        });
    } else {
        const error = { "errorCode" : "U008", "message" : "입력되지 않은 정보가 있습니다."};
        res.status(400).json(error);
    }
});

router.post("/refresh", authenticateToken, (req, res) => {
    res.send(accessToken);
});

// 회원가입
router.post('/signup', (req, res) => {
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
                                res.json({ "message" : "회원가입이 완료되었습니다." });
                            }
                        });
                    });
                });
            }
        });
    } else {
        const error = { "errorCode" : "U008", "message" : "입력되지 않은 정보가 있습니다."};
        res.status(400).json(error);
    }
});

router.get('/protected', authenticateToken, (req, res) => {
    res.send('인증된 사용자만 접근할 수 있습니다.');
});

// 로그아웃
router.post('/logout', authenticateToken, (req, res) => {
    const token = req.headers.authorization;
    if (!token) {
        const error = { "errorCode" : "U006", "message" : "로그인이 되어 있지 않습니다."};
        res.status(401).json(error);
        return;
    }
    // 로그인 토큰 삭제
    let token2 = token.split(' ').reverse()[0];
    const index = tokens.indexOf(token2);
    if (index !== -1) {
        tokens.splice(index, 1);
        res.send('로그아웃 되었습니다.');
        console.log(tokens);
    }
});


// users/이름으로 검색
// TO DO : 데이터 베이스로 전환
router.get('/:userid', async (req, res) => {
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
router.put('/', authenticateToken, (req, res) => {
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
                                        res.json({ "message" : "회원 정보 수정이 완료되었습니다." });
                                    }
                                });
                            });
                        });
                    } else {
                        const error = { "errorCode" : "U007", "message" : "비밀번호가 일치하지 않습니다."};
                        res.status(400).json(error);
                    }
                });
            } else {
                const error = { "errorCode" : "U006", "message" : "유저를 찾을 수 없습니다."};
                res.status(400).json(error);
            }
        });
    } else {
        const error = { "errorCode" : "U008", "message" : "입력되지 않은 정보가 있습니다."};
        res.status(400).json(error);
    }
});

// DELETE문
router.delete('/', authenticateToken, (req, res) => {
    const userid = req.user;
    const { password } = req.body;
    const refreshToken = req.cookies.refreshToken;

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
                                res.clearCookie(refreshToken);
                                res.json({ "mesaage" : "회원 탈퇴가 완료되었습니다." });
                            }
                        });
                    } else {
                        const error = { "errorCode" : "U007", "message" : "비밀번호가 일치하지 않습니다."};
                        res.status(400).json(error);
                    }
                });
            } else {
                const error = { "errorCode" : "U006", "message" : "유저를 찾을 수 없습니다."};
                res.status(400).json(error);
            }
        });
    } else {
        const error = { "errorCode" : "U008", "message" : "입력되지 않은 정보가 있습니다."};
        res.status(400).json(error);
    }
});

module.exports = router;