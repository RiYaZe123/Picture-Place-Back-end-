![](https://github.com/RiYaZe123/Picture-Place-Back-end-/assets/130757327/51a5421a-e31f-4df0-b375-a512db65ea09) # Picture Place

## 1. 어떤 개발을?
- - -
이 프로젝트는 사진을 통해 내가 갔던 장소의 기록을 남기거나,
다른 사람들과  위치 정보, 사진들을 공유하는 어플리케이션 입니다. 

![](https://github.com/RiYaZe123/Picture-Place-Back-end-/assets/130757327/2c0075b9-053b-46d7-af8c-b2fbe0e6e938)

**[기능]**
 - 로그인, 로그아웃, 회원가입, 회원정보 수정, 회원 탈퇴
 - 핀 업로드, 핀 검색, 핀 수정, 핀 삭제, 추천, 신고
 - 주간 등록 핀 보기, 주간 추천 핀 보기, 랜덤 핀 보기

**[개발 주요사항]**
 - SSL, Let's Encrypt를 이용하여 국내 https 규정 준수
 - Express 기반으로 REST 서버 개발
 - JWT를 이용하여 로그인 기능 구현


## 2. 어떤 기술 스택
- - -
 - **언어** : Javascript(Node.js)
 - **프레임워크** : Express
 - **DB** : MYSQL
 - **Tool** : Visual Studio Code, Git
 - **Open Source** : Google Place API

## 3. 어떤 사람과
- - -
윤대웅 (프론트엔드-팀장)

김규빈 (백엔드-팀원)

홍상혁 (백엔드-팀원)

## 4. 개발 기간
- - -
2023.03.06 ~ 2023.04.14 (공부 기간)

2023.04.14 ~ 2023.06.10 (개발 기간)

## 5. 어려웠던 점과 배운 것
- - -
**1. 프론트엔드와 백엔드를 합쳐서 테스트를 진행 시 오류가 발생하였을 때**
**한 쪽의 문제인지 양 쪽의 문제인지 확인이 힘들었다.**
**프론트 엔드와 연결이 됐는데 프론트엔드에서 보내는 내용이 빈칸으로 왔던 것**

결론적으로는 이 한줄을 안써서 였다. 
```
app.use(bodyParser.urlencoded({extended: false}));
```

이 것이 무엇을 의미하는지 찾아보았다.


**2. 세션 VS JWT**
**-> JWT를 쓴 이유는 우리가 개발하는 데 있어서 비싼 서버를 살 수 없었기 때문에 이 부분을 고려하여 JWT를 선택했다.**

[세션의 장점]
- 사용자의 로그인 정보를 주고 받지 않기 때문에 상대적으로 안전하다.
- 사용자마다 고유한 세션 ID가 발급되기 때문에, 요청이 들어올 때마다 회원DB를 찾지 않아도 된다.

[세션의 단점]
- 사용자를 식별할 수 있는 값인 세션 ID를 생성하고, 서버에 저장해야하는 작업이 생긴다.
- 서버 세션 저장소를 사용하므로 요청이 많아지면 서버 부하가 심해진다.

[JWT 장점]
- 동시 접속자가 많을 때 서버 부하를 낮춘다.
- 클라이언트, 서버가 다른 도메인을 사용할 때 사용 가능하다.
- 인증 정보를 서버에 별도로 저장할 필요가 없다. → 서버의 Stateless 특성이 유지된다.

[JWT 단점]
- 구현 복잡도가 증가한다.
- JWT에 담는 내용이 커질수록 네트워크 비용이 증가한다.
- 이미 생성된 JWT를 일부만 만료시킬 방법이 없다. (토큰의 유효기간을 너무 길게 잡으면 안된다.)
- Secret Key 유출 시 JWT 조작이 가능하다.

**아무래도 서버 부하를 낮춰야하는 관계로 JWT를 선택했다.**
다만 JWT의 단점 중 하나인 이미 생성된 JWT를 일부만 만료 시킬 수 없기 때문에
Secret Key 유출하면 조작이 가능해
**테스트 과정에서 이 부분을 어떻게 처리할 까 고민했다.**

**그래서 access 토큰과 refresh 토큰의 유효시간을 제한하였다.**
```
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
                        const accessToken = jwt.sign({userid: userid}, secretKey, {'expiresIn': '1h'}); // 토큰 생성 - accessToken
                        const refreshToken = jwt.sign({userid: userid}, refreshKey, {'expiresIn': '24h'}); // 토큰 생성 - refreshToken
                        //tokens.push(token); // 토큰 배열에 추가
                        res.cookie("access", accessToken);
                        res.cookie("refresh", refreshToken);
                        //res.json({ accessToken });
                        res.json({ "message" : "로그인이 완료되었습니다." });
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
```
**accessToken과 refreshToken의 시간을 짧게 두어서 JWT의 단점을 줄이고자 하였다.**
