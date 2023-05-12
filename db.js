const mysql = require('mysql');

var pool;
exports.connect = function() {
    pool = mysql.createPool({
        connectionLimit : 10,
        host            : 'www.picplace.kro.kr',
        port            : '41000',
        user            : 'pinover',
        password        : '1234',
        database        : "pinover"
    });
}

exports.get = function() {
    return pool;
}