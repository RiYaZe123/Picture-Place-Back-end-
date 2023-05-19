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
                        const accessToken = jwt.sign({userid: userid}, secretKey, {'expiresIn': '1h'}); // 토큰 생성
                        const refreshToken = jwt.sign({userid: userid}, refreshKey, {'expiresIn': '24h'}); // 토큰 생성
                        //tokens.push(token); // 토큰 배열에 추가
                        res.cookie("access", accessToken);
                        res.cookie("refresh", refreshToken);
                        //res.json({ accessToken });
                        res.send();
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

router.post("/refresh", (req, res) => {
    const refreshToken = req.body.refresh;
    if (refreshToken) {
        // refresh token이 정상인지 확인
        jwt.verify(refreshToken, refreshKey, (err, decode) => {
            //에러가 있으면 refresh token이 썩었기 때문에 다시 로그인 시킨다.
            if (err) {
                const error = { "errorCode" : "U006", "message" : "로그인이 만료되었습니다. 다시 로그인해주세요."};
                res.status(403).json(error);
            } else {
                const userid = decode.userid;
                const accessToken = jwt.sign({userid: userid}, secretKey, {'expiresIn': '1h'}); // 토큰 생성
                res.cookie("access", accessToken);
                res.send({ "message": "로그인이 연장되었습니다." });
            }
        });
    }
});

router.get('/protected', authenticateToken, (req, res) => {
    res.send('인증된 사용자만 접근할 수 있습니다.');
});

// 로그아웃
router.post('/logout', authenticateToken, (req, res) => {
    const authHeader = req.headers.authorization;
    const accessToken = authHeader && authHeader.split(' ')[1];
    if (!accessToken) {
        const error = { "errorCode" : "U006", "message" : "로그인이 되어 있지 않습니다."};
        res.status(401).json(error);
    } else {
        jwt.verify(accessToken, secretKey, (err, decode) => {
            //에러가 있으면 refresh token이 썩었기 때문에 다시 로그인 시킨다.
            if (err) {
                const error = { "errorCode" : "U006", "message" : "로그인이 만료되었습니다."};
                res.status(403).json(error);
            } else {
                res.clearCookie('access');
                res.clearCookie('refresh');
                res.send({ "message" : "로그아웃이 완료되었습니다." });
            }
        });
    }
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

/*
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
*/

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