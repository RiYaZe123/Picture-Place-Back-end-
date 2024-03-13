# Picture Place
![](https://github.com/RiYaZe123/Picture-Place-Back-end-/assets/130757327/51a5421a-e31f-4df0-b375-a512db65ea09)
## 1. 프로그램 소개
- - -
이 프로젝트는 사진을 통해 내가 갔던 장소의 기록을 남기거나,
다른 사람들과  위치 정보, 사진들을 공유하는 어플리케이션이다. 

**백엔드는 REST API를 개발하여 게시판, 검색 결과, 장소 추천 등의 기능들을 개발하였다.**

![](https://github.com/RiYaZe123/Picture-Place-Back-end-/assets/130757327/2c0075b9-053b-46d7-af8c-b2fbe0e6e938)

**[기능]**
 - 로그인, 로그아웃, 회원가입, 회원정보 수정, 회원 탈퇴
 - 핀 업로드, 핀 검색, 핀 수정, 핀 삭제, 추천, 신고
 - 주간 등록 핀 보기, 주간 추천 핀 보기, 랜덤 핀 보기

**[개발 주요사항]**
 - SSL, Let's Encrypt를 이용하여 국내 https 규정 준수
 - Express 기반으로 REST 서버 개발
 - JWT를 이용하여 로그인 기능 구현

<br/>

## 2. 기술 스택
- - -
 - **Language** : Javascript(Node.js)
 - **Framework** : Express
 - **DB** : MYSQL
 - **Tool** : Visual Studio Code, Git
 - **Open Source** : Google Places API

![](https://github.com/RiYaZe123/Picture-Place-Back-end-/assets/130757327/7fc474df-a4a7-4896-9a04-3594d7a70740)

<br/>

## 3. 팀원
- - -
윤대웅 (프론트엔드-팀장)

김규빈 (백엔드-팀원)

홍상혁 (백엔드-팀원)

<br/>

## 4. 개발 기간
- - -
2023.03.06 ~ 2023.04.14 (공부 기간)

2023.04.14 ~ 2023.06.10 (개발 기간)

<br/>

## 5. 어려웠던 점과 배운 것
- - -
**1. 프론트엔드와 백엔드를 합쳐서 테스트를 진행 시 오류가 발생하였을 때**
**한 쪽의 문제인지 양 쪽의 문제인지 확인이 힘들었다.**
**프론트 엔드와 연결이 됐는데 프론트엔드에서 보내는 내용이 빈칸으로 왔던 것**

 body-parser는 클라이언트가 서버로 보낼 데이터를 파싱하는 모듈이다. 여기서 파싱은 서버에서 클라이언트의 요청을 알아들을 수 있게 해주는 역할이다.

 그래서 단순하게 백엔드에서 테스트할 때는 다음 한줄만 추가하였다.
```
app.use(bodyParser.json());
```
 요청 본문을 json 형태로만 파싱하여 처리하면 될 것이라는 생각에 POSTMAN을 사용하여 테스트 케이스를 집어 넣어서 테스트를 진행하였을 때는 문제가 없었으나 프론트엔드와 맞물리는 과정에서 오류가 계속 떠서 이것저것 계속 수정했다.
<br/>
> body-parser deprecated undefined extended: provide extended option
<br/>
 그러다 위의 문구가 뜬 것을 확인하고 해결 방법을 찾아서 넣었더니 정상적으로 출력이 되었다.

 'api.js'에서 이 한줄을 안써서 였다. 
```
app.use(bodyParser.urlencoded({extended: false}));
```
 bodyParser.urlencoded() 함수는 'application/x-www-form-urlencoded' 방식의 Content-Type 데이터를 받아준다.
 'application/x-www-form-urlencoded'는 POST 전송 방식 중 가장 기본이 되는 Content-Type이고
 데이터를 "key: value" 와 같은 형태로 만들어 주는 방식이다. 

 테스트 당시에 POSTMAN으로 테스트 하면서 json으로만 데이터를 넣다보니 이 부분을 간과 했던 것이다. 아마 클라이언트에서는 값을 보냈으나 인코딩이 안되니 내용이 빈칸으로 올 수 밖에 없던 것이다. 
 ![](https://github.com/RiYaZe123/Picture-Place-Back-end-/assets/130757327/32f3d889-80bf-44bf-9f70-efedc2ef3718)

extend 옵션은<br/>
application/x-www-form-urlencoded 방식이면 -> false<br/>
application/x-www-form-urlencoded 방식이 아닌 다른 인코딩 방식이라면 -> true 를 넣어주면 된다.

**이번 오류를 겪으면서 Content-Type에 대해 배우는 되는 시간을 가졌다.**

<br/><br/>

**2. 세션 VS JWT**
**-> JWT를 쓴 이유는 우리가 개발하는 데 있어서 비싼 서버를 살 수 없었기 때문에 이 부분을 고려하여 JWT를 선택했다.**

[세션의 장점]
- 사용자의 로그인 정보를 주고 받지 않기 때문에 상대적으로 안전하다.
- 사용자마다 고유한 세션 ID가 발급되기 때문에, 요청이 들어올 때마다 회원DB를 찾지 않아도 된다.

[세션의 단점]
- 사용자를 식별할 수 있는 값인 세션 ID를 생성하고, 서버에 저장해야하는 작업이 생긴다.
- 서버 세션 저장소를 사용하므로 요청이 많아지면 서버 부하가 심해진다.

[JWT 장점]
- **동시 접속자가 많을 때 서버 부하를 낮춘다.**
- 클라이언트, 서버가 다른 도메인을 사용할 때 사용 가능하다.
- 인증 정보를 서버에 별도로 저장할 필요가 없다. → 서버의 Stateless 특성이 유지된다.

[JWT 단점]
- 구현 복잡도가 증가한다.
- JWT에 담는 내용이 커질수록 네트워크 비용이 증가한다.
- **이미 생성된 JWT를 일부만 만료시킬 방법이 없다. (토큰의 유효기간을 너무 길게 잡으면 안된다.)**
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
