const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const uuidAPIKEY = require('uuid-apikey');
const jwt = require('jsonwebtoken');
const secretKey = 'my_secret_key';

app.use(bodyParser.json());

// 토큰 배열
const tokens = [];

// 임시 테스트 데이터
const users = [
    { id: "1", password: "101", name: "홍길동", city: "seoul"},
    { id: "2", password: "201", name: "김철수", city: "seoul"},
    { id: "3", password: "301", name: "박지성", city: "jeju"},
    { id: "4", password: "401", name: "이영표", city: "jeju"}
];

// 서버 시작
const server = app.listen(3001, () => {
    console.log('Start Server : localhost:3001');
});

// api 키
const key = {
    apiKey: '5BZ2C23-S3GMNT9-JD47NZ8-B0SMTW0',
    uuid: '2afe2608-c8e1-4ae9-9348-7afd58334d70'
}

// READ문
app.get("api/users/:apikey", (req, res) => {
    res.json(users);
});

// 로그인
app.post('/api/login', (req, res) => {
    const { id, password } = req.body;
    // 데이터베이스와 연결되어 req.body의 id와 password가 일치하는 놈을 찾아야함 (테스트 예시)
    const user = users.find(u => u.id === id && u.password === password);

    if (user) {
        const token = jwt.sign({ id: user.id }, secretKey); // 토큰 생성
        tokens.push(token); // 토큰 배열에 추가
        res.json({ token });
    } else {
        res.status(401).send('아이디 또는 비밀번호가 일치하지 않습니다.');
    }
});

//인증이 필요한 요청에 대해 미들웨어 함수
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) return res.sendStatus(401);

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
app.post('/api/logout', (req, res) => {
    const token = req.headers.authorization;
    if (!token) {
        res.status(401).send('로그인이 되어 있지 않습니다.');
        return;
    }

    // 로그인 토큰 삭제
    const index = tokens.indexOf(token);
    if (index !== -1) tokens.splice(index, 1);

    res.send('로그아웃 되었습니다.');
});

// 회원가입
app.post('/api/signup', (req, res) => {
    const { id, password, name, city } = req.body;
  
    if (users.find(u => u.id === id)) {
      res.status(409).send('이미 등록된 아이디입니다.');
    } else {
      const newUser = { id, password, name, city };
      users.push(newUser);
      res.send('회원가입이 완료되었습니다.');
    }
});

// CREATE문 
app.post('/api/users/:apikey', (req, res) => {
    console.log(req.body)
    users.push(req.body);
    res.json(users);
});

// users/이름으로 검색
app.get('/api/users/:apikey/:id', async (req, res) => {
    let {
        apikey,
        id
    } = req.params;

    if(!uuidAPIKEY.check(apikey, key.uuid)) {
         res.send('apikey is not valid');
    } else {
        let data = users.find((u) => {
            return u.id === req.params.id;
        });
        if(data) {
            res.json(data);
        } else {
            res.send('no person.');
        }
    }
});

// UPDATE문
app.put('/api/users/:apikey/:id', (req, res) => {
    let {
        apikey,
        id
    } = req.params;

    if(!uuidAPIKEY.check(apikey, key.uuid)) {
        res.send('apikey is not valid');
    } else {
        let foundIndex = users.findIndex(u => u.id === id)
        if(foundIndex === -1) {
            res.status(404).json({ errorMessage: "User was not found" });
        } else {
            users[foundIndex] = { ...users[foundIndex], ...req.body};
            res.json(users);
        }
   }    
});

// DELETE문
app.delete('/api/users/:apikey/:id', (req, res) => {
    let {
        apikey,
        id
    } = req.params;

    if(!uuidAPIKEY.check(apikey, key.uuid)) {
        res.send('apikey is not valid');
    } else {
        let foundIndex = users.findIndex(u => u.id === id)
        if(foundIndex === -1) {
            res.status(404).json({ errorMessage: "User was not found" });
        } else {
            let foundUser = users.splice(foundIndex, 1);
            res.json(foundUser[0]);
        }
   }
});