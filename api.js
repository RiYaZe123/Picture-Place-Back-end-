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
    key: fs.readFileSync("./config/www.picplace.kro.kr-key.pem"),
    cert: fs.readFileSync("./config/www.picplace.kro.kr-crt.pem")
  };

app.use(bodyParser.json());

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
                                    res.json({ "mesaage" : "회원 탈퇴가 완료되었습니다." });
                                } else {
                                    res.sendStatus(500);
                                }
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

app.post('/api/upload', authenticateToken, upload.array('photo', 5), (req, res) => {
    const files = req.files;
    //originalname : 업로드된 파일 원본 이름
    //path : 서버에 저장된 파일의 경로
    const userid = req.user;
    const uploaddate = new Date();
    let postingid = 0;
    const { roadname, content, disclosure } = req.body;
    
    // 글 작성
    const sql = 'INSERT INTO posting (disclosure, content, roadname, userid, postdate) VALUES (?, ?, ?, ?, ?);';
    db.get().query(sql, [disclosure, content, roadname, userid, uploaddate], (err, result) => {
        if(err) {
            console.error(err);
            const error = { "errorCode" : "U009", "message" : "데이터베이스에 핀을 등록하지 못했습니다."};
            res.status(500).json(error);
        } else if (files.length > 0) {
            postingid = result.insertId;
            let picture_array = files.map(picture => [userid, picture.filename, picture.originalname, uploaddate, picture.mimetype, postingid] );

            const picture_sql = 'INSERT INTO picture (userid, pictureid, name, date, extension, postingid) VALUES ?';
            db.get().query(picture_sql, [picture_array], (err, result) => {
                if (err) {
                    console.error(err);
                    const error = { "errorCode" : "U009", "message" : "데이터베이스에 이미지를 등록하지 못했습니다."};
                    res.status(500).json(error);
                } else {
                    res.json({ "message" : "핀 등록이 완료되었습니다." });
                }
            });
        } else {
            const error = { "errorCode" : "U011", "message" : "이미지 업로드를 실패했습니다."};
            res.status(400).json(error);
        }
    });
});

app.get('/api/mypin', authenticateToken, (req, res) => {
    const userid = req.user;
    const sql = 'SELECT * FROM posting WHERE userid = ?';
    db.get().query(sql, [userid], (err, postingresults) => {
        if(err) {
            console.error(err);
            const error = { "errorCode" : "U009", "message" : "데이터베이스에 접속하지 못했습니다."};
            res.status(500).json(error);
        } else if (postingresults.length > 0) {
            const postingIds = postingresults.map(postingresult => postingresult.postingid);
            const sql = 'SELECT * FROM picture WHERE postingid IN ?';
            const sqlParams = [postingIds];

            db.get().query(sql, [sqlParams], (err, pictureresults) => {
                if(err) {
                    console.error(err);
                    const error = { "errorCode" : "U009", "message" : "데이터베이스에 접속하지 못했습니다."};
                    res.status(500).json(error);
                } else if (pictureresults.length > 0) {
                    console.log(pictureresults);
                    for(let i = 0; i<postingresults.length; i++) {
                        let picarr = new Array();
                        pictureresults.forEach(function(picture) {
                            if(postingresults[i].postingid == picture.postingid){
                                picarr.push(picture_url + picture.pictureid);
                            }
                        });
                        postingresults[i].pictures = picarr;
                    }
                    res.json(postingresults);
                }
            });
        } else {
            const error = { "errorCode" : "U010", "message" : "DB 검색 결과가 없습니다."};
            res.status(400).json(error);
        }
    });
});

app.get('/api/search', (req, res) => {
    const searchTerm = req.query.q; // 쿼리 파라미터로 전달된 검색어

    const sql = 'SELECT * FROM posting WHERE roadname LIKE ? AND disclosure != "비공개"';
    db.get().query(sql, [`%${searchTerm}%`], (err, postingresults) => {
        if (err) {
            console.error(err);
            const error = { "errorCode" : "U009", "message" : "데이터베이스에 접속하지 못했습니다."};
            res.status(500).json(error);
        } else if (postingresults.length > 0) {
            const postingIds = postingresults.map(postingresult => postingresult.postingid);
            const sql = 'SELECT * FROM picture WHERE postingid IN ?';
            const sqlParams = [postingIds];

            db.get().query(sql, [sqlParams], (err, pictureresults) => {
                if(err) {
                    console.error(err);
                    const error = { "errorCode" : "U009", "message" : "데이터베이스에 접속하지 못했습니다."};
                    res.status(500).json(error);
                } else if (pictureresults.length > 0) {
                    for(let i = 0; i<postingresults.length; i++) {
                        let picarr = new Array();
                        pictureresults.forEach(function(picture) {
                            if(postingresults[i].postingid == picture.postingid){
                                picarr.push(picture_url + picture.pictureid);
                            }
                        });
                        postingresults[i].pictures = picarr;
                    }
                    res.json(postingresults);
                }
            });
        } else {
            const error = { "errorCode" : "U010", "message" : "DB 검색 결과가 없습니다."};
            res.status(400).json(error);
        }
    });
});

