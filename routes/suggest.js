const express = require('express');
const db = require("../db"); // 데이터베이스
const router = express.Router();
const picture_url = 'https://www.picplace.kro.kr/posting/picture/';

// 데이터 베이스 연결
db.connect(function(err) {
    if(err) {
        console.log('Unable to connect to MySQL');
        process.exit(1);
    }
});

function dateFormat(date) {
    let month = date.getMonth() + 1;
    let day = date.getDate();
    let hour = date.getHours();

    month = month >= 10 ? month : '0' + month;
    day = day >= 10 ? day : '0' + day;
    hour = hour >= 10 ? hour : '0' + hour;

    return date.getFullYear() + '-' + month + '-' + day;
}

router.get('/weeklyloca', (req, res) => {
    let today = new Date().setDate(new Date().getDate() + 1);
    let lastweek = new Date().setDate(new Date().getDate() - 7);

    today = dateFormat(new Date(today));
    lastweek = dateFormat(new Date(lastweek));

    const locationSql = `
            SELECT locationid, COUNT(locationid)
            FROM posting
            WHERE postdate BETWEEN ? AND ?
            AND disclosure != "비공개"
            GROUP BY locationid
            ORDER BY COUNT(locationid)
            DESC LIMIT 1
    `;
    db.get().query(locationSql, [lastweek, today], (err, locationresult) => {
        if (err) {
            console.error(err);
            const error = { "errorCode": "U009", "message": "데이터베이스에 접속하지 못했습니다." };
            res.status(500).json(error);
        } else if (locationresult.length > 0) {
            const sql = `
                SELECT p.*, lo.locationname, GROUP_CONCAT(DISTINCT CONCAT('${picture_url}', pi.pictureid)) AS pictures,
                GROUP_CONCAT(DISTINCT t.tag) AS tags, COUNT(r.postingid) AS recommendCount
                FROM posting p
                LEFT JOIN recommand r ON p.postingid = r.postingid
                LEFT JOIN picture pi ON p.postingid = pi.postingid
                LEFT JOIN tags t ON p.postingid = t.postingid
                INNER JOIN location lo ON p.locationid = lo.locationid
                WHERE p.locationid = ?
                AND postdate BETWEEN ? AND ?
                AND p.disclosure != "비공개"
                GROUP BY p.postingid;
            `;

            db.get().query(sql, [locationresult[0].locationid, lastweek, today], (err, results) => {
                if (err) {
                    console.error(err);
                    const error = { "errorCode": "U009", "message": "데이터베이스에 접속하지 못했습니다." };
                    res.status(500).json(error);
                } else if (results.length > 0) {
                    const response = results.map(result => {
                        const posting = {
                            postingid: result.postingid,
                            disclosure: result.disclosure,
                            content: result.content,
                            locationid: result.locationid,
                            locationname: result.locationname,
                            userid: result.userid,
                            postdate: result.postdate,
                            pictures: result.pictures ? result.pictures.split(',') : [],
                            tags: result.tags ? result.tags.split(',') : [],
                            recommendCount: result.recommendCount / 4
                        };
                        return posting;
                    });
                    res.json(response);
                } else {
                    for (let i = 0; i < results.length; i++) {
                        results[i].pictures = "";
                    }
                    res.json(results);
                }
            });
        } else {
            const error = { "errorCode": "U010", "message": "DB 검색 결과가 없습니다." };
            res.status(400).json(error);
        }
    });
});

/*
router.get('/weeklyloca', (req, res) => {
    let today = new Date().setDate(new Date().getDate() + 1);
    let lastweek = new Date().setDate(new Date().getDate() - 7);

    today = dateFormat(new Date(today));
    lastweek = dateFormat(new Date(lastweek));

    const sql = `
    SELECT posting.*, location.locationname
    FROM posting INNER JOIN location ON posting.locationid = location.locationid
    WHERE postdate BETWEEN ? AND ? AND disclosure != "비공개";`
    db.get().query(sql, [lastweek, today], (err, postingresults) => {
        if (err) {
            console.error(err);
            const error = { "errorCode": "U009", "message": "데이터베이스에 접속하지 못했습니다." };
            res.status(500).json(error);
        } else if (postingresults.length > 0) {
            const getElCount = (arr) => arr.reduce((accu, curr) => { 
                    accu[curr] = (accu[curr] || 0)+1; 
                    return accu;
                }, {});
            const modeKey = newObject => Object.keys(newObject).reduce((acc, cur) =>
                    newObject[acc] > newObject[cur] ? acc : cur
                );
            
            const postingRoads = postingresults.map(postingresult => postingresult.locationname);
            const mostPostingRoad = modeKey(getElCount(postingRoads));

            const results = postingresults.filter((postingresult) => {
                    return (postingresult.locationname === mostPostingRoad);
                });

            const postingIds = results.map(postingresult => postingresult.postingid);
            const sql = 'SELECT * FROM picture WHERE postingid IN ?';
            const sqlParams = [postingIds];

            db.get().query(sql, [sqlParams], (err, pictureresults) => {
                if (err) {
                    console.error(err);
                    const error = { "errorCode": "U009", "message": "데이터베이스에 접속하지 못했습니다." };
                    res.status(500).json(error);
                } else if (pictureresults.length > 0) {
                    for (let i = 0; i < results.length; i++) {
                        let picarr = new Array();
                        pictureresults.forEach(function (picture) {
                            if (results[i].postingid == picture.postingid) {
                                picarr.push(picture_url + picture.pictureid);
                            }
                        });
                        results[i].pictures = picarr;
                    }

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

                        results.forEach(posting => {
                            posting.recommendCount = counts[posting.postingid] || 0;
                        });
                    
                        res.json(results);
                    });
                } else {
                    for (let i = 0; i < results.length; i++) {
                        results[i].pictures = "";
                    }
                    res.json(results);
                }
            });
        } else {
            const error = { "errorCode": "U010", "message": "DB 검색 결과가 없습니다." };
            res.status(404).json(error);
        }
    });
});
*/

