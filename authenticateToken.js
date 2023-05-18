const jwt = require('jsonwebtoken');
const secretKey = 'my_secret_key';
const refreshKey = 'my_refresh_key';

//인증이 필요한 요청에 대해 미들웨어 함수
// 401 Unauthorized 응답은 클라이언트의 요청에 대해 인증 정보가 필요한데, 해당 정보가 없거나 잘못된 경우를 나타냅니다.
// 403 Forbidden 응답은 클라이언트가 인증되었으나 요청한 자원에 접근할 권한이 없는 경우를 나타냅니다.
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    //?. 뒤에 오는 키값이 있으면 먼저 확인하고 값 반환
    // 키값이 없어도 크래쉬 방지
    if (req.cookies?.refresh) {
        const refreshtoken = req.cookies.refresh;
        // refresh token이 정상인지 확인
        jwt.verify(refreshtoken, refreshKey, (err, decode) => {
            //에러가 있으면 refresh token이 썩었기 때문에 다시 로그인 시킨다.
            if (err) {
                res.sendStatus(403).send("로그인이 만료되었습니다. 다시 로그인 해주세요.");
            } else {
                jwt.verify(token, secretKey, (err, user) => {
                    if (err) return res.sendStatus(403);
                    req.user = user;
                    next();
                });
            }
        });
    } else {
        res.sendStatus(403).send("다시 로그인 해주세요.");
    }
}

module.exports = authenticateToken;