app.get('/api/picture/:pictureid', (req, res) => {
    const { pictureid } = req.params;
    const sql = 'SELECT * FROM picture WHERE pictureid = ?';
    db.get().query(sql, pictureid, (err, results) => {
        if(err) {
            console.error(err);
            const error = { "errorCode" : "U009", "message" : "데이터베이스에 접속하지 못했습니다."};
            res.status(500).json(error);
        } else {
            let filename = "./pictures/"+results[0].pictureid;
            fs.readFile(filename,  function (err, data) {
                if(err) {
                    console.error(err);
                } else {
                    res.writeHead(200, { "Context-Type": results[0].extension});
                    res.write(data);
                    res.end();
                }
            });
        }
    });
});

// 핀 수정을 위한 정보 불러오기
app.get('/api/posting/:postingid', authenticateToken, (req, res) => {
    const userid = req.user;
    const postingid = req.params.postingid;
    const selectPostingSql = 'SELECT * FROM posting WHERE userid = ? AND postingid = ?;';
    const selectPictureSql = 'SELECT * FROM picture WHERE postingid = ?;';
    db.get().query(selectPostingSql, [userid, postingid], (err, postingresult) => {
        if(err) {
            console.error(err);
            const error = { "errorCode" : "U009", "message" : "데이터베이스에 접속하지 못했습니다."};
            res.status(500).json(error);
        } else if (postingresult.length > 0) {
            db.get().query(selectPictureSql, postingid, (err, pictureresults) => {
                if(err) {
                    console.error(err);
                    const error = { "errorCode" : "U009", "message" : "데이터베이스에 접속하지 못했습니다."};
                    res.status(500).json(error);
                } else if (pictureresults.length > 0) {
                    let picarr = new Array();
                    pictureresults.forEach(function(picture) {
                        picarr.push(picture_url + picture.pictureid);
                    });
                    postingresult[0].pictures = picarr;
                    res.json(postingresult);
                }
            });
        } else {
            const error = { "errorCode" : "U010", "message" : "핀을 찾을 수 없습니다."};
            res.status(404).json(error);
        }
    });
});

// 글 수정
app.put('/api/posting/:postingid', authenticateToken, upload.array('photo', 5), (req, res) => {
    const postingid = req.params.postingid;
    const files = req.files;
    const { disclosure, content, roadname } = req.body;
    const userid = req.user;
    const uploaddate = new Date();

    const updatePostingSql = 'UPDATE posting SET disclosure=?, content=?, roadname=? WHERE postingid=?;';
    const selectPictureSql = 'SELECT * FROM picture WHERE postingid=?;';
    const deletePictureSql = 'DELETE FROM picture WHERE postingid=?;';
    const insert_picture_sql = 'INSERT INTO picture (userid, pictureid, name, date, extension, postingid) VALUES ?';

    db.get().getConnection((err, connection) => { // 커넥션 가져오기
        if (err) {
            console.error(err);
            return res.status(500).json({ message: '내부 서버 오류' });
        }

        connection.beginTransaction((err) => { // 트랜잭션 시작
            if (err) {
                console.error(err);
                connection.release(); // 커넥션 반환
                return res.status(500).json({ message: '내부 서버 오류' });
            }

            // 게시물 조회
            const selectPostingSql = "SELECT * FROM posting WHERE postingid = ?";
            connection.query(selectPostingSql, [postingid, userid], (err, result) => {
                if (err) {
                    console.error(err);
                    connection.rollback(() => {
                        connection.release(); // 커넥션 반환
                        return res.status(500).json({ message: '내부 서버 오류' });
                    });
                }

                if (result.length === 0) { // 글이 존재하지 않는 경우
                    const error = { "errorCode": "U010", "message": "핀을 찾을 수 없습니다." };
                    connection.release(); // 커넥션 반환
                    return res.status(404).json(error);
                }

                // 게시물 수정
                connection.query(updatePostingSql, [disclosure, content, roadname, postingid], (err, result) => {
                    if (err) {
                        console.error(err);
                        connection.rollback(() => {
                            connection.release(); // 커넥션 반환
                            return res.status(500).json({ message: '내부 서버 오류' });
                        });
                    }
                    

                    //서버에서 기존 사진 삭제
                    connection.query(selectPictureSql, postingid, (err, result) => {
                        if(result.length > 0){
                            result.forEach(function(picture){
                                file = './pictures/' + picture.pictureid;
                                fs.unlink(file, function(err){
                                    if(err) {
                                        console.log(err);
                                    }
                                });
                            });
                        }
                    });

                    // 데이터베이스에서 기존 사진 삭제
                    connection.query(deletePictureSql, [postingid], (err, result) => {
                        if (err) {
                            console.error(err);
                            connection.rollback(() => {
                                connection.release(); // 커넥션 반환
                                return res.status(500).json({ message: '내부 서버 오류' });
                            });
                        }

                        // 새로운 사진 추가
                        let picture_array = files.map(picture => [userid, picture.filename, picture.originalname, uploaddate, picture.mimetype, postingid] );
                        db.get().query(insert_picture_sql, [picture_array], (err, result) => {
                            if (err) {
                                console.error(err);
                                const error = { "errorCode" : "U009", "message" : "데이터베이스에 이미지를 등록하지 못했습니다."};
                                res.status(500).json(error);
                            } else {
                                res.json({ "message" : "핀 등록이 완료되었습니다." });
                            }
                        });

                        Promise.all(picturePromises)
                            .then(() => {
                                connection.commit((err) => { // 트랜잭션 커밋
                                    if (err) {
                                        console.error(err);
                                        connection.rollback(() => {
                                            connection.release(); // 커넥션 반환
                                            return res.status(500).json({ message: '내부 서버 오류' });
                                        });
                                    } else {
                                        connection.release(); // 커넥션 반환
                                        return res.status(200).json({ message: '게시물이 수정되었습니다.' });
                                    }
                                });
                            })
                            .catch(err => {
                                console.error(err);
                                connection.rollback(() => {
                                    connection.release(); // 커넥션 반환
                                    return res.status(500).json({ message: '내부 서버 오류' });
                                });
                            });
                    });
                });
            });
        });
    });
});
  
