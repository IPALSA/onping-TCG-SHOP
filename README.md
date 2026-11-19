# 땀켓몬 TCG샵 - 배포 가이드 (GitHub Pages + Firebase + 치지직 로그인)

## 파일 구성
| 파일 | 설명 |
|---|---|
| index.html | 사이트 본체 |
| backend.js | 치지직 로그인, 카드 도감 동기화, 실제 거래 |
| firebase-config.js | **Firebase / 치지직 설정값을 넣는 파일** |
| firestore.rules | Firestore 보안 규칙 |
| functions/ | 치지직 로그인 검증 서버(Cloud Function) |
| firebase.json | Firebase 배포 설정 |
| pack.glb (선택) | 카드팩 3D 모델. 저장소 루트에 올리면 모든 유저에게 적용 |

## 로그인 구조
치지직 로그인은 client secret이 필요해서 브라우저만으로는 안전하게 만들 수 없습니다. 그래서 다음 흐름을 씁니다.

1. 사이트 -> 치지직 인증 페이지(account-interlock)로 이동, 유저가 로그인/동의
2. 치지직이 사이트 주소로 `?code=...&state=...` 를 붙여 돌려보냄
3. 사이트가 Cloud Function(`chzzkLogin`)에 code를 전달
4. 함수가 치지직 서버에서 토큰을 받고 내 채널 정보(채널ID, 채널명)를 확인한 뒤, Firebase 커스텀 토큰 발급
5. 사이트가 그 토큰으로 Firebase에 로그인 (유저 ID = `chzzk_채널ID`)

> Cloud Functions는 Firebase **Blaze(종량제) 요금제**가 필요합니다. 소규모는 월 무료 사용량 안에서 처리되는 경우가 많지만 결제 수단 등록은 필요합니다.

## 1. 치지직 애플리케이션 등록 (developers.chzzk.naver.com)
1. Application -> 애플리케이션 등록
2. 애플리케이션 ID/이름: 영문/숫자(이름은 한글 가능). **naver, chzzk, 네이버, 치지직 단어는 사용 불가**
3. **로그인 리디렉션 URL**: 사이트 주소 (예: `https://내아이디.github.io/저장소이름/`) - `firebase-config.js`의 `redirectUri`와 완전히 동일하게
4. **API Scopes**: "유저 조회" 선택 (내 채널 정보를 읽는 데 필요)
5. 발급된 Client ID / Client Secret 보관 (Secret은 절대 사이트 파일에 넣지 마세요)

## 2. Firebase 설정
1. Firebase 콘솔에서 프로젝트 생성 -> 웹 앱 추가 -> 설정값을 `firebase-config.js`의 `FIREBASE_CONFIG`에 입력
2. Authentication -> "시작하기" (로그인 제공업체를 켤 필요는 없어요. 커스텀 토큰 방식)
3. Firestore Database 생성(프로덕션 모드) -> 규칙에 `firestore.rules` 게시
4. 요금제를 Blaze로 업그레이드

## 3. Cloud Function 배포
```bash
npm install -g firebase-tools
firebase login
cd functions && npm install && cd ..
cp functions/.env.example functions/.env     # CHZZK_CLIENT_ID, ALLOWED_ORIGIN 입력
firebase functions:secrets:set CHZZK_CLIENT_SECRET   # 치지직 Client Secret 입력
firebase deploy --only functions
```
- 배포가 끝나면 나오는 `chzzkLogin` 주소를 `firebase-config.js`의 `CHZZK.loginFn`에 입력
- 커스텀 토큰 발급 오류(signBlob 권한)가 나면: Google Cloud 콘솔 -> IAM에서 함수 실행 서비스 계정에 **Service Account Token Creator** 역할 추가

## 4. GitHub Pages 배포
1. 저장소에 index.html, backend.js, firebase-config.js (+ pack.glb) 업로드 (functions 폴더와 .env는 올리지 않아도 됩니다)
2. Settings -> Pages -> Branch: main / root

## 5. 관리자 지정 (필수)
1. 사이트에서 치지직으로 한 번 로그인
2. Firebase 콘솔 -> Authentication -> 사용자 탭에서 `chzzk_...` 로 시작하는 UID 복사
3. Firestore에서 컬렉션 `admins` 만들고 문서 ID를 그 UID로 생성 (필드는 아무거나, 예: ok = true)
4. 설정 -> 관리자 설정 버튼 5번 클릭 -> 비밀번호 입력. 비밀번호는 index.html의 `const PW='admin1234'`에서 **반드시 변경** (화면 잠금용이고, 실제 권한은 admins 문서로 서버가 판단)
5. 관리자 메뉴에서 카드/뒷면/개수를 수정하면 1.5초 뒤 서버에 자동 저장되어 모든 유저에게 반영

## 동작 방식
- 카드 도감은 Firestore `cards`, `config/main`에 저장되고 버전이 바뀔 때만 다시 받습니다
- 유저 골드/컬렉션/닉네임/프로필은 `users/{uid}`에 저장됩니다. 닉네임은 치지직 채널명으로 고정되며(변경 불가), 로그인할 때마다 치지직의 최신 이름으로 갱신됩니다. 로그인 전 체험 모드에서는 랜덤 닉네임이 쓰입니다
- 거래: 판매 등록 시 카드가 에스크로(listings)로 이동, 구매는 트랜잭션, 대금은 판매자 inbox로 입금되어 접속 시 자동 수령
- 24시간 거래량/시세는 `trades` 컬렉션의 실제 체결 기록 기준

## 알아둘 한계 (운영 전 확인)
- **보안**: 서버 코드 없이 규칙만으로 거래/골드를 처리하므로, 기술이 있는 유저는 개발자도구로 자기 골드/카드를 조작할 수 있습니다. 방지하려면 팩 개봉과 거래도 Cloud Functions에서 처리해야 합니다
- 판매 목록은 누구나 삭제할 수 있는 규칙입니다(구매 시 삭제가 필요해서)
- 카드 이미지는 Firestore 문서에 저장됩니다(문서당 1MB 제한, 읽기 무료 할당량 일 5만 회). 카드가 수백 장을 넘으면 Firebase Storage 또는 GitHub 정적 파일 방식을 권장합니다
- 치지직 Open API 호출(`/auth/v1/token`, `/open/v1/users/me`)은 공개된 자료 기준으로 작성했고, 실제 연결 테스트는 하지 못했습니다. 응답 형식이 다르면 `functions/index.js`의 해당 부분만 조정하면 됩니다
- 로컬 문법 검사만 했고 실제 Firebase/치지직에 연결해 테스트하지 못했습니다. 배포 후 계정 2개로 로그인과 거래를 꼭 확인하세요
