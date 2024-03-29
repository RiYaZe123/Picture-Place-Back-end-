const express = require('express');
const db = require("../db"); // 데이터베이스
const authenticateToken = require("../authenticateToken"); // 인증
const multer = require('multer');
const fs = require('fs');
const axios = require('axios');
const router = express.Router();
const picture_url = 'https://www.picplace.kro.kr/posting/picture/';

//업로드 미들웨어
const upload = multer({dest: 'pictures/'});

// 데이터 베이스 연결
db.connect(function(err) {
    if(err) {
        console.log('Unable to connect to MySQL');
        process.exit(1);
    }
});

const getPlaceId = (latitude, longitude) => {return new Promise(async(resolve, reject) => {
    try {
        const apiKey = 'AIzaSyB4nmNgwNuXPhfBqriDyFKYh289imkLG9o'; // Google Places API 키
        const url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=location&inputtype=textquery&fields=place_id&locationbias=circle:100@${latitude},${longitude}&key=${apiKey}`;
        const response = await axios.get(url);
        
        if (response.data.status === 'OK' && response.data.candidates.length > 0) {
            const placeId = response.data.candidates[0].place_id;
            resolve(placeId);
        } else {
            resolve("notfound");
        }
    } catch (error) {
        resolve("notfound");
    }
})
}

// 안드로이드에서 multipart 형태로 보낼 때 큰따옴표 오는 것 제거
const dataProcessing = (req) => {return new Promise(async(resolve) => {
    try {
        for (var key in req.body) {
            if (Object.hasOwnProperty.bind(req.body)(key)) {
                if(Array.isArray(req.body[key])) {
                    let arrayLen = req.body[key].length;
                    for(i=0;i<arrayLen;i++) {
                        req.body[key][i] = req.body[key][i].replaceAll('"','');
                    }
                } else {
                    req.body[key] = req.body[key].replaceAll('"','');
                }
            }
        }
        resolve(req.body);
    } catch(err) {
        resolve("error");
    }
})
}

router.post('/upload', authenticateToken, upload.array('photo', 5), async (req, res) => {
    const files = req.files;
    const userid = req.user;
    const uploaddate = new Date();
    let postingid = 0;
    req.body = await dataProcessing(req);
    if (req.body == "error") {
        return res.status(400).json({"errorCode" : "U025", "message" : "request body가 비어있음"});
    }
    const { locationname, locationaddress, locationhp, latitude, longitude, content, disclosure } = req.body;
    let { tags } = req.body;
    tags = [...new Set(tags)]; // 중복 태그를 제거합니다.

    // 경도와 위도로 구글맵 id, 장소명, 도로명 주소 구해
    let locationid = await getPlaceId(latitude, longitude);
    if(locationid=="notfound") {
        return res.status(404).json({"errorCode" : "U030", "message" : "해당 위치의 장소 ID를 찾을 수 없음"});
    }
    console.log("id조회 완료");

    // id가 만약에 locationDB에 없다면 새로 추가 & 있다면 그냥 패스
    const locasql = 'SELECT locationname FROM location WHERE locationid = ?';
    db.get().query(locasql, [locationid], (err, result) => {
        if(err) {
            console.error(err);
            const error = { "errorCode" : "U024", "message" : "장소 조회 오류"};
            return res.status(500).json(error);
        }

        if(result.length < 1) {
            const insertLocationSql = 'INSERT INTO location (locationid, locationname, locationaddress, latitude, longitude, locationhp) VALUES (?, ?, ?, ?, ?, ?)';
            db.get().query(insertLocationSql, [locationid, locationname, locationaddress, latitude, longitude, locationhp], (err, result) => {
                if (err) {
                  console.error(err);
                  console.log("장소 SQL 쿼리 사용 관련 오류");
                  return res.status(500).json({ "errorCode": "U023", "message": '장소 SQL 쿼리 사용 관련 오류' });
                }
            });
        }
    });
    console.log("장소 등록 완료");

    // 글 작성
    const sql = 'INSERT INTO posting (disclosure, content, locationid, userid, postdate) VALUES (?, ?, ?, ?, ?);';
    db.get().query(sql, [disclosure, content, locationid, userid, uploaddate], (err, result) => {
        if(err) {
            console.error(err);
            const error = { "errorCode" : "U009", "message" : "데이터베이스에 핀을 등록하지 못했습니다."};
            console.log("핀 등록 오류");
            res.status(500).json(error);
        } else if (files.length > 0) {
            postingid = result.insertId;
            let picture_array = files.map(picture => [userid, picture.filename, picture.originalname, uploaddate, picture.mimetype, postingid]);

            const picture_sql = 'INSERT INTO picture (userid, pictureid, name, date, extension, postingid) VALUES ?';
            db.get().query(picture_sql, [picture_array], (err, result) => {
                if (err) {
                    console.error(err);
                    const error = { "errorCode" : "U009", "message" : "데이터베이스에 이미지를 등록하지 못했습니다."};
                    console.log("데이터베이스에 이미지를 등록하지 못했습니다.");
                    res.status(500).json(error);
                } else {
                    // 태그 작성
                    let tag_array = tags.map(tag => [postingid, tag]);  // 태그 배열을 사용하여 tag_array를 생성합니다.
                    const tag_sql = 'INSERT INTO tags (postingid, tag) VALUES ?';
                    db.get().query(tag_sql, [tag_array], (err, result) => {
                        if (err) {
                            console.error(err);
                            const error = { "errorCode" : "U009", "message" : "데이터베이스에 태그를 등록하지 못했습니다."};
                            console.log("태그 등록 오류");
                            res.status(500).json(error);
                        } else {
                            res.json({ "message" : "핀 등록이 완료되었습니다." });
                            console.log("핀 등록 완료");
                        }
                    });
                }
            });
        } else {
            const error = { "errorCode" : "U011", "message" : "등록할 이미지가 없습니다."};
            res.status(400).json(error);
        }
    });
});

router.get('/mypin', authenticateToken, (req, res) => {
    const userid = req.user;
    const sql = 'SELECT posting.*, location.locationname FROM posting INNER JOIN location ON posting.locationid = location.locationid WHERE userid = ?';
    console.log("마이 핀 요청");
    db.get().query(sql, [userid], (err, postingresults) => {
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
            const error = { "errorCode": "U010", "message": "핀 목록이 없습니다." };
            res.status(404).json(error);
        }
    });
});

router.get('/search', (req, res) => {
    const searchTerm = req.query.q; // 쿼리 파라미터로 전달된 검색어

    const searchSql = `
    SELECT posting.*, location.locationname
    FROM posting
    INNER JOIN location ON posting.locationid = location.locationid
    WHERE (location.locationname LIKE ? OR location.locationaddress LIKE ?)
    AND posting.disclosure != "비공개";
    `;
    db.get().query(searchSql, [`%${searchTerm}%`, `%${searchTerm}%`], (err, postingresults) => {
        if (err) {
            console.error(err);
            const error = { "errorCode": "U009", "message": "데이터베이스에 접속하지 못했습니다." };
            res.status(500).json(error);
        } else if (postingresults.length > 0) {
            const postingIds = postingresults.map(postingresult => postingresult.postingid);
            const postingSql = 'SELECT * FROM picture WHERE postingid IN ?';
            const sqlParams = [postingIds];

            db.get().query(postingSql, [sqlParams], (err, pictureresults) => {
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

                    // 태그 정보를 가져옵니다.
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

router.get('/picture/:pictureid', (req, res) => {
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
router.get('/:postingid', authenticateToken, (req, res) => {
    const userid = req.user;
    const postingid = req.params.postingid;
    const selectPostingSql = 'SELECT * FROM posting WHERE userid = ? AND postingid = ?;';
    const selectPictureSql = 'SELECT * FROM picture WHERE postingid = ?;';
    const selectTagsSql = 'SELECT * FROM tags WHERE postingid = ?;';
    
    db.get().query(selectPostingSql, [userid, postingid], (err, postingresult) => {
        if (err) {
            console.error(err);
            const error = { "errorCode": "U009", "message": "데이터베이스에 접속하지 못했습니다." };
            res.status(500).json(error);
        } else if (postingresult.length > 0) {
            db.get().query(selectPictureSql, postingid, (err, pictureresults) => {
                if (err) {
                    console.error(err);
                    const error = { "errorCode": "U009", "message": "데이터베이스에 접속하지 못했습니다." };
                    res.status(500).json(error);
                } else if (pictureresults.length > 0) {
                    let picarr = new Array();
                    pictureresults.forEach(function (picture) {
                        picarr.push(picture_url + picture.pictureid);
                    });
                    postingresult[0].pictures = picarr;

                    // 기존 태그 불러오기
                    db.get().query(selectTagsSql, postingid, (err, tagsResults) => {
                        if (err) {
                            console.error(err);
                            const error = { "errorCode": "U009", "message": "데이터베이스에 접속하지 못했습니다." };
                            res.status(500).json(error);
                        } else {
                            const tags = tagsResults.map(tag => tag.tag);
                            postingresult[0].tags = tags;
                            res.json(postingresult);
                        }
                    });
                } else {
                    postingresult[0].pictures = "";
                    
                    // 기존 태그 불러오기
                    db.get().query(selectTagsSql, postingid, (err, tagsResults) => {
                        if (err) {
                            console.error(err);
                            const error = { "errorCode": "U009", "message": "데이터베이스에 접속하지 못했습니다." };
                            res.status(500).json(error);
                        } else {
                            const tags = tagsResults.map(tag => tag.tag);
                            postingresult[0].tags = tags;
                            res.json(postingresult);
                        }
                    });
                }
            });
        } else {
            const error = { "errorCode": "U010", "message": "핀을 찾을 수 없습니다." };
            res.status(404).json(error);
        }
    });
});

// 글 수정
router.put('/:postingid', authenticateToken, upload.array('photo', 5), async(req, res) => {
    const postingid = req.params.postingid;
    const files = req.files;
    req.body = await dataProcessing(req);
    if (req.body == "error") {
        return res.status(400).json({"errorCode" : "U025", "message" : "request body가 비어있음"});
    }
    const { disclosure, content, locationid, tags } = req.body;
    const userid = req.user;
    const uploaddate = new Date();

    // 게시물의 현재 disclosure 상태를 확인합니다.
    const checkDisclosureSql = 'SELECT declaration FROM posting WHERE postingid = ?;';
    db.get().query(checkDisclosureSql, postingid, (err, result) => {
        if (err) {
            console.error(err);
            const error = { "errorCode": "U024", "message": "게시물의 disclosure 상태를 확인하는 동안 오류가 발생했습니다." };
            return res.status(500).json(error);
        }

        const currentDeclaration = result[0].declaration;

        if (currentDeclaration == 1) {
            const error = { "errorCode": "U023", "message": "신고당한 게시물 상태인 게시물은 수정할 수 없습니다." };
            return res.status(400).json(error);
        }

        const updatePostingSql = 'UPDATE posting SET disclosure=?, content=?, locationid=? WHERE postingid=?;';
        const selectPictureSql = 'SELECT * FROM picture WHERE postingid=?;';
        const deletePictureSql = 'DELETE FROM picture WHERE postingid=?;';
        const deleteTagSql = 'DELETE FROM tags WHERE postingid=?;';
        const insertTagSql = 'INSERT INTO tags (postingid, tag) VALUES (?, ?);';
        const insertPictureSql = 'INSERT INTO picture (userid, pictureid, name, date, extension, postingid) VALUES (?, ?, ?, ?, ?, ?)';

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
                    connection.query(updatePostingSql, [disclosure, content, locationid, postingid], (err, result) => {
                        if (err) {
                            console.error(err);
                            connection.rollback(() => {
                                connection.release(); // 커넥션 반환
                                return res.status(500).json({ message: '내부 서버 오류' });
                            });
                        }

                        // 기존 태그 삭제
                        connection.query(deleteTagSql, [postingid], (err, result) => {
                            if (err) {
                                console.error(err);
                                connection.rollback(() => {
                                    connection.release(); // 커넥션 반환
                                    return res.status(500).json({ message: '내부 서버 오류' });
                                });
                            }

                            // 새로운 태그 추가
                            const tagPromises = tags.map(tag => {
                                return new Promise((resolve, reject) => {
                                    connection.query(insertTagSql, [postingid, tag], (err, result) => {
                                        if (err) {
                                            reject(err);
                                        } else {
                                            resolve();
                                        }
                                    });
                                });
                            });

                            Promise.all(tagPromises)
                                .then(() => {
                                    // 기존 사진 삭제
                                    connection.query(selectPictureSql, postingid, (err, result) => {
                                        if (result.length > 0) {
                                            result.forEach(function (picture) {
                                                file = './pictures/' + picture.pictureid;
                                                fs.unlink(file, function (err) {
                                                    if (err) {
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
                                        const picturePromises = files.map(file => {
                                            const originalname = file.originalname;
                                            const pictureid = file.filename;
                                            const extension = file.mimetype;
                                            return new Promise((resolve, reject) => {
                                                connection.query(insertPictureSql, [userid, pictureid, originalname, uploaddate, extension, postingid], (err, result) => {
                                                    if (err) {
                                                        reject(err);
                                                    } else {
                                                        resolve();
                                                    }
                                                });
                                            });
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
});

  
// 글 삭제
router.delete('/:postingid', authenticateToken, (req, res) => {
    const postingid = req.params.postingid;
    const userid = req.user;

    const deletePostingSql = "DELETE FROM posting WHERE postingid = ?";
    const selectPictureSql = 'SELECT * FROM picture WHERE postingid=?;';
    const deletePictureSql = "DELETE FROM picture WHERE postingid = ?";
    const deleteTagsSql = "DELETE FROM tags WHERE postingid = ?";

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

                    // 서버에서 사진 삭제
                    connection.query(selectPictureSql, [postingid], (err, result) => {
                        if (result.length > 0) {
                            result.forEach(function (picture) {
                                file = './pictures/' + picture.pictureid;
                                fs.unlink(file, function (err) {
                                    if (err) {
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

                        // 태그 삭제
                        connection.query(deleteTagsSql, [postingid], (err, result) => {
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
});


module.exports = router;