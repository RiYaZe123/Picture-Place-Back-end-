const express = require('express');
const bodyParser = require('body-parser');
const cookie = require("cookie-parser");
const userRouter = require('./routes/user');
const postRouter = require('./routes/posting');
const reportRouter = require('./routes/report');
const recommendRouter = require('./routes/recommend');
const locationRouter = require('./routes/location');
const suggestRouter = require('./routes/suggest');

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
app.use('/location', locationRouter);
app.use('/suggest', suggestRouter);

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