router.get('/random', (req, res) => {
    const randomsql = 'SELECT tag FROM tags ORDER BY RAND() LIMIT 1;';
    const sql = `
        SELECT p.postingid, p.disclosure, p.content, lo.locationname, p.userid, p.postdate, 
        GROUP_CONCAT(DISTINCT CONCAT('${picture_url}', pi.pictureid)) AS pictures, 
        GROUP_CONCAT(DISTINCT t.tag) AS tags, 
        COALESCE(r.recommendCount, 0) AS recommendCount
        FROM posting p
        LEFT JOIN (
        SELECT postingid, COUNT(postingid) AS recommendCount
        FROM recommand
        GROUP BY postingid
        ) r ON p.postingid = r.postingid
        LEFT JOIN picture pi ON p.postingid = pi.postingid
        LEFT JOIN tags t ON p.postingid = t.postingid
        LEFT JOIN location lo ON p.locationid = lo.locationid
        WHERE p.postingid IN (
        SELECT DISTINCT t.postingid
        FROM tags t
        WHERE t.tag = ?
        ) AND p.disclosure != '비공개'
        GROUP BY p.postingid;
    `;

    db.get().query(randomsql, (err, randomresult) => {
        if (err) {
            console.error(err);
            const error = { "errorCode": "U009", "message": "데이터베이스에 접속하지 못했습니다." };
            res.status(500).json(error);
        } else {
            const count = randomresult[0].tag;
            db.get().query(sql, count, (err, results) => {
                if (err) {
                    console.error(err);
                    const error = { "errorCode": "U009", "message": "데이터베이스에 접속하지 못했습니다." };
                    res.status(500).json(error);
                } else if (results.length > 0) {
                    const response = results.map(result => {
                        const posting = {
                            randomtag: count,
                            postingid: result.postingid,
                            disclosure: result.disclosure,
                            content: result.content,
                            locationname: result.locationname,
                            userid: result.userid,
                            postdate: result.postdate,
                            pictures: result.pictures ? result.pictures.split(',') : [],
                            tags: result.tags ? result.tags.split(',') : [],
                            recommendCount: result.recommendCount || 0
                        };
                        return posting;
                    });
                    res.json(response);
                } else {
                    const error = { "errorCode": "U010", "message": "DB 검색 결과가 없습니다." };
                    res.status(404).json(error);
                }
            });
        }
    });
});
  
router.get('/popular', (req, res) => {
    const sql = `
        SELECT p.postingid, p.disclosure, p.content, lo.locationname, p.userid, p.postdate, GROUP_CONCAT(DISTINCT CONCAT('${picture_url}', pi.pictureid)) AS pictures, GROUP_CONCAT(DISTINCT t.tag) AS tags, COALESCE(subquery.recommendCount, 0) AS recommendCount
        FROM posting p
        LEFT JOIN (
        SELECT r.postingid, COUNT(r.postingid) AS recommendCount
        FROM recommand r
        LEFT JOIN posting p ON r.postingid = p.postingid
        WHERE r.date >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        GROUP BY r.postingid
        ) AS subquery ON p.postingid = subquery.postingid
        LEFT JOIN picture pi ON p.postingid = pi.postingid
        LEFT JOIN tags t ON p.postingid = t.postingid
        LEFT JOIN location lo ON p.locationid = lo.locationid
        WHERE p.locationid = (
        SELECT locationid
        FROM (
        SELECT p.locationid, COUNT(r.postingid) AS recommendCount
        FROM recommand r
        LEFT JOIN posting p ON r.postingid = p.postingid
        WHERE r.date >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        GROUP BY p.locationid
        ORDER BY recommendCount DESC
        LIMIT 1
        ) AS subquery
        )
        GROUP BY p.postingid;
    `;

    db.get().query(sql, (err, results) => {
        if (err) {
            console.error(err);
            const error = { "errorCode": "U009", "message": "데이터베이스에 접속하지 못했습니다." };
            return res.status(500).json(error);
        } else if (results.length > 0) {
            const response = results.map(result => {
                const posting = {
                    postingid: result.postingid,
                    disclosure: result.disclosure,
                    content: result.content,
                    locationname: result.locationname,
                    userid: result.userid,
                    postdate: result.postdate,
                    pictures: result.pictures ? result.pictures.split(',') : [],
                    tags: result.tags ? result.tags.split(',') : [],
                    recommendCount: result.recommendCount || 0
                };
                return posting;
            });
            res.json(response);
        } else {
            const error = { "errorCode": "U010", "message": "DB 검색 결과가 없습니다." };
            res.status(404).json(error);
        }
    });
});

module.exports = router;