// 글 삭제
app.delete('/api/posting/:postingid', authenticateToken, (req, res) => {
    const postingid = req.params.postingid;
    const userid = req.user;

    const deletePostingSql = "DELETE FROM posting WHERE postingid = ?";
    const selectPictureSql = 'SELECT * FROM picture WHERE postingid=?;';
    const deletePictureSql = "DELETE FROM picture WHERE postingid = ?";

    db.get().getConnection((err, connection) => { // 커넥션 가져오기
        if (err) {
            console.error(err);
            return res.status(500).json({ message: '내부 서버 오류' });
        }

        connection.beginTransaction((err) => { // 트랜잭션 시작
            if (err) {
                console.error(err);
                return res.status(500).json({ message: '내부 서버 오류' });
            }

            // 게시물 조회
            const selectPostingSql = "SELECT * FROM posting WHERE postingid = ? AND userid=?";
            connection.query(selectPostingSql, [postingid, userid], (err, result) => {
                if (err) {
                    connection.rollback(() => {
                        console.error(err);
                        return res.status(500).json({ message: '내부 서버 오류' });
                    });
                    connection.release(); // 커넥션 반환
                    return;
                }

                if (result.length === 0) { // 글이 존재하지 않는 경우
                    const error = { "errorCode": "U010", "message": "핀을 찾을 수 없습니다." };
                    res.status(404).json(error);
                    connection.release(); // 커넥션 반환
                    return;
                }

                // 게시물 삭제
                connection.query(deletePostingSql, [postingid], (err, result) => {
                    if (err) {
                        connection.rollback(() => {
                            console.error(err);
                            return res.status(500).json({ message: '내부 서버 오류' });
                        });
                        connection.release(); // 커넥션 반환
                        return;
                    }

                    //서버에서 사진 삭제
                    connection.query(selectPictureSql, [postingid], (err, result) => {
                        if(result.length > 0){
                            result.forEach(function(picture){
                                file = './pictures/' + picture.pictureid;
                                fs.unlink(file, function(err){
                                    if(err) {
                                        console.log(err);
                                    }
                                });
                            });
                        }
                    });

                    // 데이터베이스에서 사진 삭제
                    connection.query(deletePictureSql, [postingid], (err, result) => {
                        if (err) {
                            connection.rollback(() => {
                                console.error(err);
                                return res.status(500).json({ message: '내부 서버 오류' });
                            });
                            connection.release(); // 커넥션 반환
                            return;
                        }

                        connection.commit((err) => { // 트랜잭션 커밋
                            if (err) {
                                connection.rollback(() => {
                                    console.error(err);
                                    return res.status(500).json({ message: '내부 서버 오류' });
                                });
                            } else {
                                connection.release(); // 커넥션 반환
                                res.send('게시물이 삭제되었습니다.');
                            }
                        });
                    });
                });
            });
        });
    });
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




